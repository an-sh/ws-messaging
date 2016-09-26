'use strict'
/* eslint-env mocha */

const Buffer = require('safe-buffer').Buffer
const Client = require('../src/Client')
const EventEmitter = require('events')
const Server = require('../src/Server')
const WebSocket = require('ws')
const chai = require('chai')
const eventToPromise = require('event-to-promise')
const expect = chai.expect
const msgpack = require('msgpack-lite')
const utils = require('../src/utils')

const port = 8000
const url = `ws://localhost:${port}`

let server, client, GlobalWebSocket

function notReachable (error) {
  throw new Error(`This code should not be reachable ${error}`)
}

beforeEach(function () {
  GlobalWebSocket = global.Websocket
})

afterEach('cleanup', function () {
  delete global.Websocket
  if (GlobalWebSocket) { global.Websocket = GlobalWebSocket }
  let promise
  if (server) {
    promise = server.close()
    server = null
  }
  if (client) {
    client.close()
    client = null
  }
  return promise
})

describe('ws-messaging', function () {
  it('should spawn a server', function () {
    server = new Server({port})
    return eventToPromise(server, 'ready')
  })

  it('should connect to a server', function () {
    server = new Server({port})
    client = new Client(url, {WebSocket})
    return eventToPromise(client, 'connect')
  })

  it('should confirm auth with a connect hook', function () {
    let auth = { token: 'token' }
    let reply = { user: 'user' }
    let client, req
    function connectionHook (_client, _data) {
      client = _client
      req = _data
      return reply
    }
    server = new Server({port}, {connectionHook})
    client = new Client(url, {WebSocket, auth})
    return eventToPromise(client, 'connect').then(rep => {
      expect(client).instanceof(Client)
      expect(req).eql(auth)
      expect(rep).eql(reply)
    })
  })

  it('should reject auth with a connect hook', function () {
    let error
    function connectionHook () {
      error = new Error('Auth error')
      throw error
    }
    server = new Server({port}, {connectionHook})
    client = new Client(url, {WebSocket})
    return eventToPromise(client, 'close', {error: 'connect'})
      .then(ev => {
        expect(ev.code).eql(4003)
        expect(ev.reason).eql(error.toString())
        expect(client.terminated).true
      })
      .catch(notReachable)
  })

  it('should use global WebSocket if available', function () {
    let auth = { token: 'token' }
    let reply = { user: 'user' }
    let c, req
    function connectionHook (_client, _data) {
      c = _client
      req = _data
      return reply
    }
    server = new Server({port}, {connectionHook})
    global.WebSocket = WebSocket
    client = new Client(url, {auth})
    return eventToPromise(client, 'connect').then(rep => {
      expect(c).instanceof(Client)
      expect(req).eql(auth)
      expect(rep).eql(reply)
    })
  })

  it('should send messages from a client to a server', function () {
    let data = { x: 1 }
    let id
    function connectionHook (client) { id = client.id }
    server = new Server({port}, {connectionHook})
    client = new Client(url, {WebSocket})
    return eventToPromise(client, 'connect').then(() => {
      let c = server.getClient(id)
      client.send('someEvent', data)
      return eventToPromise(c, ('someEvent'))
    }).then(d => {
      expect(d).eql(data)
    })
  })

  it('should send messages from a server to a client', function () {
    let data = { x: 1 }
    let id
    function connectionHook (client) { id = client.id }
    server = new Server({port}, {connectionHook})
    client = new Client(url, {WebSocket})
    return eventToPromise(client, 'connect').then(() => {
      let c = server.getClient(id)
      c.send('someEvent', data)
      return eventToPromise(client, ('someEvent'))
    }).then(d => {
      expect(d).eql(data)
    })
  })

  it('should run a receive hook', function () {
    let id, run
    function connectionHook (client) { id = client.id }
    function receiveHook (client) { run = true }
    server = new Server({port}, {connectionHook})
    client = new Client(url, {WebSocket, receiveHook})
    return eventToPromise(client, 'connect').then(() => {
      let c = server.getClient(id)
      c.send('someEvent')
      return eventToPromise(client, ('someEvent'))
    }).then(d => {
      expect(run).true
    })
  })

  it('should invoke server procedures', function () {
    let data = { x: 1 }
    let result = { y: 2 }
    let arg
    function connectionHook (client) {
      client.register('someProcedure', _arg => {
        arg = _arg
        return result
      })
    }
    server = new Server({port}, {connectionHook})
    client = new Client(url, {WebSocket})
    return eventToPromise(client, 'connect')
      .then(() => client.invoke('someProcedure', data))
      .then(res => {
        expect(arg).eql(data)
        expect(res).eql(result)
      })
  })

  it('should return server procedure errors', function () {
    let error
    function connectionHook (client) {
      client.register('someProcedure', () => {
        error = new Error('Some error')
        throw error
      })
    }
    server = new Server({port}, {connectionHook})
    client = new Client(url, {WebSocket})
    return eventToPromise(client, 'connect')
      .then(() => client.invoke('someProcedure'))
      .then(notReachable)
      .catch(err => {
        expect(err.name).eql('RPCError')
        expect(err.errorData).eql(error.toString())
      })
  })

  it('should return NoProcedureError errors', function () {
    server = new Server({port})
    client = new Client(url, {WebSocket})
    return eventToPromise(client, 'connect')
      .then(() => client.invoke('someProcedure'))
      .then(notReachable)
      .catch(err => expect(err.errorData.name).eql('NoProcedureError'))
  })

  it('should send and receive binary messages', function () {
    let data = { x: 1, y: Buffer.from([1, 2, 3]) }
    let id
    function connectionHook (client) { id = client.id }
    let encoder = msgpack.encode
    let decoder = msgpack.decode
    server = new Server({port}, {connectionHook}, {encoder, decoder})
    client = new Client(url, {WebSocket, encoder, decoder})
    return eventToPromise(client, 'connect').then(() => {
      let c = server.getClient(id)
      client.send('someEvent', data)
      return eventToPromise(c, ('someEvent'))
    }).then(d => {
      expect(d).eql(data)
    })
  })

  it('should be able to close disconnected sockets', function () {
    let c
    function connectionHook (_client) {
      c = _client
    }
    server = new Server({port}, {connectionHook})
    global.WebSocket = WebSocket
    client = new Client(url)
    return eventToPromise(client, 'connect').then(() => {
      c.close()
      return eventToPromise(client, 'close').then(() => client.close())
    })
  })

  it('should close sockets on an auth timeout', function () {
    this.timeout(4000)
    this.slow(2000)
    server = new Server({port}, {authTimeout:1000})
    let socket = new WebSocket(url)
    return eventToPromise(socket, 'close').then(ev => {
      expect(ev.code).eql(4003)
    })
  })

  it('should be able to reconnect', function () {
    this.timeout(4000)
    this.slow(2000)
    let id
    function connectionHook (client) {
      if (!id) {
        id = client.id
        setTimeout(() => client.close(), 1000)
      }
    }
    server = new Server({port}, {connectionHook})
    client = new Client(url, {WebSocket})
    client.on('error', (e) => console.log(e))
    return eventToPromise(client, 'close').then(() => {
      client.reconnect()
      return eventToPromise(client, 'connect')
    })
  })

  it('should not add disconnected clients', function () {
    this.timeout(6000)
    this.slow(4000)
    function connectionHook (client) {
      return new Promise(resolve => setTimeout(resolve, 2000))
    }
    server = new Server({port}, {connectionHook})
    client = new Client(url, {WebSocket})
    return eventToPromise(client, 'open')
      .then(() => new Promise(resolve => setTimeout(resolve, 1000)))
      .then(() => client.close())
      .then(() => new Promise(resolve => setTimeout(resolve, 1000)))
  })
})

