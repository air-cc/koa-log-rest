import Koa from 'koa'
import RestLog from '../lib'
import supertest from 'supertest'
import mongodb from 'mongodb'


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
    }).then(()=> {
      done()
    }).catch(done)
  })
})

