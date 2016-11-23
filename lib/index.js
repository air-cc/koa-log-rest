'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _bluebird = require('bluebird');

var _readline = require('readline');

var _readline2 = _interopRequireDefault(_readline);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _mkdirp = require('mkdirp');

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _MongodbSaver = require('./MongodbSaver');

var _MongodbSaver2 = _interopRequireDefault(_MongodbSaver);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * 策略：
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * log 数据先缓存到本地，然后再根据一定的规则（比如：应用服务器当前不繁忙 or 本地资源积累到一定大小的时候 or 到达一定上传时间）上传数据
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            **/

/**
 * 数据结构
 *  {
     userId: '',
     resource: '',
     operation: '',
     status: 1,
     ip: '',
     createdAt: '',
     originRequest: {
       url: '',
       method: '',
       body: {},
       userAgent: ''
     },
     originResponse: {
       statusCode: 200,
       body: {}
     },
   }
 */

const debug = (0, _debug2.default)('rest-log');
(0, _bluebird.promisifyAll)(_fs2.default);
const logger = console.log.bind(console);

class RestLog {
  /**
   * 构造函数
   * @param   {object}      opts                            配置项
   * @param   {function}    opts.getUserId                  获取用户ID
   * @param   {function}    opts.getResource                获取当前对应的资源
   * @param   {string}      opts.localPath                  本地的缓存目录
   * @param   {function}    opts.filter                     url 过滤 return true 才需要保存
   * @param   {object}      opts.dbSaver                    数据库的配置
   * @param   {object}      opts.dbSaver.dbClient           已连接数据库的客户端实例
   * @param   {string}      opts.dbSaver.collectionName     数据集合名
   * @param   {object}      opts.uploadCondition            缓存数据的上传规则
   * @param   {number}      opts.uploadCondition.filesLimit     最大缓存文件数
   * @param   {number}      opts.uploadCondition.fileSizeLimit  缓存文件最大体积（KB）
   * @param   {number}      opts.uploadCondition.fileExpireTime 缓存文件过期时间（秒）
   * @param   {number}      opts.uploadCondition.intervalTime   缓存目录轮询检测时间（秒）
   * @return {[type]}      [description]
   */
  constructor({ getUserId, getResource, localPath, filter, dbSaver, uploadCondition = {} }) {
    if (typeof getUserId !== 'function') {
      throw new Error('must give a function to get userId');
    }

    if (typeof getResource !== 'function') {
      throw new Error('must give a function to get Resource');
    }

    this.getUserId = getUserId;
    this.getResource = getResource;

    this.localPath = localPath || (0, _path.join)(__dirname, '../../data');
    this.filter = filter;

    let { dbClient, collectionName } = dbSaver;
    if (!dbClient) throw new Error('no dbClient found');
    collectionName = collectionName || 'restlog';
    this.dbSaver = new _MongodbSaver2.default({ dbClient, collectionName });

    this.filesLimit = uploadCondition.filesLimit || 1;
    this.fileSizeLimit = (uploadCondition.fileSizeLimit || 10) * 1024;
    this.fileExpireTime = (uploadCondition.fileExpireTime || 10) * 1000; // default: 3 * 60
    this.intervalTime = (uploadCondition.intervalTime || 10) * 1000; // default: 60
    (0, _mkdirp.sync)(this.localPath);

    this.onSubmitting = false;
    setInterval(() => {
      this.submit();
    }, this.intervalTime);
  }

  /**
   * 数据搜集 - koa@2 中间件
   * @param  {[type]}   ctx  [description]
   * @param  {Function} next [description]
   * @return {[type]}        [description]
   */
  middleware_koa(ctx, next) {
    var _this = this;

    return _asyncToGenerator(function* () {
      let optData = {};

      let { url, method, ip } = ctx;
      method = method.toLowerCase();

      if (typeof _this.filter === 'function' && !_this.filter(url, method)) {
        debug(`no need log ${ url } ${ method }`);
        return next();
      }

      Object.assign(optData, {
        operation: method,
        ip: ip, // 注意这里获取到的 IP 被 KOA 转成 IPv6 格式了
        status: 0,
        createdAt: new Date(),
        originRequest: {
          url: url,
          method: method,
          userAgent: ctx.headers['user-agent'] || 'unknown',
          body: ctx.request.body
        }
      });

      let err = null;
      try {
        yield next();
      } catch (error) {
        logger(`error happened ${ err }`);
        err = error;
      }

      const userId = (yield _this.getUserId(ctx)) || null;
      const resource = (yield _this.getResource(ctx)) || null;
      Object.assign(optData, {
        userId: userId,
        resource: resource,
        status: err ? -1 : 1,
        originResponse: {
          statusCode: err ? err.status || 500 : ctx.status || 404,
          body: ctx.body
        }
      });

      debug('get optData', optData);

      // 提交数据，交由下游方法来处理
      _this.submit(optData);

      if (err) {
        throw err;
      }
    })();
  }