describe('ws-messaging validation', function () {
  it('should validate messages type', function () {
    server = new Server({port})
    client = new Client(url, {WebSocket})
    return eventToPromise(client, 'connect').then(() => {
      client.socket.send('arbitraryData')
      return eventToPromise(client, 'ParsingError')
    })
  })

  it('should validate message objects structure', function () {
    server = new Server({port})
    client = new Client(url, {WebSocket})
    let msg = { name: 'name', args: '' }
    return eventToPromise(client, 'connect').then(() => {
      client.socket.send(JSON.stringify(msg))
      return eventToPromise(client, 'ParsingError')
    })
  })

  it('should validate message objects field count', function () {
    server = new Server({port})
    client = new Client(url, {WebSocket})
    let msg = { name: 'name', args: [], data: 'data' }
    return eventToPromise(client, 'connect').then(() => {
      client.socket.send(JSON.stringify(msg))
      return eventToPromise(client, 'ParsingError')
    })
  })

  it('should validate ack messages id', function () {
    server = new Server({port})
    client = new Client(url, {WebSocket})
    let msg = { id: -1 }
    return eventToPromise(client, 'connect').then(() => {
      client.socket.send(JSON.stringify(msg))
      return eventToPromise(client, 'ParsingError')
    })
  })

  it('should validate ack messages data', function () {
    server = new Server({port})
    client = new Client(url, {WebSocket})
    let msg = { id: 1, data: 'data' }
    return eventToPromise(client, 'connect').then(() => {
      client.socket.send(JSON.stringify(msg))
      return eventToPromise(client, 'ParsingError')
    })
  })

  it('should validate if messages are Objects', function () {
    let encoder = msgpack.encode
    let decoder = msgpack.decode
    server = new Server({port}, null, {encoder, decoder})
    client = new Client(url, {WebSocket, encoder, decoder})
    let msg = 'data'
    return eventToPromise(client, 'connect').then(() => {
      client.socket.send(encoder(msg))
      return eventToPromise(client, 'ParsingError')
    })
  })

  it('should skip validation if the option is on', function () {
    let msg = { name: 'someEvent', field: 'data' }
    let id
    function connectionHook (client) { id = client.id }
    server = new Server({port}, {connectionHook})
    client = new Client(url, {WebSocket, skipValidation: true})
    return eventToPromise(client, 'connect').then(() => {
      let c = server.getClient(id)
      c.socket.send(JSON.stringify(msg))
      return eventToPromise(client, ('someEvent'))
    })
  })
})

