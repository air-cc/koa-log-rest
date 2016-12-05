一个项目的日志应该包括：系统运行日志 和 用户操作日志，这里是对用户操作日志的管理

## 用户操作日志

> who at sometime do something and make something changed

###  数据结构

``` javascript
{
  userId: '',           // 表示操作用户
  resource: '',         // 标识操作对象
  operation: '',        // 标识操作类型
  status: 1,            // 操作结果 1：成功 -1：失败 0：未知
  createdAt: '',        // 操作时间
  originRequest: {      // 请求相关原始数据
    url: '',
    method: '',
    ip: '',
    userAgent: '',
    body: {}
  },
  originResponse: {     // 响应相关原始数据
    statusCode: 200,
    body: {}
  },
}
```

### 策略
log 数据先缓存到本地，然后再根据一定的规则（比如：应用服务器不繁忙 && 本地资源积累到一定大小的时候）上传数据

### 提供的功能

##### 原始数据的操作
- 获取
- 暂存
- 等待上传规则
- 上传

##### 历史数据的操作
- 拉取 （根据不同条件拉取对应的数据）
- 统计功能 (暂不实现)
- 删除（暂不实现）

### 可拓展的接口 （暂未实现）
- upload reg (上传文件规则)
- database save function （上传文件功能自定义）
- log data extend （对上传数据结构的拓展）

### 示例

``` JavaScript
import Koa from 'koa'
import RestLog from 'restlog'

const koa = new Koa()

// 创建restLog
const restLog = new RestLog({
  dbSaver: {                            // 保存 logs 的远程服务器配置 (目前只支持 MongoDB)
    dbClient: MongoDBInstance,
    collectionName: 'demo'
  },
  getUserId: async (ctx)=> {           // 获取当前操作用户的 ID async 函数
    return 'test-user'
  },
  getResource async (ctx)=> {          // 获取当前操作资源的 ID async 函数
    return 'test-resource'
  },
  filter: (url)=> {                    // url 过滤，返回 `false` 表示该 url 不计入 logs 中
    return true
  },
  localPath: 'path/to/save/logs/temporary',   // 用于暂存 logs 的本地目录
  uploadCondition: {                   // 上传本地文件规则
    filesLimit: 2,                     // 本地 log 保存文件数限制 （以`天`来表示一个文件）
    fileSizeLimit: 10,                 // 本地 log 文件体积限制 (以 `KB` 为单位)
    fileExpireTime: 3 * 60,            // 本地文件过期时间（以`秒`为单位）
    intervalTime: 60,                  // 遍历本地log文件的间隔时间（以`秒`为单位）
  }
})

// 添加 koa 中间件
app.use(restLog.getMiddleware())


/**
 * 拉取历史 log 信息
 * restLog.search({startAt, endAt, userId, resource, operation, page, pageSize})
 */

app.listen()
```

### 供参考的第三方包
- koa-logger
- winston

