import should from 'should'
import supertest from 'supertest'
import Koa from 'koa'
import mongodb from 'mongodb'

import RestLog from '../lib'


describe('base usage', ()=> {
  let app
  let request
  let restLog

  before(function (done) {
    const self = this
    mongodb.connect('mongodb://localhost:27017/restlogtest', (error, db)=> {
      self.db = db
      done()
    })
  })

  before(function (done) {
    app = new Koa()
    restLog = new RestLog({
      dbSaver: {
        dbClient: this.db
      },
      getUserId: ()=> {'user-1'},
      getResource: ()=> {'users'},
    })
    app.use(restLog.getMiddleware())

    app.use((ctx)=> {
      ctx.status = 200
      ctx.body = {name: 'cc', age: '100'}
    })

    request = supertest.agent(app.listen(done))
  })

  it('save user operation info', (done)=> {
    request.get('/users/user-1')
      .expect(200)
      .end(done)
  })

  it('get user operation info', (done)=> {
    restLog.search({
      startAt: new Date('2016-01-01'),
      endAt: new Date()
    }).then((data)=> {
      data.should.be.an.Array()
      done()
    }).catch(done)
  })

  it('get users count', (done)=> {
    restLog.count({
      startAt: new Date('2016-01-01'),
      endAt: new Date()
    }).then((count)=> {
      count.should.be.a.Number()
      done()
    }).catch(done)
  })
})

