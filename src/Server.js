// @flow
'use strict'

const Client = require('./Client')
const EventEmitter = require('eventemitter3')
const WebSocket = require('ws')
const WebSocketServer = require('ws').Server
const uid = require('uid-safe')
const { CLOSE_FORBIDDEN } = require('./constants')
const { assign, attempt, fromCallback } = require('./utils')

const defaults = {
  WebSocketServer,
  connectionHook: null,
  authTimeout: 20000
}

/**
 * Connection hook is run when a client connects to a server. The
 * result is used as an auth reply data. May also return promises for
 * an asynchronous execution. If the promise is rejected or an error
 * is thrown, then auth has failed and the socket will be closed.
 *
 * @callback Server.ConnectionHook
 *
 * @param {Client} client Client.
 * @param {Object} auth Auth data.
 * @return {Promise<Object|undefined>|Object|undefined} Auth reply
 * data.
 */
/* :: type ConnectionHook = (client: Client, data?: any) => Promise<any> */

/**
 * @typedef {Object} Server.ServerOptions
 *
 * @property {Server.ConnectionHook} [connectionHook] Connection
 * hook.
 * @property {Object} [WebSocketServer] Alternative constructor for ws
 * server.
 * @property {number} [authTimeout=20000] Auth message wait timeout in
 * ms.
 */
/* ::
type ServerOptions = { WebSocketServer?: constructor,
                       connectionHook?: ConnectionHook,
                       authTimeout?: number
                     }
*/

/* :: type SocketOptions = Object */

/**
 * @extends EventEmitter
 *
 * @emits Server#ready
 * @emits Server#error
 */
class Server extends EventEmitter {
  /* ::
  authTimeout: number
  WebSocketServer: constructor
  clients: Map<string, Object>
  connectionHook: ConnectionHook
  socketOptions: Object
  wss: Object
   */

  /**
   * Starts a server.
   *
   * @param {Object} wssOptions Options that are passed to ws server.
   * @param {Server.ServerOptions} [serverOptions] Server options.
   * @param {Client.SocketOptions} [socketOptions] Socket options.
   */
  constructor (wssOptions /* : Object */,
               serverOptions /* : ServerOptions */ = {},
               socketOptions /* : SocketOptions  */ = {}) {
    super()
    this.socketOptions = { WebSocket }
    assign(this.socketOptions, socketOptions)
    assign(this, defaults, serverOptions)
    this.clients = new Map()
    this._setEvents(wssOptions)
  }

  _setEvents (wssOptions /* : Object */) /* : void */ {
    /**
     * Emits a ready event.
     * @private
     * @event Server#ready
     */
    this.wss = new this.WebSocketServer(wssOptions, (error) => {
      error ? this.emit('error', error) : this.emit('ready')
    })
    /**
     * Emits wss error events. Does not throw if there are no
     * listeners.
     * @private
     * @event Server#error
     * @param {Error} error Error.
     */
    this.wss.on('error', this.emit.bind(this))
    this.wss.on('connection', socket => this._onConnection(socket))
  }

  _onConnection (socket /* : Object & EventEmitter */) /* : void */ {
    let timeout = setTimeout(
      socket.close.bind(socket, CLOSE_FORBIDDEN), this.authTimeout)
    socket.once('message', data => this._addClient(socket, data, timeout))
  }

  _addClient (socket /* : EventEmitter */,
              data /* : any */,
              timeout /* : number */) /* : void */ {
    let client
    clearTimeout(timeout)
    uid(18).then(id => {
      client = new Client(null, assign({socket, id}, this.socketOptions))
      client.autoReconnect = false
      this.clients.set(client.id, client)
      client.on('close', () => this._removeClient(client.id))
      if (this.connectionHook) {
        return attempt(() => client.decoder(data))
          .then(authData => this.connectionHook(client, authData))
      }
    }).then(authReplyData => {
      if (client._isOpen()) {
        client._setEvents()
        client.connected = true
        client.send('connect', authReplyData)
        client._ping()
      }
    }).catch(error => {
      /* istanbul ignore else */
      if (client) {
        let str = error.toString()
        client.close(CLOSE_FORBIDDEN, str)
      }
    })
  }

  _removeClient (id /* : string */) /* : void */ {
    this.clients.delete(id)
  }

  /**
   * Git a client by id.
   * @param {string} id Client id.
   * @returns {Client|undefined} Client if found.
   */
  getClient (id /* : string */) /* : Client */ {
    return this.clients.get(id)
  }

  /**
   * Closes a server.
   * @param {code} [code=1000] Code as per WebSocket spec.
   * @returns {Promise<undefined>} Promise.
   */
  close (code /* : number */ = 1000) /* : Promise<void> */ {
    for (let [, client] of this.clients) {
      client.close(code)
    }
    this.clients.clear()
    return fromCallback(cb => this.wss.close(cb))
  }
}

module.exports = Server