  getMiddleware() {
    return this.middleware_koa.bind(this);
  }

  /**
   * 检测当前缓存数据的状态
   * @return {boolean}   当前是否需要将缓存数据上传数据库
   */
  checkStatus() {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      const files = yield _fs2.default.readdirAsync(_this2.localPath);

      // 当前未提交文件数操过预计
      if (files.length > _this2.filesLimit) {
        return true;
      }

      for (let fileName of files) {
        const file = (0, _path.join)(_this2.localPath, fileName);
        const status = yield _fs2.default.statAsync(file);

        // 当前文件的大小大于一定值
        if (status.size > _this2.fileSizeLimit) {
          return true;
        }

        // 当前文件的过期时间
        const outDate = new Date().getTime() - status.birthtime.getTime();
        if (outDate >= _this2.fileExpireTime) {
          return true;
        }
      }

      return false;
    })();
  }

  /**
   * 提交数据
   * 等规则满足后，提交到远端
   * @param  {object} optData 用户操作数据
   * @return
   */
  submit(optData) {
    debug('submit', optData, this.onSubmitting);

    const self = this;_asyncToGenerator(function* () {
      try {
        // 数据暂存本地
        if (optData) {
          yield self.saveLocal.call(self, optData);
        }

        // 检测当前数据库是否处于上传状态
        if (self.onSubmitting) {
          return debug('onSubmitting...');
        }

        // 若条件满足，上传到数据库
        const status = yield self.checkStatus.call(self);
        debug('check upload status', status);
        if (status) {
          self.submitting = true;
          yield self.local2Remote.call(self);
        }
      } catch (err) {
        debug('submit error', err);
      }
      self.onSubmitting = false;
    })();
  }

  /**
   * 拉取数据
   * @param  {object} filter            筛选条件
   * @param  {date}   filter.startAt    开始时间
   * @param  {date}   filter.endAt      结束时间
   * @param  {string} filter.userId     操作用户ID
   * @param  {string} filter.resource   操作对应的资源
   * @param  {string} filter.operation  操作类型
   * @param  {number} filter.page       列表分页
   * @param  {number} filter.pageSize   列表单页长度
   * @return {array}         操作记录数据
   */
  search(filter) {
    var _this3 = this;

    return _asyncToGenerator(function* () {
      return yield _this3.dbSaver.pull(filter);
    })();
  }

  /**
   * 将数据暂存到本地
   * @param  {[type]} optData 用户操作数据
   * @return
   */
  saveLocal(optData) {
    var _this4 = this;

    return _asyncToGenerator(function* () {
      const now_data = new Date().toLocaleDateString();
      const file = (0, _path.join)(_this4.localPath, now_data + '.log');
      yield _fs2.default.appendFileAsync(file, JSON.stringify(optData) + '\n', {
        encoding: 'utf8',
        flags: 'a+'
      });
    })();
  }

  /**
   * 将数据上传到远端数据库
   * @return
   */
  local2Remote() {
    var _this5 = this;

    return _asyncToGenerator(function* () {
      const files = yield _fs2.default.readdirAsync(_this5.localPath);

      debug(`get files from ${ _this5.localPath }`, files);

      for (let fileName of files) {
        if (!fileName.match(/^\d{4}-(0?[1-9]|1[0-2])-(0?[1-9]|[1-2]\d|3[0-1]).log$/ig)) {
          return;
        }

        const fileDir = (0, _path.join)(_this5.localPath, fileName);
        const rl = _readline2.default.createInterface({
          input: _fs2.default.createReadStream(fileDir)
        });

        yield new Promise(function (resolve, reject) {

          rl.on('line', function (line) {
            if (!line) {
              return resolve(null);
            }

            let obj = null;
            try {
              obj = JSON.parse(line);
              debug('get line obj', obj);
            } catch (err) {
              debug(`path line info fail @ ${ fileDir }`, err);
              return reject(err);
            }

            if (!obj) {
              return resolve(null);
            }

            obj.createdAt = new Date(obj.createdAt);
            _this5.dbSaver.push(obj).then(resolve).catch(reject);
          });
        });
        debug(`update all data from ${ fileDir } to remote db`);

        yield _fs2.default.unlinkAsync(fileDir);
        debug(`delete file ${ fileDir }`);
      }
    })();
  }

}

exports.default = RestLog;