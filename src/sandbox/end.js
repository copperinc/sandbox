let series = require('run-series')
let { join } = require('path')
let { existsSync } = require('fs')

module.exports = function end (server, callback) {
  let { events, http, inventory, tables } = server
  let { inv } = inventory

  // Set up promise if there is no callback
  let promise
  if (!callback) {
    promise = new Promise(function (res, rej) {
      callback = function (err, result) {
        err ? rej(err) : res(result)
      }
    })
  }

  series([
    function _httpServer (callback) {
      if (http) http.end(callback)
      else callback()
    },
    function _eventBus (callback) {
      if (events) events.end(callback)
      else callback()
    },
    function _dynamo (callback) {
      if (tables) tables.end(callback)
      else callback()
    },
    // Shut off any macro sandbox services
    function _macro (callback) {
      if (inv.macros) {
        let macroServices = inv.macros.map(name => {
          let macroPath = null
          let localPath = join(process.cwd(), 'src', 'macros', `${name}.js`)
          let localPath1 = join(process.cwd(), 'src', 'macros', name)
          let modulePath = join(process.cwd(), 'node_modules', name)
          let modulePath1 = join(process.cwd(), 'node_modules', `@${name}`)
          if (existsSync(localPath)) macroPath = localPath
          else if (existsSync(localPath1)) macroPath = localPath1
          else if (existsSync(modulePath)) macroPath = modulePath
          else if (existsSync(modulePath1)) macroPath = modulePath1
          // eslint-disable-next-line
          let macro = require(macroPath)
          return macro.end
        }).filter(end => end)
        if (macroServices.length) {
          series(macroServices, function (err) {
            if (err) callback(err)
            else callback()
          })
        }
        else callback()
      }
      else callback()
    }

  ], function closed (err) {
    if (err) callback(err)
    else {
      callback(null, 'Sandbox successfully shut down')
    }
  })

  return promise
}
