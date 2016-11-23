'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _bluebird = require('bluebird');

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const debug = (0, _debug2.default)('rest-log:mongodbSaver');

class MongodbSaver {

  constructor({ dbClient, collectionName }) {

    this.db = dbClient;
    const coll = this.db.collection(collectionName);
    if (!coll) {
      throw new Error(`no collection named ${ collectionName } be found`);
    }
    this.coll = (0, _bluebird.promisifyAll)(coll);
  }

  start() {
    return _asyncToGenerator(function* () {})();
  }

  end() {
    if (!this.db) {
      return debug('no database connected');
    }

    this.db.close();
  }

  /**
   * 数据入库
   * @return {[type]} [description]
   */
  push(optData) {
    var _this = this;

    return _asyncToGenerator(function* () {
      debug('push data', optData);
      if (!_this.db) {
        return debug('no database connected');
      }

      if (!_this.coll) {
        return debug('no collection found when push data');
      }

      return yield _this.coll.updateAsync(optData, optData, {
        upsert: true
      });
    })();
  }

  /**
   * 拉取数据
   * @param  {object} opt 拉取条件
   * @return {[type]}     [description]
   */
  pull(filter = {}) {
    var _this2 = this;

    return _asyncToGenerator(function* () {
      debug('pull data', filter);

      if (!_this2.coll) {
        debug('no collection found when pull data');
        return [];
      }

      filter.createdAt = {
        $gte: filter.startAt,
        $lt: filter.endAt
      };

      const limit = filter.pageSize || 0;
      const skip = limit * (filter.page || 0);

      delete filter.startAt;
      delete filter.endAt;
      delete filter.pageSize;
      delete filter.page;

      return new Promise(function (resolve, reject) {
        _this2.coll.find(filter).skip(skip).limit(limit).toArray(function (err, docs) {
          if (err) {
            return reject(err);
          }
          return resolve(docs);
        });
      });
    })();
  }
}

exports.default = MongodbSaver;