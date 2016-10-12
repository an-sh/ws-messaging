# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

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