describe('ws-messaging should ignore semantically incorrect data', function () {
  it('should ignore blacklisted events', function () {
    this.timeout(4000)
    this.slow(2000)
    let id
    function connectionHook (client) {
      id = client.id
    }
    server = new Server({port}, {connectionHook})
    client = new Client(url, {WebSocket})
    let msg = { name: 'retry', args: [] }
    return eventToPromise(client, 'connect').then(() => {
      let c = server.getClient(id)
      c.socket.send(JSON.stringify(msg))
      c.on('retry', () => notReachable())
      return new Promise(resolve => setTimeout(resolve, 1000))
    })
  })

  it('should ignore double connect events', function () {
    this.timeout(4000)
    this.slow(2000)
    let id
    function connectionHook (client) {
      id = client.id
    }
    server = new Server({port}, {connectionHook})
    client = new Client(url, {WebSocket})
    let msg = { name: 'connect', args: [] }
    return eventToPromise(client, 'connect').then(() => {
      let c = server.getClient(id)
      c.socket.send(JSON.stringify(msg))
      c.on('retry', () => notReachable())
      return new Promise(resolve => setTimeout(resolve, 1000))
    })
  })

  it('should ignore unregistered acks', function () {
    this.timeout(4000)
    this.slow(2000)
    let id
    function connectionHook (client) {
      id = client.id
    }
    server = new Server({port}, {connectionHook})
    client = new Client(url, {WebSocket})
    let msg = { id: 1, result: '' }
    return eventToPromise(client, 'connect').then(() => {
      let c = server.getClient(id)
      c.socket.send(JSON.stringify(msg))
      return new Promise(resolve => setTimeout(resolve, 1000))
    })
  })
})

describe('ws-messaging errors', function () {
  it('should check some client constructor options', function () {
    try {
      client = new Client()
    } catch (e) { return }
    notReachable()
  })

  it('should check for registered procedures before adding a new one', function () {
    server = new Server({port})
    client = new Client(url, {WebSocket})
    client.register('fn', () => {})
    try {
      client.register('fn', () => {})
    } catch (e) {
      return eventToPromise(client, 'connect')
    }
    notReachable()
  })

  it('should return timeout errors', function () {
    function connectionHook (client) {
      client.register('someProcedure', () => new Promise(() => {}))
    }
    server = new Server({port}, {connectionHook})
    client = new Client(url, {WebSocket, ackWaitTimeout: 10})
    return eventToPromise(client, 'connect')
      .then(() => client.invoke('someProcedure'))
      .then(notReachable)
      .catch(err => expect(err).instanceof(Client.TimeoutError))
  })

  it('should return connection errors for acks', function () {
    this.timeout(4000)
    this.slow(2000)
    function connectionHook (client) {
      client.register('someProcedure', () => new Promise(() => {}))
    }
    server = new Server({port}, {connectionHook})
    client = new Client(url, {WebSocket})
    return eventToPromise(client, 'connect')
      .then(() => {
        setTimeout(() => client.close(), 1000)
        return client.invoke('someProcedure')
      })
      .then(notReachable)
      .catch(err => expect(err).instanceof(Client.ConnectionError))
  })
})

describe('ws-messaging utils', function () {
  it('should reject promise on error', function () {
    return utils.fromCallback(cb => cb(new Error()))
      .then(notReachable)
      .catch(() => {})
  })

  it('should emit errors', function () {
    let ee = new EventEmitter()
    let fn = utils.toEmit(ee)
    let p = eventToPromise(ee, 'error')
    fn(new Error())
    return p
  })
})
