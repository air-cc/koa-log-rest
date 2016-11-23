import {promisifyAll} from 'bluebird'

import debugMod from 'debug'
const debug = debugMod('rest-log:mongodbSaver')

class MongodbSaver {

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
   * 拉取数据
   * @param  {object} opt 拉取条件
   * @return {[type]}     [description]
   */
  async pull(filter={}) {
    debug('pull data', filter)

    if (!this.coll) {
      debug('no collection found when pull data')
      return []
    }

    filter.createdAt = {
      $gte: filter.startAt,
      $lt: filter.endAt
    }

    const limit = filter.pageSize || 0
    const skip = limit * (filter.page || 0)

    delete filter.startAt
    delete filter.endAt
    delete filter.pageSize
    delete filter.page

    return new Promise((resolve, reject)=> {
      this.coll.find(filter).skip(skip).limit(limit).toArray((err, docs)=> {
        if (err) {
          return reject(err)
        }
        return resolve(docs)
      })
    })

  }
}


export default MongodbSaver
