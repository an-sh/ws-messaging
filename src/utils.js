'use strict'

function hasOwnProperty (obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop)
}

function assign (target) {
  for (let i = 1; i < arguments.length; i++) {
    const source = arguments[i]
    if (!source) { continue }
    for (const key in source) {
      /* istanbul ignore else */
      if (hasOwnProperty(source, key)) {
        target[key] = source[key]
      }
    }
  }
  return target
}

function attempt (fn) {
  return Promise.resolve().then(fn)
}

function fromCallback (fn) {
  return new Promise((resolve, reject) => {
    fn((error, result) => {
      if (error) {
        reject(error)
      } else {
        resolve(result)
      }
    })
  })
}

module.exports = {
  assign,
  attempt,
  fromCallback,
  hasOwnProperty
}
