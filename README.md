# ws-messaging

[![NPM Version](https://badge.fury.io/js/ws-messaging.svg)](https://badge.fury.io/js/ws-messaging)
[![Build Status](https://travis-ci.org/an-sh/ws-messaging.svg?branch=master)](https://travis-ci.org/an-sh/ws-messaging)
[![Appveyor status](https://ci.appveyor.com/api/projects/status/d14wp6ei50tmqy49/branch/master?svg=true)](https://ci.appveyor.com/project/an-sh/ws-messaging)
[![Coverage Status](https://codecov.io/gh/an-sh/ws-messaging/branch/master/graph/badge.svg)](https://codecov.io/gh/an-sh/ws-messaging)
[![Dependency Status](https://david-dm.org/an-sh/ws-messaging.svg)](https://david-dm.org/an-sh/ws-messaging)
[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

Just a really thin abstraction layer on top of WebSocket for Node.js
and Web Browsers with Promise and EventEmitter based APIs.

### Features

- Send and receive notifications (events) via an EventEmitter API.

- Request-reply API using promises (works in both directions, without
  any connection blocking during processing).

- Built-in auth via WebSocket messages exchange (no more query
  strings).

- Auto reconnection is provided.

- Binary messages support via custom encoders/decoders.

- Reasonable client size: around 14KB minified, 5KB gziped.

## Table of Contents

- [Background](#background)
- [Installation](#installation)
- [Usage](#usage)
- [API](#api)
- [Network format description](#network-format-description)
- [Data validation](#data-validation)
- [Contribute](#contribute)
- [License](#license)


## Background

Read this
[article](https://medium.com/@an_sh_1/a-better-websocket-api-for-web-browsers-and-node-js-ws-messaging-6f7826242932)
for more background information.


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

const url = `ws://${HOST}:${PORT}`
const auth = { /* will be authData in connectionHook */ }

let client = new Client(url, {auth})

client.on('someEvent', (...data) => { /* do smth */ })

client.register('someMethod', (...args) => { /* do smth, return a promise */ })

client.on('connect', () => {
  /* now this client can send messages */
  client.send('myEvent', ...someData)
  /* or use request-reply (RPC) API */
  client.invoke('myMethod', ...someArgs)
    .then(result => { /* do smth */ })
    .catch(error => { /* do smth */ })
})
```

Essentially there are two usage patterns that are working in both
directions. Fire and forget via `send`/`on`, and RPC-style via
`invoke`/`register`. Unlike `on`, only a single handler function can
be registered per a method name.

## API

[Server API](https://an-sh.github.io/ws-messaging/1.0/Server.html) and
[Client API](https://an-sh.github.io/ws-messaging/1.0/Client.html)
documentation is available online.

## Network format description

This section describes what data is actually passed to an encoder.

There are only two types of messages. The first one is for normal
messages:

```javascript
{
  name: string,
  args: Array,
  id?: number
}
```

An `id` field is present for `invoke` calls. The second one is for
ack (replies for `invoke` calls) messages:

```javascript
{
  id: number
  result?: Object
  error?: Object
}
```

Either a `result` or an `error` field is included. Note that an
`error` is the value returned by an `errorFormatter`, by default
`String` is used as an `errorFormatter`.

## Data validation

All incoming data must be validated on a server side, including errors
that are passed to a catch callback. By default only the
[network format](#network-format-description) itself is
validated. Validation can be made by a custom decoder (useful when a
decoder is already using some scheme) or via a `receiveHook`, or
inside a handler itself (useful for registered procedures). When
validation is done inside `decoder`/`receiveHook`, just throw an error
or reject a promise to fail a validation and prevent handlers
execution. Also note that a promise returned by `invoke` can be
rejected locally either with `Client.ConnectionError` or with
`Client.TimeoutError`.

## Contribute

If you encounter a bug in this package, please submit a bug report to
github repo [issues](https://github.com/an-sh/ws-messaging/issues).

PRs are also accepted.

## License

MIT
