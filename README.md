# ws-messaging

[![NPM Version](https://badge.fury.io/js/ws-messaging.svg)](https://badge.fury.io/js/ws-messaging)
[![Build Status](https://travis-ci.org/an-sh/ws-messaging.svg?branch=master)](https://travis-ci.org/an-sh/ws-messaging)
[![Appveyor status](https://ci.appveyor.com/api/projects/status/d14wp6ei50tmqy49?svg=true)](https://ci.appveyor.com/project/an-sh/ws-messaging)
[![Coverage Status](https://codecov.io/gh/an-sh/ws-messaging/branch/master/graph/badge.svg)](https://codecov.io/gh/an-sh/ws-messaging)
[![Dependency Status](https://david-dm.org/an-sh/ws-messaging.svg)](https://david-dm.org/an-sh/ws-messaging)
[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

Just a really thin abstraction layer on top of WebSocket for Node.js
and Web browsers with a Promises and EventEmitter based APIs.

### Features

- Send notifications via an EventEmitter-like API.

- Request-reply API using promises (works in both directions, without
  any connection blocking during processing).

- Built-in auth via WebSocket messages exchange (no more query
  strings).

- Reconnection method is provided.

- Binary messages support via custom encoders/decoders.

- Reasonable client size (14KB minified, including a Promise
  polyfill).

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API](#api)
- [Contribute](#contribute)
- [License](#license)

## Installation

```sh
npm i ws-messaging
```

## Usage

On a server:

```javascript
const Server = require('ws-messaging')

const port = 8000

function connectionHook (client, authData) {
  // check an authData
  // then assign client events handlers
  // return a promise
}

let server = new Server({port}, {connectionHook})
```

On a client:

```javascript
const Client = require('ws-messaging/client')

const url = `ws://localhost:${port}`

const auth = { /* will be authData in connectionHook */ }

let client = new Client(url, {auth})

client.on('someEvent', () => { /* do smth */ })

client.register('someMethod', () => { /* do smth, return a promise */ })

client.on('connection', () => {
  /* now this client can send messages */
  client.send('myEvent', ...someData)
  /* or use request-reply (RPC) API */
  client.invoke('myMethod', ...someArgs)
    .then(result => { /* do smth */ })
    .catch(error => { /* do smth */ })
})

client.on('close', () => {
  /* close, but a client is able to try to reconnect */
  if (!client.terminated) {
    setTimeout(client.reconnect.bind(client), 2000)
  }
})
```

See tests in `test/index.js` for more usage examples.

## API

[Server API](https://an-sh.github.io/ws-messaging/0.2/Server.html) and
[Client API](https://an-sh.github.io/ws-messaging/0.2/Client.html)
documentation is available online.


## Contribute

If you encounter a bug in this package, please submit a bug report to
github repo [issues](https://github.com/an-sh/ws-messaging/issues).

PRs are also accepted.

## License

MIT
