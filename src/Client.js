'use strict'
/* global WebSocket */

const EventEmitter = require('eventemitter3')
const { assign, attempt, fromCallback, Promise } = require('./utils')

const blacklist = [ 'close', 'open', 'error', 'retry' ]

// utils

const concat = [].concat.bind([])

function isBlacklistedEvent (name) {
  return blacklist.indexOf(name) >= 0
}

function getOwnProp (obj, name) {
  return obj.hasOwnProperty(name) ? obj[name] : undefined
}

// errors

function ConnectionError (id) {
  this.name = 'ConnectionError'
  this.id = id
}

ConnectionError.prototype = Object.create(Error.prototype)

function NoProcedureError (procedure) {
  this.name = 'NoProcedureError'
  this.procedure = procedure
}

NoProcedureError.prototype = Object.create(Error.prototype)

function ParsingError (errorData) {
  this.name = 'ParsingError'
  this.errorData = errorData
}

ParsingError.prototype = Object.create(Error.prototype)

function RPCError (errorData) {
  this.name = 'RPCError'
  this.errorData = errorData
}

RPCError.prototype = Object.create(Error.prototype)

function TimeoutError (id) {
  this.name = 'TimeoutError'
  this.id = id
}

TimeoutError.prototype = Object.create(Error.prototype)

// validation

function validateId (id) {
  return typeof id === 'number' && (id % 1) === 0 && id > 0
}

function validate (message) {
  let passed = false
  if (message instanceof Object) {
    if (message.name) { // message
      if (typeof message.name === 'string' && message.args instanceof Array) {
        let nprops = Object.keys(message).length
        if (nprops === 2 || (nprops === 3 && validateId(message.id))) {
          passed = true
        }
      }
    } else { // ack message
      let nprops = Object.keys(message).length
      if (nprops === 2 && validateId(message.id)) {
        if (message.hasOwnProperty('error') || message.hasOwnProperty('result')) {
          passed = true
        }
      }
    }
  }
  if (!passed) {
    throw new Error('Validation error')
  }
}

// ack

class Ack {
  constructor (id, timeout, cb) {
    this.id = id
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
    this.cb = cb
    this.timer = setTimeout(() => this.forceNack(new TimeoutError(id)), timeout)
  }

  forceNack (error) {
    clearTimeout(this.timer)
    this.cb()
    this.reject(error)
  }

  settle (message) {
    clearTimeout(this.timer)
    this.cb()
    if (message.hasOwnProperty('error')) {
      let error = new RPCError(message.error)
      this.reject(error)
    } else {
      this.resolve(message.result)
    }
  }
}

// client

const defaults = {
  ackWaitTimeout: 20000,
  auth: {},
  binaryType: 'arraybuffer',
  decoder: JSON.parse,
  encoder: JSON.stringify,
  errorFormatter: String,
  protocols: 'ws-messaging',
  receiveHook: null,
  skipValidation: false
}

/**
 * @extends EventEmitter
 *
 * @emits Client#close
 * @emits Client#open
 * @emits Client#error
 * @emits Client#connect
 */
class Client extends EventEmitter {

  /**
   * General format for all data that is sent or received over a
   * websocket.
   *
   * @typedef {Object} Message
   * @memberof Client
   *
   * @property {number} [id]
   * @property {string} [name]
   * @property {Array} [args]
   * @property {Object} [result]
   * @property {Object} [error]
   */

  /**
   * Messages decoder. May also return promises for an asynchronous
   * execution.
   *
   * @callback Client.Encoder
   * @param {Client.Message} message Message.
   * @return {Promise<Object>|Object} Data to send.
   */

  /**
   * Messages encoder. May also return promises for an asynchronous
   * execution.
   *
   * @callback Client.Decoder
   * @param {Object} data Received data.
   * @return {Promise<Client.Message>|Client.Message} Message.
   */

  /**
   * Receive hook is run when a client receives a message via a
   * websocket. May also return promises for an asynchronous
   * execution.
   *
   * @callback Client.ReceiveHook
   * @param {Client.Message} message Message.
   * @return {Promise<undefined>|undefined} Promise, if it is rejected no
   * handlers will be called.
   */

  /**
   * @typedef {Object} SocketOptions
   * @memberof Client
   *
   * @property {number} [ackWaitTimeout=20000] RPC ack wait timeout.
   * @property {Object} [auth={}] Auth data.
   * @property {string} [binaryType='arraybuffer'] W3C WebSocket
   * binary data type.
   * @property {Client.Decoder} [decoder=JSON.parse] Messages decoder.
   * @property {Client.Encoder} [decoder=JSON.stringify] Messages
   * decoder.
   * @property {function} [errorFormatter=String] Converter for JS
   * errors to some network format.
   * @property {string|Array<string>} [protocols='ws-messaging']
   * WebSocket protocols.
   * @property {Client.ReceiveHook} [receiveHook] Receive hook.
   * @property {boolean} [skipValidation=false] Skips build-in
   * messages validation.
   */

  /**
   * Creates a client.
   *
   * @param {string} url WebSocket connection url.
   * @param {Client.SocketOptions} options Socket options.
   */
  constructor (url, options = {}) {
    super()
    this.url = url
    /**
     * Client id. Server-side only.
     * @member {number}
     */
    this.id
    assign(this, defaults, options)
    if (!this.WebSocket) {
      this.WebSocket = WebSocket
      this.w3c = true
    }
    /**
     * If true, then a client is connected.
     * @member {boolean}
     */
    this.connected = false
    this.counter = 1
    this.data = {}
    this.handlers = {}
    this.pendingAcks = {}
    /**
     * If true, then a client was closed via a close method or an auth
     * error occurred.
     * @member {boolean}
     */
    this.terminated = false
    this.reconnect()
  }

