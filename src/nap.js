var rhumb = require('@websdk/rhumb')

var nap = { environment: {} }
  
nap.web = newWeb
nap.is = is
nap.into = into

nap.negotiate = { 
  selector : bySelector
, method   : dispatcher(uses(checkMethod, setMethod), errorsWith(405))
, accept   : dispatcher(uses(checkAcceptType, setContentType), errorsWith(415))
}

nap.responses = {
  ok : ok
, error : error
}

function noop(){}

function into(node) {
  return function(err, res) {
    if(res.statusCode != 200) return
    if(res.headers.contentType && res.headers.contentType != "application/x.nap.view") return
    if(!isFn(res.body)) return
    if(!node) return

    // TODO: This breaks d3; presumably because there's a discrepancy in domino CustomEvent vs. jsdom CustomEvent
    // node.dispatchEvent && node.dispatchEvent(new CustomEvent("update"))
    res.body(node)
  }
}

function is(n, s) {
  return n.matches(s)
}

function isFn(inst){
  return typeof inst === "function"
}

function isStr(inst){
  return typeof inst === "string"
}

function toArray(args) {
  return Array.prototype.slice.call(args)
}

function ok(data) {
  return {
    body : data
  , statusCode : 200
  , headers : {}
  }
}

function error(code) {
  return {
    statusCode : code
  , headers : {}
  }
}

function notFound(req, res) {
  res(null, error(404))
}

function dispatcher(wants, error) {
  return function(map) {
    var args = []
    Object.keys(map).forEach(function(key) {
      args.push(wants(key, map[key]))
    })
    args.push(error)
    return dispatch.apply(null, args)
  }
}

function uses(comparator, respond) {
  return function(key, fn) {
    return function(req, res) {
      if(comparator(req, key)) {
        fn.call(null, req, respond(key, res))
        return true
      }
    }
  }
}

function dispatch() {
  var fns = toArray(arguments)
  return function() {
    var args = toArray(arguments)
    return fns.some(function(fn) {
      return fn.apply(null, args)
    })
  }
}

function checkMethod(req, method) {
  return req.method == method
}

function setMethod(type, res) {
  return function(err, data) {
    data.method = type
    res(err, data)
  }
}

function checkAcceptType(req, type) {
  return req.headers.accept == type
}

function setContentType(type, res) {
  return function(err, data) {
    data.headers.contentType = type
    res(err, data)
  }
}

function errorsWith(code) {
  return function(req, res) {
    res(null, error(code))
    return true
  }
}

function bySelector(){

  var options = toArray(arguments)
    .reduce(
      function(curr, next){
        if(isStr(next)) curr.push({ selector : next })
        else curr[curr.length - 1].fn = next
        return curr
      }
    , []
    )
  
  return function(node, cb){
    var called = false
      , cb = cb || noop

    called = options.some(function(option){
      if(is(node, option.selector)){
        option.fn.call(null, node)
        cb(null, option.selector)
        return true
      }
    })

    if(!called) cb("No matching selector")
  }
}

function wrap(fn, stack) {
  return stack.reduce(middleware, fn)
}

function middleware(next, middle) {
  return function(req, res) {
    middle.call(null, req, res, next)
  }
}

function newWeb(){
  var web = {}
    , resources = {}
    , routes = rhumb.create()
    , middleware = []
  
  web.resource = function(name, ptn, handler, metadata) {
    if (arguments.length == 1) {
      return resources[name]
    } else if (arguments.length == 2) {
      handler = ptn
      ptn = name
    } else if (arguments.length == 3 && typeof handler !== 'function') {
      metadata = handler
      handler = ptn
      ptn = name
    }

    metadata || (metadata = {})

    handler = wrap(handler, middleware)

    resources[name] = {
      name : name
    , ptn : ptn
    , handler : handler
    , metadata : metadata
    }
    
    routes.add(ptn, function(params){
      return {
        fn : handler
      , params : params
      , metadata: metadata
      }
    })
    return web
  }

  web.find = find

  web.req = function(path, cb){
    var req = isStr(path) ? {uri: path} : path
      , cb = cb || noop
    
    req.web = web
    req.method || (req.method = "get")
    req.method == "get" && (delete req["body"])
    req.headers || (req.headers = {})
    req.headers.accept || (req.headers.accept = "application/x.nap.view")

    var match = find(req.uri) || { fn: wrap(notFound, middleware) }
    req.params = match.params
    match.fn.call(null, req, cb)
    return web
  }

  web.use = function() {
    if(!arguments.length) return web
    middleware = toArray(arguments).reverse().concat(middleware)
    return web
  }

  web.uri = function(ptn, params){

    var meta = resources[ptn]
    if(meta) ptn = meta.ptn
    var parts = rhumb._parse(ptn)

    return parts.reduce(
      function(uri, part){
        if(part.type == "var"){
          return [uri , params[part.input]].join("/")  
        }
        return [uri , part.input].join("/")  
      }
    , ""
    )
  }

  return web

  function find(path) {
    return routes.match(path)
  }
}

module.exports = nap