# RestLog

[![Build status][travis-image]][travis-url]

auto manage web app log working with restful api

[中文](./README.zh.md)

## Data struct

``` JavaScript
{
  userId: '',
  resource: '',
  operation: '',        // operation type. default use HTTP methods get / post / put / delete
  status: 1,            // operation result. 1 - succeed, -1 - fail, 0 - unknown
  createdAt: '',
  originRequest: {      // original request data
    url: '',
    method: '',
    ip: '',
    userAgent: '',
    body: {}
  },
  originResponse: {     // original response data
    statusCode: 200,
    body: {}
  }
}
```

## Usage

``` JavaScript

import Koa from 'koa'
import RestLog from 'restlog'

const koa = new Koa()

// create restLog instance
const restLog = new RestLog({
  dbSaver: {                            // MongoDB config
    dbClient: MongoDBInstance,
    collectionName: 'demo'
  },
  getUserId: async (ctx)=> {           // get now user id
    return 'test-user'
  },
  getResource async (ctx)=> {          // get now resource (operation object) id
    return 'test-resource'
  },
  filter: (url)=> {                    // url filter, return false when this url do not need log
    return true
  },
  localPath: 'path/to/save/logs/temporary',   // local path for saving log
  uploadCondition: {                   // upload logs condition
    filesLimit: 2,                     //
    fileSizeLimit: 10,                 // KB
    fileExpireTime: 3 * 60,            // Second
    intervalTime: 60,                  // Second
  }
})

// add koa middleware
app.use(restLog.getMiddleware())


/**
 * pull log info
 * restLog.search({startAt, endAt, userId, resource, operation, page, pageSize})
 */

app.listen()
```

[travis-image]: https://img.shields.io/travis/koajs/csrf.svg?style=flat-square
[travis-url]: https://travis-ci.org/air-cc/restlog.svg?branch=master
