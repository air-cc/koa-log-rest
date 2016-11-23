一个项目的日志应该包括：系统运行日志 和 用户操作日志

## 用户操作日志

> who at sometime do something and make something changed

###  数据结构

``` javascript
{
  userId: '',
  resource: '',
  operation: '',
  status: 1,
  createdAt: '',
  originRequest: {
    url: '',
    method: '',
    ip: '',
    userAgent: '',
    body: {}
  },
  originResponse: {
    statusCode: 200,
    body: {}
  },
}
```

### 策略
log 数据先缓存到本地，然后再根据一定的规则（比如：应用服务器不繁忙 && 本地资源积累到一定大小的时候）上传数据

### 提供的功能

#### 原始数据的操作
- 获取
- 暂存
- 等待上传规则
- 上传

#### 历史数据的操作
- 拉取 （根据不同条件拉取对应的数据）
- 统计功能 (暂不实现)
- 删除（暂不实现）

### 可拓展的接口 （暂未实现）
- upload reg (上传文件规则)
- database save function （上传文件功能自定义）
- log data extend （对上传数据结构的拓展）


### 供参考的第三方包
- koa-logger
- winston