  _onMessage (data) {
    let message
    attempt(() => this.decoder(data.data))
      .then(msg => { message = msg })
      .then(() => { if (!this.skipValidation) { validate(message) } })
      .then(() => { if (this.receiveHook) { this.receiveHook(message) } })
      .then(() => this._dispatch(message))
      .catch(error => {
        let data = new ParsingError(this.errorFormatter(error))
        this.send('ParsingError', data)
      })
  }

  _setEvents () {
    /**
     * Emits w3c onopen WebSocket events.
     * @event Client#open
     */
    this.socket.onopen = this.emit.bind(this, 'open')
    /**
     * Emits w3c onerror WebSocket events.
     * @event Client#error
     * @param {Error} error Error.
     */
    this.socket.onerror = this.emit.bind(this, 'error')
    this.socket.onclose = this._onClose.bind(this)
    this.socket.onmessage = this._onMessage.bind(this)
  }

  _isOpen () {
    return this.socket &&
      (this.socket.readyState === 0 || this.socket.readyState === 1)
  }

  _onClose (ev) {
    this.connected = false
    if (ev.code === 4003) { this.terminated = true }
    for (let id in this.pendingAcks) {
      /* istanbul ignore else */
      if (this.pendingAcks.hasOwnProperty(id)) {
        let ack = this.pendingAcks[id]
        ack.forceNack(new ConnectionError(id))
      }
    }
    this.pendingAcks = {}
    /**
     * Emits w3c onclose WebSocket events.
     * @event Client#close
     * @param {CloseEvent} data Close event data.
     */
    this.emit('close', ev)
  }

  _makeMessage (name, args, needsAck) {
    let promise, message
    message = {name, args}
    if (needsAck) {
      let id = this.counter++
      let ack = new Ack(id, this.ackWaitTimeout, () => delete this.pendingAcks[id])
      this.pendingAcks[id] = ack
      promise = ack.promise
      message.id = id
    }
    return { message, promise }
  }

  /**
   * Socket connection is open and client has passed an auth check.
   * @event Client#connect
   * @param {Object|undefined} data Auth reply data.
   */
  _dispatch (message) {
    if (message.name) {
      if (isBlacklistedEvent(message.name)) { return }
      if (message.name === 'connect' && this.connected) { return }
      if (message.id) {
        let id = message.id
        let fn = getOwnProp(this.handlers, message.name)
        if (fn) {
          attempt(() => fn.apply(null, message.args))
            .then(result => this._send({id, result}))
            .catch(error => this._send({id, error: this.errorFormatter(error)}))
        } else {
          this._send({id, error: new NoProcedureError(message.name)})
        }
      } else {
        this.emit.apply(this, concat(message.name, message.args))
      }
    } else {
      let ack = this.pendingAcks[message.id]
      if (ack) { ack.settle(message) }
    }
  }

  _send (message) {
    return attempt(() => this.encoder(message)).then(data => {
      if (this.w3c) {
        return this.socket.send(data)
      } else {
        let binary = typeof data !== 'string'
        return fromCallback(cb => this.socket.send(data, {binary}, cb))
      }
    })
  }

  /**
   * Send an event, no reply. Use `on` or `once` methods to listen
   * events on a recipient side.
   * @param {string} event Event name.
   * @param {*} [args] Arguments.
   * @returns {Promise<undefined>} Resolves when a data has been sent.
   */
  send (event, ...args) {
    let { message } = this._makeMessage(event, args, false)
    return this._send(message)
  }

  /**
   * Invoke an RPC procedure. Use `register` method to assign an RPC
   * handler.
   * @param {string} name Procedure name.
   * @param {*} [args] Arguments.
   * @returns {Promise<Object>} Resolves or rejects when a reply is
   * received.
   */
  invoke (name, ...args) {
    let { message, promise } = this._makeMessage(name, args, true)
    return this._send(message).then(() => promise)
  }

  /**
   * Register an RPC handler. Each name must have no more than a one
   * handler. Throws an error on a duplicate handler registration
   * attempt.
   * @param {string} name Procedure name.
   * @param {function} handler A function that returns a Promise.
   */
  register (name, handler) {
    if (getOwnProp(this.handlers, name)) {
      throw new Error(`Can't register a duplicate RPC handler for ${name}`)
    }
    this.handlers[name] = handler
  }

  /**
   * Reconnect. Client-side only.
   */
  reconnect () {
    if (this._isOpen() || this.terminated) {
      return
    } else if (this.WebSocket && this.url) {
      /**
       * Underlying websocket.
       * @member {WebSocket}
       */
      this.socket = new this.WebSocket(this.url, this.protocols)
      if (this.w3c) { this.socket.binaryType = this.binaryType }
      this.once('open', () => {
        this._send(this.auth)
        this.once('connect', () => { this.connected = true })
      })
      this._setEvents()
    } else {
      throw new Error('Malformed configuration options')
    }
  }

  /**
   * Closes a client connection.
   * @param {number} [code=1000] Code as per WebSocket spec.
   * @param {string} [str] Optional string.
   */
  close (code = 1000, str) {
    if (!this.terminated) {
      this.terminated = true
      if (this._isOpen()) { this.socket.close(code, str) }
    }
  }
}

Client.ConnectionError = ConnectionError
Client.RPCError = RPCError
Client.TimeoutError = TimeoutError

module.exports = Client
