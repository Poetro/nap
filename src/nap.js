(function(){

nap = {}
nap.web = newWeb
nap.negotiate = { 
  selector : bySelector
, ordered  : byOrdered
}

function noop(){}

var root = document.documentElement
  , matchesSelector = root.matchesSelector 
    || root.webkitMatchesSelector 
    || root.mozMatchesSelector 
    || root.msMatchesSelector 
    || root.oMatchesSelector

function is(n, s) {
  return matchesSelector.call(n, s);
}

function isFn(inst){
  return typeof inst === "function"
}

function isStr(inst){
  return typeof inst === "string"
}

function byOrdered(){
  var fns = [].slice.apply(arguments, [0])
  
  return function(req, res){
    var scope = this
    if(!fns.length){
      res("No handers specified")
      return
    }

    next([].concat(fns))

    function next(fns){
      var fn = fns.shift()
      if(!fn){
        res("All handlers failed")
        return
      }
      fn.apply(scope, [
        req
      , function(err, data){
          if(err){
            next(fns)
          } else {
            res(err, data)
          }
        }
      ])
    }
  }
}

function bySelector(){

  var options = [].slice.apply(arguments, [0])
    .reduce(
      function(curr, next){
        if(isStr(next)) curr.push({ selector : next })
        else curr[curr.length - 1].fn = next
        return curr
      }
    , []
    )
  
  return function(req, res){
    var node = this
      , called = false

    called = options.some(function(option){
      if(is(node, option.selector)){
        option.fn.apply(node, [req, res])
        return true
      }
    })

    if(!called){
      res("No matches found")
    }
  }
}

function newWeb(){
  var web = {}
    , view = document.documentElement
    , resources = {}
    , routes = rhumb.create()

  
  web.resource = function(name, ptn, handler){
    if(arguments.length == 1) return resources[name]

    if(arguments.length == 2) {
      handler = ptn
      ptn = name
    }

    resources[name] = {
      name : name
    , ptn : ptn
    , handler : handler
    }
    
    routes.add(ptn, function(params){
      return {
        fn : handler
      , params : params
      }
    })
    return web
  }

  web.req = function(path, cb){
    var match = routes.match(path)
    if(!match) throw Error(path + " not found")

    var req = pkg(path, match.params)
      , args = [req]
      , fn = match.fn
      , sync = false
    
    if(fn.length > 1) {
      args.push(isFn(cb) ? cb : noop)
    } else {
      sync = true
    }

    var ctx = this instanceof HTMLElement 
      ? this
      : view

    fn.apply(ctx, args);

    if(sync && isFn(cb)){ 
      cb() 
    }

    return web
  }

  web.view = function(val){
    if(!arguments.length) return view
    view = val
    return web
  }

  web.uri = function(name, params){

    // TODO: support all ptn types

    var meta = resources[name]

    if(!meta) throw new Error(name + " not found")

    var parts = rhumb._parse(meta.ptn)

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

  function pkg(path, params){
    return { uri : path, params : params }
  }
}

})()