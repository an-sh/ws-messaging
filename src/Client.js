'use strict'
/* global WebSocket */

// Shared code for node and clients/browsers

const EventEmitter = require('eventemitter3')
const { assign, attempt, fromCallback } = require('./utils')

const blacklist = [ 'close', 'open', 'error', 'pong', 'retry' ]

// utils

const concat = [].concat.bind([])

const emit = EventEmitter.prototype.emit

function isBlacklistedEvent (name) {
  return blacklist.indexOf(name) >= 0
}

function getOwnProp (obj, name) {
  return obj.hasOwnProperty(name) ? obj[name] : undefined
}

// errors

/**
 * {@link Client#send}/{@link Client#invoke} is rejected with this
 * error when connection is closed before a message is send or reply
 * received (for `invoke` only).
 *
 * @class
 * @augments Error
 * @memberof Client
 * @param {number} [id] Message id.
 */
function ConnectionError (id) {
  this.name = 'ConnectionError'
  this.id = id
}

ConnectionError.prototype = Object.create(Error.prototype)

/**
 * {@link Client#invoke} is rejected with this error when no reply is
 * received before {@link Client.SocketOptions} `ackTimeout`.
 *
 * @class
 * @augments Error
 * @memberof Client
 * @param {number} id Message id.
 */
function TimeoutError (id) {
  this.name = 'TimeoutError'
  this.id = id
}

TimeoutError.prototype = Object.create(Error.prototype)

/**
 * {@link Client#invoke} is rejected with this error by the other side
 * when no handler is found for a procedure.
 *
 * @class
 * @augments Error
 * @memberof Client
 * @param {string} procedure Name.
 */
function NoProcedureError (procedure) {
  this.name = 'NoProcedureError'
  this.procedure = procedure
}

NoProcedureError.prototype = Object.create(Error.prototype)

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
    this.timeout = setTimeout(() => this.forceNack(new TimeoutError(id)), timeout)
  }

  forceNack (error) {
    clearTimeout(this.timeout)
    this.cb()
    this.reject(error)
  }

  settle (message) {
    clearTimeout(this.timeout)
    this.cb()
    if (message.hasOwnProperty('error')) {
      this.reject(message.error)
    } else {
      this.resolve(message.result)
    }
  }
}

// client

/**
 * General format for all data that is sent or received over a
 * websocket.
 *
 * @typedef {Object} Client.Message
 *
 * @property {number} [id]
 * @property {string} [name]
 * @property {Array} [args]
 * @property {Object} [result]
 * @property {Object} [error]
 */

/**
 * Messages encoder. May also return promises for an asynchronous
 * execution.
 *
 * @callback Client.Encoder
 * @param {Client.Message} message Message.
 * @return {Promise<Object>|Object} Data to send.
 */

/**
 * Messages decoder. May also return promises for an asynchronous
 * execution.
 *
 * @callback Client.Decoder
 * @param {Object} data Received data.
 * @return {Promise<Client.Message>|Client.Message} Message.
 */

/**
 * Receive hook is run when a client receives a valid message via a
 * websocket. May also return promises for an asynchronous execution.
 *
 * @callback Client.ReceiveHook
 * @param {Client.Message} message Message.
 * @return {Promise<undefined>|undefined} Promise, if it is rejected no
 * handlers will be called.
 */

/**
 * Send hook is run when a client sends any message via a
 * websocket. May also return promises for an asynchronous execution.
 *
 * @callback Client.SendHook
 * @param {Client.Message|Object} message Message or object if
 * `isEncoded` is `true`.
 * @param {boolean} isEncoded If a message has been already encoded
 * via {@link Client#encodeMessage} or {@link Server#encodeMessage}.
 * @return {Promise<undefined>|undefined} Promise, if it is rejected no
 * handlers will be called.
 */

/**
 * @typedef {Object} Client.RetryConfig
 *
 * @property {number} [factor=2]
 * @property {number} [maxTimeout=Infinity]
 * @property {number} [minTimeout=1000]
 * @property {boolean} [randomize=true]
 * @property {number} [retries=10]
 */

