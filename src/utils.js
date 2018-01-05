'use strict'

function assign (target) {
  for (let i = 1; i < arguments.length; i++) {
    let source = arguments[i]
    if (!source) { continue }
    for (let key in source) {
      /* istanbul ignore else */
      if (source.hasOwnProperty(key)) {
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
  Promise
}
