'use strict'
// @flow

const Client = require('./Client')
const EventEmitter = require('events')
const WebSocket = require('ws')
const WebSocketServer = require('ws').Server
const uid = require('uid-safe')
const { CLOSE_FORBIDDEN } = require('./constants')
const { assign, attempt, fromCallback, toEmit } = require('./utils')

const defaults = {
  Server: WebSocketServer,
  connectionHook: null
}

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
type ConnectionHook = (client: Client, data?: any) => Promise<any>

/**
 * @typedef {Object} Server.ServerOptions
 *
 * @property {Server.ConnectionHook} [connectionHook] Connection
 * hook.
 * @property {Object} [Server] Alternative constructor for wss
 * server.
 */
type ServerOptions = { Server?: Class<any>, connectionHook?: ConnectionHook }

type SocketOptions = Object

/**
 * @extends EventEmitter
 *
 * @emits Server#ready
 * @emits Server#error
 */
class Server extends EventEmitter {
  Server: Class<any>
  clients: Map<string, Object>
  connectionHook: ConnectionHook
  socketOptions: Object
  wss: Object

  /**
   * Starts a server.
   *
   * @param {Object} wssOptions Options that are passed to wss server.
   * @param {Server.ServerOptions} [serverOptions] Server options.
   * @param {Client.SocketOptions} [socketOptions] Socket options.
   */
  constructor (wssOptions: Object,
               serverOptions: ServerOptions = {},
               socketOptions: SocketOptions = {}) {
    super()
    this.socketOptions = { WebSocket }
    assign(this.socketOptions, socketOptions)
    assign(this, defaults, serverOptions)
    this.clients = new Map()
    this._setEvents(wssOptions)
  }

  _setEvents (wssOptions: Object) : void {
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

  _onConnection (socket: EventEmitter) : void {
    socket.once('message', data => this._addClient(socket, data))
  }

  _addClient (socket: EventEmitter, data?: any) : void {
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
        client.on('close', () => this._removeClient(client.id))
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

  _removeClient (id: string) : void {
    this.clients.delete(id)
  }

  /**
   * Git a client by id.
   * @param {string} id Client id.
   * @returns {Client|undefined} Client if found.
   */
  getClient (id: string) : Client {
    return this.clients.get(id)
  }

  /**
   * Closes a server.
   * @param {code} [code=1000] Code as per WebSocket spec.
   * @returns {Promise<undefined>} Promise.
   */
  close (code: number = 1000) : Promise<void> {
    for (let [, client] of this.clients) {
      client.close(code)
    }
    this.clients.clear()
    return fromCallback(cb => this.wss.close(cb))
  }
}

module.exports = Server