/**
 * @typedef {Object} Client.SocketOptions
 *
 * @property {number} [ackTimeout=20000] Result wait timeout for
 * {@link Client#invoke} in ms.
 * @property {Object} [auth={}] Auth data.
 * @property {boolean} [autoReconnect=true] Enable auto reconnect.
 * @property {Client.RetryConfig} [autoReconnectOptions] Auto
 * reconnect config.
 * @property {string} [binaryType='arraybuffer'] W3C WebSocket
 * binary data type.
 * @property {Client.Decoder} [decoder=JSON.parse] Messages decoder.
 * @property {Client.Encoder} [encoder=JSON.stringify] Messages
 * encoder.
 * @property {function} [errorFormatter=String] Converter for JS
 * errors to some network format.
 * @property {number} [pingInterval=20000] Ping interval in ms.
 * @property {number} [pingTimeout=20000] Ping timeout in ms.
 * @property {string|Array<string>} [protocols='ws-messaging']
 * WebSocket protocols.
 * @property {Client.ReceiveHook} [receiveHook] Receive hook.
 * @property {Client.SendHook} [rendHook] Send hook.
 * @property {boolean} [skipValidation=false] Skips build-in
 * messages validation.
 * @property {Object} [WebSocket=undefined] Alternative websocket
 * constructor, if it is undefined then a global WebSocket is used.
 * @property {boolean} [w3c=undefined] If WebSocket is using a w3c
 * send API, or a ws one (from Node.js server implementation with a
 * callback). By default if a global value is used, then it is `true`
 * and `false` otherwise.
 * @property {Object} [wsOptions] Additional options to pass to ws
 * socket constructor.
 */

const retryConfig = {
  factor: 2,
  maxTimeout: Infinity,
  minTimeout: 1000,
  randomize: true,
  retries: 10
}

