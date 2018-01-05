# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="1.0.0"></a>
# [1.0.0](https://github.com/an-sh/ws-messaging/compare/v0.8.0...v1.0.0) (2018-01-05)


### Bug Fixes

* remove Promise polyfill ([f28cdd0](https://github.com/an-sh/ws-messaging/commit/f28cdd0))


### BREAKING CHANGES

* remove Promise polyfill



<a name="0.7.2"></a>
## [0.7.2](https://github.com/an-sh/ws-messaging/compare/v0.7.1...v0.7.2) (2017-01-19)


### Bug Fixes

* actually fix async receiveHook handling ([66934c9](https://github.com/an-sh/ws-messaging/commit/66934c9))



<a name="0.7.1"></a>
## [0.7.1](https://github.com/an-sh/ws-messaging/compare/v0.7.0...v0.7.1) (2017-01-17)


### Bug Fixes

* don't ignore promises returned by the receiveHook ([4547cbf](https://github.com/an-sh/ws-messaging/commit/4547cbf))



<a name="0.7.0"></a>
# [0.7.0](https://github.com/an-sh/ws-messaging/compare/v0.6.0...v0.7.0) (2017-01-06)


### Bug Fixes

* don't allow sending data when client is not connected ([64e3cb2](https://github.com/an-sh/ws-messaging/commit/64e3cb2))


### Code Refactoring

* start attempts counting from 1 ([9f6da34](https://github.com/an-sh/ws-messaging/commit/9f6da34))
* tweak default ping settings ([0455477](https://github.com/an-sh/ws-messaging/commit/0455477))


### Features

* add encodeMessage to Server ([800d081](https://github.com/an-sh/ws-messaging/commit/800d081))
* add sendHook ([b5fc8ea](https://github.com/an-sh/ws-messaging/commit/b5fc8ea))
* add support for sending already encoded messages ([6c6d065](https://github.com/an-sh/ws-messaging/commit/6c6d065))
* emitEncoded alias for sendEncoded ([5baf109](https://github.com/an-sh/ws-messaging/commit/5baf109))
* pass additional options to ws socket constructor, fixes [#1](https://github.com/an-sh/ws-messaging/issues/1) ([32237ad](https://github.com/an-sh/ws-messaging/commit/32237ad))


### BREAKING CHANGES

* Start attempts counting from 1.
* Tweak default ping settings.



<a name="0.6.0"></a>
# [0.6.0](https://github.com/an-sh/ws-messaging/compare/v0.5.3...v0.6.0) (2016-11-29)


### Bug Fixes

* transpiled code usage on node 4.x ([f267ce9](https://github.com/an-sh/ws-messaging/commit/f267ce9))


### Chores

* update dependencies ([f7b8e54](https://github.com/an-sh/ws-messaging/commit/f7b8e54))


### BREAKING CHANGES

* Drop node 0.12 support.



<a name="0.5.3"></a>
## [0.5.3](https://github.com/an-sh/ws-messaging/compare/v0.5.2...v0.5.3) (2016-10-27)



<a name="0.5.2"></a>
## [0.5.2](https://github.com/an-sh/ws-messaging/compare/v0.5.1...v0.5.2) (2016-10-27)


### Features

* add client socket constructor customisation ([b9b76e0](https://github.com/an-sh/ws-messaging/commit/b9b76e0))



<a name="0.5.1"></a>
## [0.5.1](https://github.com/an-sh/ws-messaging/compare/v0.5.0...v0.5.1) (2016-10-21)



<a name="0.5.0"></a>
# [0.5.0](https://github.com/an-sh/ws-messaging/compare/v0.4.1...v0.5.0) (2016-10-12)


### Bug Fixes

* ensure usage of formatter for all errors ([bc2dfad](https://github.com/an-sh/ws-messaging/commit/bc2dfad))
* make getClient to work inside onConnect ([1121efa](https://github.com/an-sh/ws-messaging/commit/1121efa))


### Code Refactoring

* rename parsing error ([ebfa845](https://github.com/an-sh/ws-messaging/commit/ebfa845))


### BREAKING CHANGES

* Rename ParsingError to preprocessingError.
* Error formatter is used on all errors, ParsingError and
RPCError wrappers have been removed.



<a name="0.4.1"></a>
## [0.4.1](https://github.com/an-sh/ws-messaging/compare/v0.4.0...v0.4.1) (2016-10-09)


### Bug Fixes

* closing reconnecting client ([82ee47c](https://github.com/an-sh/ws-messaging/commit/82ee47c))



<a name="0.4.0"></a>
# [0.4.0](https://github.com/an-sh/ws-messaging/compare/v0.3.0...v0.4.0) (2016-10-09)


### Features

* auto reconnect ([9a36be2](https://github.com/an-sh/ws-messaging/commit/9a36be2))
* handle auth timeout on a client-side ([7645801](https://github.com/an-sh/ws-messaging/commit/7645801))


### BREAKING CHANGES

* auto reconnect is enabled by default



<a name="0.3.0"></a>
# [0.3.0](https://github.com/an-sh/ws-messaging/compare/v0.2.0...v0.3.0) (2016-09-28)


### Bug Fixes

* returning an empty result from RPC ([103d0e9](https://github.com/an-sh/ws-messaging/commit/103d0e9))
* use standalone bundle ([c6fca77](https://github.com/an-sh/ws-messaging/commit/c6fca77))


### Code Refactoring

* allow reconnect on terminated clients ([ab0b806](https://github.com/an-sh/ws-messaging/commit/ab0b806))
* rename option ([2d95d5e](https://github.com/an-sh/ws-messaging/commit/2d95d5e))
* rename option ([b117cc4](https://github.com/an-sh/ws-messaging/commit/b117cc4))


### Features

* emit errors without throwing on 0 listeners ([7675db2](https://github.com/an-sh/ws-messaging/commit/7675db2))
* send pings for network failures detection ([2c7ee8d](https://github.com/an-sh/ws-messaging/commit/2c7ee8d))
* separate ping timeout option ([0ba3ef3](https://github.com/an-sh/ws-messaging/commit/0ba3ef3))
* use emit as an alias for send ([a142bed](https://github.com/an-sh/ws-messaging/commit/a142bed))


### BREAKING CHANGES

* Server option is renamed to WebSocketServer.
* terminated state now is not checked by the reconnect
method.
* rename ackWaitTimeout to ackTimeout.
* emit method semantics changed.



<a name="0.2.0"></a>
# [0.2.0](https://github.com/an-sh/ws-messaging/compare/v0.1.2...v0.2.0) (2016-09-26)


### Features

* **server:** add an auth wait timeout ([990e91e](https://github.com/an-sh/ws-messaging/commit/990e91e))



<a name="0.1.2"></a>
## [0.1.2](https://github.com/an-sh/ws-messaging/compare/v0.1.1...v0.1.2) (2016-09-24)


### Bug Fixes

* **server:** actually remove client ([ec5adc9](https://github.com/an-sh/ws-messaging/commit/ec5adc9))


### Features

* **server:** add close code ([2d2608c](https://github.com/an-sh/ws-messaging/commit/2d2608c))



<a name="0.1.1"></a>
## [0.1.1](https://github.com/an-sh/ws-messaging/compare/v0.1.0...v0.1.1) (2016-09-23)


### Bug Fixes

* npm repo link ([71fa2f2](https://github.com/an-sh/ws-messaging/commit/71fa2f2))



<a name="0.1.0"></a>
# 0.1.0 (2016-09-23)


### Features

* initial release ([e5bf7b5](https://github.com/an-sh/ws-messaging/commit/e5bf7b5))
