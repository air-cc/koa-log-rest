import {promisifyAll} from 'bluebird'

import debugMod from 'debug'
const debug = debugMod('rest-log:mongodbSaver')

class MongodbSaver {
  /**
   * 构造函数
   * @param  {Object} options.dbClient        数据库实例
   * @param  {String} options.collectionName  collection name
   * @return {Object}                         实例
   */
  constructor({dbClient, collectionName}) {

    this.db = dbClient
    const coll = this.db.collection(collectionName)
    if (!coll) {
      throw new Error(`no collection named ${collectionName} be found` )
    }
    this.coll = promisifyAll(coll)
  }

  async start() {
  }

  end() {
    if (!this.db) {
      return debug('no database connected')
    }

    this.db.close()
  }

  /**
   * 数据入库
   * @return {[type]} [description]
   */
  async push(optData) {
    debug('push data', optData)
    if (!this.db) {
      return debug('no database connected')
    }

    if (!this.coll) {
      return debug('no collection found when push data')
    }

    return await this.coll.updateAsync(optData, optData, {
      upsert: true
    })
  }

  /**
   * 过滤条件处理
   * @param  {Object} filter 原始过滤条件
   * @return {Object}        [description]
   */
  filterHandler(filter={}) {
    // time limit
    if (filter.startAt && filter.endAt) {
      filter.createdAt = {
        $gte: filter.startAt,
        $lt: filter.endAt
      }
      delete filter.startAt
      delete filter.endAt
    }

    // page limit
    const limit = filter.pageSize || 0
    const skip = limit * (filter.page || 0)
    delete filter.pageSize
    delete filter.page

    return {filter, limit, skip}
  }

  /**
   * 拉取数据
   * @param  {object} opt 拉取条件
   * @return {Array}      数据列表
   */
  async pull(filterOrigin={}) {
    debug('pull data', filterOrigin)

    if (!this.coll) {
      debug('no collection found when pull data')
      return []
    }

    const {filter, skip, limit} = this.filterHandler(filterOrigin)

    return new Promise((resolve, reject)=> {
      this.coll.find(filter).skip(skip).limit(limit).toArray((err, docs)=> {
        if (err) {
          return reject(err)
        }
        return resolve(docs)
      })
    })
  }

  /**
   * 数据量
   * @param  {Object} filter 过滤条件
   * @return {Number}        数据量
   */
  async count(filterOrigin={}) {
    debug('data count', filterOrigin)

    if (!this.coll) {
      debug('no collection found when pull data')
      return 0
    }

    const {filter, skip, limit} = this.filterHandler(filterOrigin)

    return new Promise((resolve, reject)=> {
      this.coll.find(filter).skip(skip).limit(limit).count((err, count)=> {
        if (err) {
          return reject(err)
        }
        return resolve(count)
      })
    })
  }
}


export default MongodbSaver