const defaults = {
  ackTimeout: 20000,
  auth: {},
  autoReconnect: true,
  autoReconnectOptions: retryConfig,
  binaryType: 'arraybuffer',
  decoder: JSON.parse,
  encoder: JSON.stringify,
  errorFormatter: String,
  pingInterval: 20000,
  pingTimeout: 20000,
  protocols: 'ws-messaging',
  receiveHook: null,
  sendHook: null,
  skipValidation: false,
  WebSocket: undefined,
  w3c: undefined,
  wsOptions: undefined
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
   * Creates a client.
   *
   * @param {string} url WebSocket connection url.
   * @param {Client.SocketOptions} [options] Socket options.
   */
  constructor (url, options = {}) {
    super()
    this.url = url
    /**
     * Client id. Server-side only.
     * @member {number} id
     * @memberof Client
     * @instance
     * @readonly
     */
    assign(this, defaults, options)
    this.retryConfig = {}
    assign(this.retryConfig, retryConfig, options.autoReconnectOptions)
    if (!this.WebSocket) {
      this.WebSocket = WebSocket
      this.w3c = this.w3c === undefined ? true : this.w3c
    }
    /**
     * If true, then a client is connected.
     * @member {boolean}
     * @readonly
     */
    this.connected = false
    this.counter = 1
    this.data = {}
    this.handlers = {}
    this.pendingAcks = {}
    this.attempt = 0
    /**
     * If true, then a client was closed via a close method or an auth
     * error occurred.
     * @member {boolean}
     * @readonly
     */
    this.terminated = false
    this.register('ping', () => Promise.resolve())
    this.reconnect()
  }

  _onMessage (data) {
    let message
    attempt(() => this.decoder(data.data))
      .then(msg => { message = msg })
      .then(() => { if (!this.skipValidation) { validate(message) } })
      .then(() => { if (this.receiveHook) { return this.receiveHook(message) } })
      .then(() => this._dispatch(message))
    /**
     * Emitted when the other side failed to decode or validate a
     * websocket message, namely an error is occurred inside either
     * `decoder` or `receiveHook`.
     * @event Client#preprocessingError
     * @param {Object} error Converted error.
     */
      .catch(error => this.send('preprocessingError', this.errorFormatter(error)))
  }

  _setEvents () {
    /**
     * Emits w3c onopen WebSocket events.
     * @event Client#open
     */
    this.socket.onopen = emit.bind(this, 'open')
    /**
     * Emits w3c onerror WebSocket events. Does not throw if there are
     * no listeners.
     * @event Client#error
     * @param {Error} error Error.
     */
    this.socket.onerror = emit.bind(this, 'error')
    this.socket.onclose = this._onClose.bind(this)
    this.socket.onmessage = this._onMessage.bind(this)
  }

  _ping () {
    this.pingTimeoutId = setTimeout(() => {
      emit.call(this, 'ping')
      let timeout = this.pingTimeout
      let { message, promise } = this._makeMessage('ping', [], true, timeout)
      this._send(message).then(() => promise)
        .then(() => emit.call(this, 'pong'))
        .then(() => this._ping())
        .catch(() => this.close(4008, 'Ping timeout', false))
    }, this.pingInterval)
  }

  _isOpen () {
    return this.socket &&
      (this.socket.readyState === 0 || this.socket.readyState === 1)
  }

  _reconnect () {
    let { factor, maxTimeout, minTimeout, randomize, retries } = this.retryConfig
    if (this.attempt >= retries || this.terminated) { return }
    let rand = 1 + (randomize ? Math.random() : 0)
    let timeout = Math.min(rand * minTimeout * Math.pow(factor, this.attempt), maxTimeout)
    this.reconnectTimeoutId = setTimeout(this.reconnect.bind(this), timeout)
    this.attempt++
  }

  _open () {
    clearTimeout(this.reconnectTimeoutId)
    /**
     * Underlying websocket.
     * @member {WebSocket}
     * @readonly
     */
    this.socket = new this.WebSocket(this.url, this.protocols, this.wsOptions)
    if (this.w3c) { this.socket.binaryType = this.binaryType }
    this.connectHandler = () => {
      this.connected = true
      this.attempt = 0
      clearTimeout(this.authTimeoutId)
      this._ping()
    }
    this.openHandler = () => {
      this._send(this.auth, {isAuth: true})
      this.authTimeoutId = setTimeout(
        this.close.bind(this, 4008, 'Auth timeout', false),
        this.ackTimeout)
      this.once('connect', this.connectHandler)
    }
    this.once('open', this.openHandler)
    this._setEvents()
    if (this.attempt > 0) {
      /**
       * Emits retry events when auto reconnecting.
       * @event Client#retry
       * @param {number} attempt Attempt number starting from `1`.
       */
      emit.call(this, 'retry', this.attempt)
    }
  }

  _onClose (ev) {
    this.connected = false
    clearTimeout(this.pingTimeoutId)
    clearTimeout(this.authTimeoutId)
    clearTimeout(this.reconnectTimeoutId)
    this.off('connect', this.connectHandler)
    this.off('open', this.openHandler)
    if (ev.code === 4003 || !this.url) { this.terminated = true }
    for (let id in this.pendingAcks) {
      /* istanbul ignore else */
      if (this.pendingAcks.hasOwnProperty(id)) {
        let ack = this.pendingAcks[id]
        ack.forceNack(new ConnectionError(id))
      }
    }
    this.pendingAcks = {}
    if (!this.terminated && this.autoReconnect) { this._reconnect() }
    /**
     * Emits w3c onclose WebSocket events.
     * @event Client#close
     * @param {CloseEvent} data Close event data.
     */
    emit.call(this, 'close', ev)
  }

  _makeMessage (name, args, needsAck, ackTimeout = this.ackTimeout) {
    let promise, message
    message = {name, args}
    if (needsAck) {
      let id = this.counter++
      let ack = new Ack(id, ackTimeout, () => delete this.pendingAcks[id])
      this.pendingAcks[id] = ack
      promise = ack.promise
      message.id = id
    }
    return { message, promise }
  }

  /**
   * Socket connection is open and client has passed an auth
   * check. Client-side only.
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
            .then((result = null) => this._send({id, result}))
            .catch(error => this._send({id, error: this.errorFormatter(error)}))
        } else {
          let error = this.errorFormatter(new NoProcedureError(message.name))
          this._send({id, error})
        }
      } else {
        emit.apply(this, concat(message.name, message.args))
      }
    } else {
      let ack = this.pendingAcks[message.id]
      if (ack) { ack.settle(message) }
    }
  }

  _send (message, { skipEncoder = false, isAuth = false } = {}) {
    return attempt(() => this.sendHook ? this.sendHook(message, skipEncoder) : null)
      .then(() => skipEncoder ? message : this.encoder(message))
      .then(data => {
        if (!this.connected && !isAuth) {
          let id = skipEncoder ? undefined : message.id
          throw new ConnectionError(id)
        }
        if (this.w3c) {
          return this.socket.send(data)
        } else {
          let binary = typeof data !== 'string'
          return fromCallback(cb => this.socket.send(data, {binary}, cb))
        }
      })
  }

  /**
   * Send an event, no reply. Use {@link on} or {@link once} methods
   * to listen events on a recipient side. Reserved event names
   * (__MUST NOT__ be used): `connect`, `close`, `open`, `error`,
   * `ping`, `pong`, `retry`.
   * @param {string} event Event name.
   * @param {*} [args] Arguments.
   * @returns {Promise<undefined>} Resolves when a data has been sent.
   */
  send (event, ...args) {
    let { message } = this._makeMessage(event, args, false)
    return this._send(message)
  }

  /**
   * Send a message encoded by {@link Client#encodeMessage} or {@link
   * Server#encodeMessage}, useful for identical messages
   * broadcasting.
   * @param {Object} data Result of {@link Client#encodeMessage}.
   * @returns {Promise<undefined>} Resolves when a data has been sent.
   */
  sendEncoded (data) {
    return this._send(data, {skipEncoder: true})
  }

  /**
   * Encode a message for a later use with {@link Client#sendEncoded}.
   * Reserved event names (__MUST NOT__ be used): `connect`, `close`,
   * `open`, `error`, `ping`, `pong`, `retry`.
   * @param {string} event Event name.
   * @param {*} [args] Arguments.
   * @returns {Object} Encoded message.
   */
  encodeMessage (event, ...args) {
    let { message } = this._makeMessage(event, args, false)
    return attempt(() => this.encoder(message))
  }

  /**
   * Invoke an RPC procedure. Use {@link Client#register} method to
   * assign an RPC method handler. Reserved procedure names (__MUST
   * NOT__ be used): `connect`, `close`, `open`, `error`, `ping`,
   * `pong`, `retry`.
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
   * handler, so it throws an error on a duplicate handler
   * registration attempt. Use {@link Client#invoke} to call a method.
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
    this.terminated = false
    if (this._isOpen()) {
      // eslint-disable-next-line no-useless-return
      return
    } else if (this.WebSocket && this.url) {
      this._open()
    } else {
      throw new Error('Malformed configuration options')
    }
  }

  /**
   * Closes a client connection.
   * @param {number} [code=1000] Code as per WebSocket spec.
   * @param {string} [str] Optional string.
   * @param {boolean} [terminate=true] Disable reconnect.
   */
  close (code = 1000, str, terminate = true) {
    if (!this.terminated) {
      this.terminated = terminate
      if (this._isOpen()) { this.socket.close(code, str) }
    }
  }
}

/**
 * Alias for {@link Client#send}.
 * @method
 * @name Client#emit
 */
Client.prototype.emit = Client.prototype.send

/**
 * Alias for {@link Client#sendEncoded}.
 * @method
 * @name Client#emitEncoded
 */
Client.prototype.emitEncoded = Client.prototype.sendEncoded

Client.ConnectionError = ConnectionError
Client.NoProcedureError = NoProcedureError
Client.TimeoutError = TimeoutError

module.exports = Client
