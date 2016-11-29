'use strict'

var semver = require('semver')

if (semver.lt(process.version, '6.0.0')) {
  module.exports = require('./lib/Server')
} else {
  module.exports = require('./src/Server')
}
