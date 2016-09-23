'use strict'

const Client = require('./Client')
const EventEmitter = require('events')
const WebSocket = require('ws')
const WebSocketServer = require('ws').Server
const uid = require('uid-safe')
const { CLOSE_FORBIDDEN, CLOSE_NORMAL } = require('./constants')
const { assign, attempt, fromCallback, toEmit } = require('./utils')

const defaults = {
  Server: WebSocketServer,
  connectionHook: null
}

/**
 * @extends EventEmitter
 *
 * @emits Server#ready
 * @emits Server#error
 */
class Server extends EventEmitter {

  /**
   * Connection hook is run when a client connects to a server. The
   * result is used as an auth reply data. May also return promises
   * for an asynchronous execution.
   *
   * @callback Server.ConnectionHook
   *
   * @param {Client} client Client.
   * @param {Object} auth Auth data.
   * @return {Promise<Object|undefined>|Object|undefined} Auth reply
   * data.
   */

  /**
   * @typedef {Object} ServerOptions
   * @memberof Server
   *
   * @property {Server.ConnectionHook} [connectionHook] Connection
   * hook.
   * @property {Object} [Server] Alternative constructor for wss
   * server.
   */

  /**
   * Starts a server.
   *
   * @param {Object} wssOptions Options that are passed to wss server.
   * @param {Server.ServerOptions} [serverOptions] Server options.
   * @param {Client.SocketOptions} [socketOptions] Socket options.
   */
  constructor (wssOptions, serverOptions = {}, socketOptions = {}) {
    super()
    this.socketOptions = { WebSocket }
    assign(this.socketOptions, socketOptions)
    assign(this, defaults, serverOptions)
    this.clients = new Map()
    this._setEvents(wssOptions)
  }

  _setEvents (wssOptions) {
    /**
     * Emits ready event.
     * @event Server#ready
     */
    this.wss = new this.Server(wssOptions, toEmit(this))
    /**
     * Emits wss error events.
     * @event Server#error
     * @param {Error} error Error.
     */
    this.wss.on('error', this.emit.bind(this))
    this.wss.on('connection', socket => this._onConnection(socket))
  }

  _onConnection (socket) {
    socket.once('message', data => this._addClient(socket, data))
  }

  _addClient (socket, data) {
    let client
    uid(18).then(id => {
      client = new Client(null, assign({socket, id}, this.socketOptions))
      if (this.connectionHook) {
        return attempt(() => client.decoder(data))
          .then(authData => this.connectionHook(client, authData))
      }
    }).then(authReplyData => {
      if (client._isOpen()) {
        client._setEvents()
        client.connected = true
        this.clients.set(client.id, client)
        client.on('close', () => this._removeClient(this.id))
        client.send('connect', authReplyData)
      }
    }).catch(error => {
      /* istanbul ignore else */
      if (client) {
        let str = error.toString()
        client.close(CLOSE_FORBIDDEN, str)
      }
    })
  }

  _removeClient (id) {
    this.clients.delete(id)
  }

  /**
   * Git a client by id.
   * @param {string} id Client id.
   * @returns {Client|undefined} Client if found.
   */
  getClient (id) {
    return this.clients.get(id)
  }

  /**
   * Closes a server.
   * @returns {Promise<undefined>} Promise.
   */
  close () {
    for (let [, client] of this.clients) {
      client.close(CLOSE_NORMAL)
    }
    this.clients.clear()
    return fromCallback(cb => this.wss.close(cb))
  }
}

module.exports = Server
