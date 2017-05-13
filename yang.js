(function(exports) {

/**
 * YANG data model driven UI core
 * copyright: Jimmy.Sun@alcatel-lucent.com (2017 ~ 2077)
 */

// taiji global setting
var settings = {
  useLabelExt: false,
  labelExt: "alu:ui-label",
  iconCM: {},
  hooks: {},
  /* mapping sni to component name */
  components: {}
}
// TODO: customer component creation via taiji:ui-component extension:
// anyxml device-config {
//   taiji:ui-component "config";
// }
//

// global functions
var trace = new function() {
  var enabled = true

  var log = function() {
    var s = ""
    for (var i in arguments) {
      var a = arguments[i]
      if (a instanceof Object) {
        s += JSON.stringify(a)
      } else {
        s += a
      }
    }
    if (enabled) {
      console.log(s);
    }
  }

  this.log = log
}

var PointWatcherService = function(interval) {
  var clients = []
  var watchers = []
  /*
   * client = {
   *   topic: ...
   *   el: ...
   *   getX: function(rect) ...
   *   getY: function(rect) ...
   *   handle: function(elem) ...
   * }
   * watcher = {
   *   topic: ...
   *   handle: function(output) ...
   * }
   */
  this.register = function(client) {
    //trace.log("PointWatcherService.register:"+client) 
    clients.push(client)
  }
  this.watch = function(watcher) {
    //trace.log("PointWatcherService.watch:"+watcher) 
    watchers.push(watcher)
  }
  function service() {
    clients.forEach(function(client) {
      var rect = client.el.getBoundingClientRect()
      var x = client.getX(rect)
      var y = client.getY(rect)
      //trace.log("PointWatcherService.x, y: "+x+","+y) 
      var elem = document.elementFromPoint(x, y)	
      var o = client.handle(elem)
      //trace.log("PointWatcherService.watchers.length="+watchers.length) 
      watchers.forEach(function(watcher) {
        if (watcher.topic == client.topic) {
          watcher.handle(o)
        }
      })
    })
  }
  setInterval(function() {
    service()
  }, interval)
}

PointWatcher = new PointWatcherService(1000)

Vue.directive('nav-ctxt', {
  inserted: function(el, binding, vnode) {
    PointWatcher.register({
      topic: binding.value, // passed from value
      el: el,
      getX: function(rect) {
    	var op = document.documentElement
    	//trace.log("el.offsetParent:"+op)
    	//trace.log("op.scrollWidth:"+op.scrollWidth)
    	//trace.log("rect.right:"+rect.right)
    	var x = Math.min(op.scrollWidth, rect.right)
    	//trace.log("x="+x)
    	// XXX: should minus padding-right, and nested data-tree...
        return x - 50
      },
      getY: function(rect) {
    	//return rect.top
    	//XXX: don't hard code
    	return 38
      },
      handle: function(elem) {
        //trace.log("nav-ctxt.handle:")
        var elem = $(elem)
        var node =  elem.closest(".yang-leaf, .yang-leaf-list, .yang-container, .yang-list, .yang-choice")
        if (node.length > 0) {
          var label = node.find("span.node-head:first span.label").text()
          //trace.log("node.label:"+label)
          var parents = node.parents("li")
          //trace.log("parents.length:"+parents.length)
          var ctxt = ""
          parents.each(function() {
            var label = $(this).find("span.node-head:first span.label").text()
            ctxt = label.trim() + "/" + ctxt
          })
          //trace.log("ctxt: "+ctxt) 
          return ctxt
        }
        return null
      }
    })
  }
})

/**
 * TODO: 1) need be able to remove instance data which is not schemaed 2)
 */

Vue.directive('autosize', {
  bind: function(el, binding, vnode) {
	//trace.log("el.type="+el.type)
	if (el.type == 'text' || el.type == 'number') {
      var os = el.size
      el.onfocus = function() {
        var noc = el.value.length || 1
        //el.size = noc + 8
        var w = noc*0.61+2
        w = w < 10 ? 10 : w
        el.style.width = w + "em"
      }
      el.onblur = function() {
        el.style.width = "auto"
        var noc = el.value.length || 1
        //trace.log("2blur: input[type="+el.type+"] noc:"+noc)
        //el.size = noc + 8
        var w = noc*0.61+2
     	  el.style.width = w + "em"
      }
      el.onblur()
    }
  }
})

/*
 * Vue.directive('yang-common', { update: function(el, binding, vnode) {
 * trace.log("yang-common called") trace.log("yang-schema: ",this.schema) if
 * (this.schema.mandatory) { el.classList.add("mandatory") } if
 * (this.schema.stateData) { el.classList.add("stateData") } } })
 */

// TODO: 
var components = function(schema, attr) {
  return '<component v-for="s in '+schema+'" v-if="componentShow(s)" :is="componentName(s)" :schema="s" :key="s.name" ' + attr + '></component>'
}

var datanode = function(name, sni, options) {
  Vue.component(name, options)
  settings.components[sni] = name
}

var Base = {
  created: function() {
    //trace.log("Base.created:")
  },
  data: function () {
    return {
      variables: {
      },
      status: {
        warning: null,
        error: null,
        progress: null,
        info: null
      }
    }
  },
  computed: {
  },
  methods: {
    closest: function(name) {
      var p = this.$parent
      while (p && p.$options.name != name) {
        p = p.$parent
      }
      return p
    },
    find(xpath) {
      //return (new taiji.xpath.XPath(xpath)).eval(this)
      trace.log("find:xpath="+xpath)
      var path =  new taiji.xpath.XPath(xpath)
      return path.eval(this) 
    },
    //XXX: move below 2 to DataNode
    componentName(schema) {
      var name = settings.components[this.sni+"/"+schema.name] || schema.node
      return name
    },
    componentShow(schema) {
      var filter = this.datatree.filter
      if (filter) {
        if (filter.sni) {
          var sni = this.sni
          if (this.schema.node != "list" || this.schema.key.indexOf(schema.name) == -1) {
            sni += "/"+schema.name
          }
          var b
          if (sni.length < filter.sni.length) {
            b = filter.sni.startsWith(sni)
          } else {
            b = sni.startsWith(filter.sni)
          }
          //trace.log("filter.sni="+filter.sni+"#?#"+sni+"=>"+b)
          return b
        }
      }
      return true
    },
    getChild(name) {
      //trace.log("Base.getChild:"+name+"|"+this.$options.name)
      var hist = ""
      for (var i in this.$children) {
        var node = this.$children[i]
        hist += "???"+node.schema.name
        if (node.schema && node.schema.name == name) {
          return node
        }
      }
      trace.log("["+this.dri+"].getChild:"+name+"|"+this.dri+" =>null |hist="+hist)
    },
    setVar: function(name, value) {
      //trace.log("Base.setVar:"+name+","+value+"|<=",this.variables)
      var v = this.variables[name]	
      if (! v) {
        Vue.set(this.variables, name, {value: value})
      } else {
        //Vue.set(v, 'value', value) 
        v.value = value
      }
    },
    getVar: function(name) {
      //trace.log("Base.getVar:"+name+"|<=",this.variables)
      var v = this.variables[name]	
      if (! v) {
        Vue.set(this.variables, name, {value: undefined})
        //return undefined
        return this.variables[name].value
      } else {
        return v.value 
      }
    },
    setStatus(status, value) {
      this.status[status] = value	
      // TODO: support status propagation.
    },
    getModelAsJSON() {
      return JSON.stringify(this.model)
    },
    getModelCloned() {
      return JSON.parse(JSON.stringify(this.model))
    },
    toString() {
      return "<{"+this.dri+"}>"
    }
  }
}

var DataTreeRoots = function() {
  var nss = {}
  this.add = function(datatree, tns) {
    tns = tns || "::"
    var members = nss[tns]
    if (! members) {
      members = []
      nss[tns] = members
    }
    members.push(datatree)
  }
  this.rmv = function(tns, datatree) {
    tns = tns || "::"
    var members = nss[tns]
    var idx = members.indexOf(datatree)
   	members.splice(idx, 1)
  }
  this.getAll = function(tns) {
    tns = tns || "::"
    var members = nss[tns]
    /*
	trace.log("------------ DataTreeRoots:getAll:----------", members.length)
    var all = []
    for (var i in members) {
      var m = members[i]
      all = all.concat(m.$children)
	}
	trace.log("------------ DataTreeRoots:getAll:----------", all.length)
	*/
	return members
  }
}

var Roots = new DataTreeRoots()

var DataTree = {
  name: 'data-tree',
  mixins: [Base],
  props: {
	/*
	 * schema: { type: Array, default: function() { return [] } }, model: {
	 * type: Object, default: function() { return {} } },
	 */
	pmodel: {
      type: Object
	},
	isSub: {
      type: Boolean,
      default: false
	},
	filter: { // {filter: {sni="/foo/bar"}}
      type: Object
	},
    rr: {
      /* RESTCONF resource root */
      type: String
    },
    ss: {
      /* TAIJI schema selector */
      type: String
    },
    tns: {
      /* tree namespace */
      type: String
    },
    shareable: {
      type: Boolean,
      default: false
    },
    showHead: {
      type: Boolean,
      default: true
    },
    options: {
      nodeOpenDefault: true
    },
    debug:  false
  },
  beforeCreate: function() {
  },
  created: function() {
    Roots.add(this, this.tns)
    //trace.log("data-tree created:", this.model)
    if (this.ss) {
       this.loadSchema(this.ss)
    }
    this.$on("export", function(evt) {
      trace.log("got event:",evt)	
    })
  },
  updated: function() {
    //trace.log("data-tree updated:")
  },
  destroyed: function() {
    Roots.rmv(this.tns, this)
  },
  data: function () {
    // console.log("data-tree.data:", this.model)
    return {
      schema: [],
      model:  this.pmodel || {},
      selected: [],
      changed: null, // TODO: null
      search: null
    }
  },
  computed: {
    datatree: function() {
      return this
    },
    roots: function() {
      //return Roots.getAll(this.tns)
      return [this]
    },
    // data resource identifier
    dri: function() {
      return ""
    },
    sni: function() {
      return ""
    },
    classMap: function() {
      return {
      }
    }
  },
  methods: {
    loadSchema: function(ss) {
      trace.log("data-tree:loadSchema - ss:", ss);
      var self = this
      $.ajax({
        method: "GET",
        accepts: {
          json: "application/json"
        },
        url: ss,
        dataType: "json"
      }).done(function(schema) {
        //trace.log("data-tree:loadSchema - schema:", schema);
        self.schema = schema
        self.loadData(schema)
      }).fail(function(xhr, status, error) {
        trace.log("data-tree:loadSchema - failed:", xhr.responseText, "|", error);
        self.handleError(xhr, status, error)
      }).always(function() {
      })
    },
    loadData: function(schema) {
      if (this.pmodel) {
        trace.log("data-tree:pmodel present");
        this.init(this.pmodel)
      }
      if (this.isSub) { // sub-tree of other data-tree. don't load data
        return
      }
      if (!this.rr) {
    	// no rr don't load data
        return
      }
      // TODO: support load datastore resource at once?
      for (var i in schema) {
        var sn = schema[i] 
        var url = this.rr + "/data/" + sn.name
        this.loadTop(url)
      }
    },
    loadTop: function(url) {
      trace.log("loadTop:"+url)
      var self = this
      $.ajax({
        method: "GET",
        accepts: {
          json: "application/yang.data+json"
        },
        url: url,
        dataType: "json"
      }).done(function(data) {
        trace.log("data-tree:load OK:", data);
        self.init(data)
      }).fail(function(xhr, status, error) {
        trace.log("data-tree:load failed: "+status +" :\n", xhr.responseText, "|", error);
        self.handleError(xhr, status, error)
      }).always(function() {
      });
    },
    refreshData: function() {
      this.loadData(this.schema)
    },
    saveData: function() {
      for (var k in this.model) {
        var v = this.model[k]
        trace.log("saveData: "+k, v)
        // TODO: check RESTCONF, if we can pass model json directly
        var json = {}
        json[k] = v
        this.save(k, JSON.stringify(json))
      }
    },
    save: function(dri, json) {
      var self = this
      // XXX: PATCH does not work. have vroot presented
      trace.log('PUT ',dri," = ",json)
      $.ajax({
        method: "PUT",
        url: this.rr + "/data/" + dri,
        contentType: "application/yang.data+json",
        data: json
      }).done(function(msg) {
        trace.log("--- done: "+msg);
        self.changed = false
      }).fail(function(xhr, status, error) {
        self.handleError(xhr, status, error)
      })
    },
    init: function(data) {
      trace.log("init:"+data)
      if (this.merge(data)) {
        trace.log("data-tree:load model:", this.model);
        this.$nextTick(function () {
          trace.log("updated...") // => 'updated'
          this.changed = false
        })
      }
    },
    merge: function(data) {
      trace.log("merge:",data)
      var r = false
      for (var k in data) {
        r = true
        //this.model[k] = data[k]
    	//trace.log("merge: "+k, data[k])
        Vue.set(this.model, k, data[k])
      }
      return r
    },
    handleError: function(xhr, status, error) {
      trace.log("--- fail: "+status+"|"+error+"|"+xhr.responseText)
      var em = error
      if (error != "Not Found") {
    	try {
          var rpcErrs =  JSON.parse(xhr.responseText)
          trace.log("restconf:errors", rpcErrs)
          var rpcErr = rpcErrs["ietf-restconf:errors"]["error"]
          // TODO: more rpc error structure case to handle
          // error might be array
          var em = rpcErr["error-message"]
    	} catch (e) {
    	}
      } else {
      }
      this.setStatus('error', status+" - " + em)
    },
    positionDesc: function(selected) {
    },
    select: function(vm) {
      if (this.$parent.datatree) {// sub-tree
    	// this will support single mode across data-trees
        this.$parent.datatree.select(vm)
      }
      console.log("select:"+vm.dri)
      this.selected.forEach(function(vm) {
        vm.selected = false
      })
      // for now only support single mode
      this.datatree.selected = [vm]
    }
  },
  watch: {
    search: function(val, old) {
      trace.log("search is now:"+val+" < "+old)
    },
    model: {
      handler: function(val, old) {
        //trace.log("changed=",this.changed)
        if (this.changed == false) {
    	   this.changed = true
        }
        if (this.debug) {
           //trace.log("data-tree is now:",val)
        }
        this.$emit('changed', val)
      },
      deep: true
    },
    ss: {
      handler: function(val, old) {
        //trace.log("data-tree ss is now:",val," old:",old)
        if (this.ss) {
          this.loadSchema(this.ss)
        }
      }
    }
  },
  template: '<ul class="data-tree" :class="classMap">'+
    '<span class="data-tree-head" v-show="showHead">' +
     ' <i class="fa fa-search"></i>' +
     '<input type="text" v-model="search" placeholder="search" class="search" v-autosize></input>\n' +
     '<a class="btn btn-save" @click="saveData" v-show="changed"><i class="fa fa-save"></i> Save</a>\n' +
     '<a class="btn btn-refresh" @click="refreshData"><i class="fa fa-refresh"></i> Refresh</a>\n' +
     '<span class="status-error" v-if="status.error">{{status.error}}</span>' +
    '</span>' +
      components('schema', '') +
    '</ul>'
}

Vue.component('data-tree', DataTree)

// ////////////////////////////
// common data node mixin
// ////////////////////////////
var DataNode = {
  mixins: [Base],
  props: ['schema', 'pmodel'],
  created: function() {
    if (this.hook4created) {
      this.hook4created.apply(this)
    }
    this.syncVar()
  },
  data: function() {
    return {
      //open: this.datatree.options.nodeOpenDefault,
      open: true,
      // if node is selected
      selected: false
      // if any info to be shown to user
    }
  },
  computed: {
    hook4created: function() {
      return settings.hooks.created && (settings.hooks.created[this.sni] || settings.hooks.created['*'])
    },
    dri: function() {
      return this.$parent.dri+"/"+this.schema.name
    },
    sni: function() {
      return this.$parent.sni+"/"+this.schema.name
    },
	model: {
      set: function(obj) {
        obj = this.autocast(obj)
        //trace.log(">>model.set:"+obj)
        Vue.set(this.pm, this.schema.name, obj)
        this.syncVar()
      },
      get: function() {
        var obj = this.pm[this.schema.name]
        if (obj == undefined && this.default) {
          obj = this.default
          Vue.set(this.pm, this.schema.name, obj)
        }
        var nobj = this.autocast(obj)
        if (nobj !== obj) {
          // need make new create object reactive
          this.model = nobj
        }
        return nobj
      }
	},
    pm: function() {
      return (this.pmodel || this.$parent.model)
    },
    fromWithinToAdd: function() {
      return this.$parent && this.$parent.fromWithinToAdd
    },
    datatree: function() {
      return this.$parent.datatree
    },
    label: function() {
      if (! settings.useLabelExt) {
        return this.schema.name	
      }
      var le = settings.labelExt
      return this.schema["taiji:ui-label"] || (le && this.schema[le]) || this.schema.name	
    },
    hidden: function() {
      return false
    },
    readonly: function() {
      return this.schema.readonly == true
    },
    highlighted: function() {
      var s = this.datatree.search
      if (s) {
        if (this.label.indexOf(s)>=0) {
          this.show()
          return true;
        }
      }
      return false;
    },
    shareable: function() {
      return this.datatree.shareable
    },
    classMap4Node: function() {
      return {
        "mandatory": this.schema.mandatory,
        "stateData": this.schema.stateData,
        "key":       this.isKey,
        "open":      this.open === true,
        "closed":    this.open === false,
        "selected":  this.selected,
        "readonly":  this.readonly,
        "hidden":    this.hidden,
        "highlighted": this.highlighted,
        "to-add":    this.isToAdd
      }
    },
    classMap4Icon: function() {
      var map = this.classMap4IconExt || this.classMap4IconDefault
      map["fa fa-fw"] = true
      map['status-error'] = this.status.error
      return map
    },
    classMap4IconDefault() {
    },
    classMap4IconExt: function() {
      return settings.iconCM[this.sni]
    },
    classMap4CO: function() {
      return {
        "fa fa-fw": true,
        "no-child fa-square-o": !this.hasChild,
        "fa-minus-square-o":    this.hasChild && this.open === true,
        "fa-plus-square-o":     this.hasChild && !this.open
      }
    },
    class4Pad: function() {
      return "no-child fa-square-o"
    },
    showTooltips: function() {
      return this.selected
    }
  },
  methods: {
    autocast(obj) {
      return obj
    },
    select() {
      this.selected = true
      this.datatree.select(this)
    },
    show() {
      var p = this.$parent 
      while (p) {
        p.open = true
        p = p.$parent
      }
    },
    /*
    find(xpath) { // TODO: use Base one
      trace.log("find:xpath="+xpath)
      var path =  new taiji.xpath.XPath(xpath)
      return path.eval(this) 
    },
    */
    // XXX: below method can be covered by find
    parent(sni) {
      trace.log("parent("+sni+")")
      var p = this.$parent
      while (p && p.sni != undefined && p.sni != sni) {
    	trace.log("p.sni: "+p.sni+" <-> "+sni)
        p = p.$parent
      }
      trace.log("parent("+sni+")=>"+p)
      return p.sni ? p : null
    },
    toggle: function() {
      if (this.hasChild) {
        this.open = !this.open
      }
    },
    edit: function(method, dri, json) {
      // TODO: check is called from within new Added List Item
      trace.log("edit: "+method+" "+dri+" json=",json)
      if (json instanceof Object) {
        json =  JSON.stringify(json)
      }
      var self = this
      return $.ajax({
        method: method,
        url: this.datatree.rr + "/data" + dri,
        contentType: "application/yang.data+json",
        data: json
      }).done(function(msg) {
        trace.log("--- done: "+msg);
      }).fail(function(xhr, status, error) {
        trace.log("--- fail: "+xhr.responseText)
        var rpcErr =  JSON.parse(xhr.responseText)
        trace.log("rpc-error", rpcErr)
        var em = rpcErr["ietf-restconf:errors"]["error"]["error-message"]
        // TODO: more rpc error structure case to handle
        self.setStatus('error', status+" - " + em)
      })
    },
    syncVar: function() {
	  var dvar = this.schema["taiji:data-variable"]
	  if (dvar) {
	    //trace.log("== syncVar="+dvar)
	    this.setVar(dvar, this.model)
	  }
    },
    toExport: function() {
      var hook = settings.hooks.toExport && (settings.hooks.toExport[this.sni] || settings.hooks.toExport['*'])
      if (hook) {
        hook.apply(this)
      }
    },
    toImport: function() {
      var hook = settings.hooks.toImport && (settings.hooks.toImport[this.sni] || settings.hooks.toImport['*'])
      if (hook) {
        hook.apply(this)
      }
    }
  },
  watch: {
    selected: function(val, old) {
    	/*
      if (val) {
        console.log("selected is:"+val)
        this.datatree.selected.forEach(function(vm) {
          vm.selected = false
        })
        this.datatree.selected.push(this)
      } else {
        this.datatree.selected.splice(this, 1)
      }
      */
    }
  }
}

Vue.component('leaf', {
  name: 'leaf',
  mixins: [DataNode],
  created: function() {
    //trace.log("leaf:"+this.schema.name+" created")
  },
  computed: {
    default: function() {
      return this.schema.default
    },
    isKey: function() {
      if (this.$parent.schema.node == 'list') {
         return this.$parent.schema.key.indexOf(this.schema.name) >= 0
      }
      return false
    },
    disabled: function() {
      //return this.isKey && !this.fromWithinToAdd
      return false
    },
    hidden: function() {
      return this.isKey && !this.fromWithinToAdd && !this.status.error
    },
    classMap4IconDefault: function() {
      return {
        "fa-key": this.isKey,
        "fa-circle-o": !this.isKey
      }
    }
  },
  methods: {
    autocast(obj) {
      if (this.schema.type.name == "boolean") {
        if (obj === "true") {
          return true 
        }
        if (obj === "false") {
          return false 
        }
      }
      return obj
    },
    setVar: function(name, value) {
      this.$parent.setVar(name, value)
    },
    getVar: function(name) {
      return this.$parent.getVar(name)
    }
  },
  directives: {
  },
  template: '\
  <li class="yang-leaf" :class="classMap4Node">\n\
    <i :class="classMap4CO" aria-hidden="true"></i>\n\
    <span class="node-head">\n\
      <i :class="classMap4Icon" aria-hidden="true"></i>\n\
      <span class="label" @click.stop="select()">{{label}}</span>\n\
	  <input-comp :model="model"></input-comp>\n\
      <span class="status-error" v-if="status.error">{{status.error}}</span>\n\
    </span>\n\
    <tooltips v-if="showTooltips"></tooltips>\n\
  </li>\n\
  '
})

var DataType = {
  props: ['idx'],
  computed: {
	leaf: function() {
	  // the leaf node that own this type
      var vm = this.$parent
      while (vm) {
          var name = vm.$options.name
          //trace.log("vm.name=["+name+']')
          if (name == 'leaf' || name == 'leaf-list') {
            return vm
          }
    	  vm = vm.$parent
      }
      return vm
	},
	model: {
      set: function(obj) {
        //trace.log("data-type model.set idx="+this.idx)
        if (this.idx == undefined) {
          this.$parent.model = obj
        } else {
          //example1.items.splice(indexOfItem, 1, newValue)
          this.$parent.model.splice(this.idx, 1, obj)
          //this.$parent.model.$set(this.idx, obj)
          //trace.log("--> data-type model.set idx="+this.idx)
        }
      },
      get: function() {
    	//trace.log("data-type model.get")
        if (this.idx == undefined) {
          return this.$parent.model
        } else {
          return this.$parent.model[this.idx]
        }
      }
	},
	schema: function() {
	  return this.leaf.schema	
	},
    disabled: function() {
      return this.$parent.disabled
    }
  },
  methods: {
    parseRange: function(range) {
      if (! range) { return range }
      var a = range.split("..")
      return a.map(function(i) {
        return Number.parseInt(i) 
      })
    }
  }
}

Vue.component('input-comp', {
  name: 'input-comp',
  mixins: [DataType],
  data: function() {
    return {
    }
  },
  computed: {
  },
  methods: {
    /*
     * +---------------------+-------------------------------------+
       | Name                | Description                         |
       +---------------------+-------------------------------------+
       | binary              | Any binary data                     |
       | bits                | A set of bits or flags              |
       | boolean             | "true" or "false"                   |
       | decimal64           | 64-bit signed decimal number        |
       | empty               | A leaf that does not have any value |
       | enumeration         | Enumerated strings                  |
       | identityref         | A reference to an abstract identity |
       | instance-identifier | References a data tree node         |
       | int8                | 8-bit signed integer                |
       | int16               | 16-bit signed integer               |
       | int32               | 32-bit signed integer               |
       | int64               | 64-bit signed integer               |
       | leafref             | A reference to a leaf instance      |
       | string              | Human-readable string               |
       | uint8               | 8-bit unsigned integer              |
       | uint16              | 16-bit unsigned integer             |
       | uint32              | 32-bit unsigned integer             |
       | uint64              | 64-bit unsigned integer             |
       | union               | Choice of member types              |
       +---------------------+-------------------------------------+
     */	
    comp4boolean: function() {
      return this.schema.type.name == 'boolean'
    },
    comp4string: function() {
      return this.schema.type.name == 'string'
    },
    comp4number: function() {
      return ['int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64'].indexOf(
    		  this.schema.type.name) != -1
    },
    comp4enumeration: function() {
      return this.schema.type.name == 'enumeration'
    },
    comp4leafref: function() {
      return this.schema.type.name == 'leafref'
    },
    comp4union: function() {
      return this.schema.type.name == 'union'
    }
  },
  template: '\
    <span>\n\
	  <input-boolean v-if="comp4boolean()"></input-boolean>\n\
	  <input-string v-else-if="comp4string()"></input-string>\n\
	  <input-number v-else-if="comp4number()"></input-number>\n\
      <input-enumeration v-else-if="comp4enumeration()"></input-enumeration>\n\
      <input-leafref v-else-if="comp4leafref()"></input-leafref>\n\
      <input-union v-else-if="comp4union()"></input-union>\n\
    </span>\n\
  '
})

Vue.component('input-boolean', {
  name: 'input-boolean',
  mixins: [DataType],
  data: function() {
    return {
    }
  },
  computed: {
  },
  methods: {
  },
  template: '<input type="checkbox" v-model="model" :disabled="disabled"></input>'
})

Vue.component('input-number', {
  name: 'input-number',
  mixins: [DataType],
  data: function() {
    return {
    }
  },
  computed: {
    range: function() {
       return this.parseRange(this.schema.type.range)
    }
  },
  methods: {
  },
  template: '<input type="number" v-model="model" :disabled="disabled" v-autosize></input>'
})

Vue.component('input-string', {
  name: 'input-string',
  mixins: [DataType],
  mixins: [DataType],
  data: function() {
    return {
    }  
  },
  computed: {
	minLengthBeTextArea: function() {
	  return 1000 
	},
    length: function() {
       return this.parseRange(this.schema.type.length)
    }
  },
  methods: {
    asTextArea: function() {
       if (this.schema.type.name == "string") {
    	  var length = this.length
    	  if (length) {
    		  return length[length.length-1] > this.minLengthBeTextArea
    	  }
       }
       return false
    }
  },
  template: '\
  <span>\n\
    <textarea v-if="asTextArea()" v-model="model" :disabled="disabled"></textarea>\n\
    <input v-else type="text" v-model="model" :disabled="disabled" v-autosize></input>\n\
  </span>\n\
  '
})

Vue.component('input-enumeration', {
  name: 'input-enumeration',
  mixins: [DataType],
  data: function() {
    return {
    }
  },
  computed: {
  },
  methods: {
  },
  template: '\
    <select v-model="model" :disabled="disabled">\n\
      <option v-for="enm in schema.type.enum" v-bind:value="enm.name">\n\
        {{ enm.name }}\n\
      </option>\n\
    </select>\n\
  '
})

Vue.component('input-leafref', {
  name: 'input-leafref',
  mixins: [DataType],
  data: function() {
    return {
    }
  },
  computed: {
    leafrefs : function() {
      // TODO: make xpath as computed to improve performance
      var xpath = new taiji.xpath.XPath(this.schema.type.path)
      trace.log(">> leafrefs: "+xpath)
      var leaves = xpath.eval(this.leaf)
      trace.log("-- leaves:   "+leaves)
      var refs
      if (leaves) {
        refs = leaves.map(function(leaf) {
          return {value: leaf.model}
        })
      } else {
        refs = []
      }
      // TODO: check if current model within refs
	  var self = this
	  if (this.model && !refs.find(function(ref) {
		  return ref.value == self.model
	  })) {
        //trace.log("old model:"+this.model+" not in new evaluated leafrefs:",refs)
        if (this.leaf.fromWithinToAdd) {
          // need change model = undefined
          this.model = undefined
        } else {
          // this should be an error
          this.leaf.setStatus('error', "no leafref from path:"+this.schema.type.path)
          // TODO: should change disabled to false to allow re-select
          return refs
        }
	  }
	  // TODO: should we push error stack, since there might be multiple errors...
      this.leaf.setStatus('error', null)
      return refs
    }
  },
  methods: {
  },
  template: '\
    <select v-model="model" :disabled="disabled">\n\
      <option v-for="ref in leafrefs" v-bind:value="ref.value">\n\
        {{ ref.value }}\n\
      </option>\n\
    </select>\n\
  '
})

function type4each(type, cb, ctxt) {
  cb(type, ctxt)
  if (type.name == 'union') {
    type.union.forEach(function(t) {
      type4each(t, cb, ctxt)	
    })
  }
}

Vue.component('input-union', {
  name: 'input-union',
  mixins: [DataType],
  beforeCreate: function() {
  },
  data: function() {
    return {
    }
  },
  computed: {
    useSelect: function() {
      var ctxt = {}
      type4each(this.schema.type, function(type, ctxt) {
        if (type.name != 'enumeration') {
          ctxt.select = false
        }
      }, ctxt)
      return ctxt.select
	},
	options: function() {
	  var opts = []
      type4each(this.schema.type, function(type, ctxt) {
        if (type.name == 'enumeration') {
          for (var i in type.enum) {
            var e = type.children[i]        	  
            opts.push({value: e.name})
          }
        } else if (type.name == 'boolean') {
          //TODO:
        }
      }, {})
      return opts	  
	}
  },
  methods: {
  },
  template: '\
  <span>\n\
    <select v-if="useSelect" v-model="model" :disabled="disabled">\n\
      <option v-for="opt in options" :value="opt.value">\n\
        {{ opt.value }}\n\
      </option>\n\
    </select>\n\
    <input v-else type="text" v-model="model" :disabled="disabled" v-autosize>\n\
	  <datalist>\n\
        <option v-for="opt in options" :value="opt.value">\n\
         {{ opt.value }}\n\
        </option>\n\
	  </datalist>\n\
	</input>\n\
  </span>\n\
  '
})


Vue.component('container', {
  name: 'container',
  mixins: [DataNode],
  data: function() {
    return {
      open: true
    }
  },
  computed: {
    hasChild: function() {
      return this.model
    },
    default: function() {
      return {}
    },
    classMap4IconDefault: function() {
      return {"fa-folder-o": true}
    }
  },
  methods: {
    setVar: function(name, value) {
      this.$parent.setVar(name, value)
    },
    getVar: function(name) {
      return this.$parent.getVar(name)
    }
  },
  template: '\
  <li class="yang-container" :class="classMap4Node">\n\
    <i :class="classMap4CO" aria-hidden="true" @click="toggle"></i>\n\
    <span class="node-head">\n\
    <i :class="classMap4Icon" aria-hidden="true" @click="toggle"></i>\n\
    <span class="label" @click.stop="select()">{{label}}</span>\n\
    <span class="btns-ctxt">\n\
      <a class="btn btn-export" @click="toExport()" title="export node" v-if="shareable"><i class="fa fa-share"></i></a>\n\
      <a class="btn btn-import" @click="toImport()" title="import node" v-if="shareable"><i class="fa fa-share fa-rotate-180"></i></a>\n\
    </span>\n\
    </span>\n\
    <tooltips v-if="showTooltips"></tooltips>\n\
    <ul>\n' +
      components('schema.children', '') +
    '</ul>\n\
  </li>\n\
  '
})

Vue.component('list', {
  name: 'list',
  mixins: [DataNode],
  data: function() {
    return {
      open: true,
      toAdd: null
    }
  },

  components: {
    'list-item': {
      mixins: [DataNode],
      data: function() {
        return {
          open: false
        }
      },
      created: function() {
        // this.isToAdd
    	// this.fromWithinToAdd
        if (this.fromWithinToAdd) {
          this.open = true	
        }
      },
      computed: {
        dri: function() {
          var self = this
          var ks = this.schema.key.map(function(k) {
        	return self.model[k]
          }).join(",")
          return this.$parent.dri+"="+ks
        },
        sni: function() {
          return this.$parent.sni
        },
        model: {
          set: function(value) { /* n/a */ },
          get: function() {
            return this.pmodel
          }
        },
        hasChild: function() {
          return true
        },
        isToAdd: function() {
          return this.$parent.toAdd == this.pmodel
        },
        fromWithinToAdd: function() {
          return this.isToAdd || this.$parent.fromWithinToAdd
        },
        itemName: function() {
          if (! this.schema.key) {
            return ""
          }
          var self = this
          return "["+this.schema.key.map(function(k) {
            return self.model[k]
          }).join('+')+"]"
        },
        itemTitle: function() {
          if (! this.schema.key) {
            return ""
          }
          return this.schema.key.join('+')
        },
        canMoveUp: function() {
          return this.$parent.model.indexOf(this.model) > 0
        },
        canMoveDown: function() {
          return this.$parent.model.indexOf(this.model) < this.$parent.model.length-1
        },
        canDelete: function() {
          return !this.isToAdd
        },
        canClone: function() {
          if (this.isToAdd) {
       	    return false
          }
          return this.$parent.canAdd
        },
        classMap4IconExt: function() {
          return settings.iconCM[this.sni+"/"]
        },
        classMap4IconDefault: function() {
          return {"fa-dot-circle-o": true}
        }
      },
      methods: {
    	// use default setVar/getVar to stop variable scope propagation in list item
    	//
        remove() {
          // TODO: confirm/alert
          this.$parent.removeItem(this.model)
          if (! this.fromWithinToAdd) {
            this.edit("DELETE", this.dri)
          }
        },
        add() {
          trace.log("add...")
          var json = {}
          var dri = this.$parent.dri
          var pdri = this.$parent.$parent.dri
          trace.log("pdri="+pdri)
          // for example: dri=ds:foo/bar/ns:coo/goo
          // then mo[1] = ns, mo[2] = goo
          var mo = dri.match(/([^:\/]+):[^:]*?([^:\/]+)$/)
          var qk = mo[1]+":"+mo[2]
          trace.log("qk="+qk)
          json[qk] = this.model
          var self = this
          this.edit("POST", pdri, json)
          .done(function() {
            self.$parent.toAdd = undefined
          })
        },
        cancel() {
          trace.log("cancel...")
          this.$parent.removeItem(this.model)
          this.$parent.toAdd = undefined
        },
        clone() {
          trace.log("clone...")
          var item = $.extend(true, {}, this.model)
          this.$parent.addItem(item)
        },
        moveUp() {
          trace.log("moveUp...")
          var i = this.$parent.model.indexOf(this.model)
          if (i > 0) {
            var u = this.$parent.model[i-1]
            Vue.set(this.$parent.model, i-1, this.model)
            Vue.set(this.$parent.model, i, u)
          }
        },
        moveDown() {
          trace.log("moveDown...")
          var i = this.$parent.model.indexOf(this.model)
          if (i+1 < this.$parent.model.length) {
            var d = this.$parent.model[i+1]
            Vue.set(this.$parent.model, i+1, this.model)
            Vue.set(this.$parent.model, i, d)
          }
        }
      },
      template: '\
      <li :class="classMap4Node">\n\
        <i :class="classMap4CO" aria-hidden="true" @click="toggle"></i>\n\
        <span class="node-head">\n\
        <i :class="classMap4Icon" aria-hidden="true" @click="toggle"></i>\n\
        <span class="label" @click.stop="select()" :title="itemTitle">\n\
          {{itemName}}\n\
        </span>\n\
    	<span class="btns-ctxt">\n\
          <a class="btn btn-move-up" @click="moveUp()" title="move up" v-show="canMoveUp"><i class="fa fa-arrow-up"></i></a>\n\
          <a class="btn btn-move-down" @click="moveDown()" title="move down" v-show="canMoveDown"><i class="fa fa-arrow-down"></i></a>\n\
          <a class="btn btn-clone" @click="clone()" title="clone" v-show="canClone"><i class="fa fa-clone"></i></a>\n\
          <a class="btn btn-delete" @click="remove()" title="delete" v-show="canDelete"><i class="fa fa-minus"></i></a>\n\
          <a class="btn btn-export" @click="toExport()" title="export node" v-if="shareable"><i class="fa fa-share"></i></a>\n\
          <a class="btn btn-import" @click="toImport()" title="import node" v-if="shareable"><i class="fa fa-share fa-rotate-180"></i></a>\n\
    	</span>\n\
        </span>\n\
        <ul>\n' +
          components('schema.children', ':pmodel="model"') +
       '</ul>\n\
        <div v-if="isToAdd" class="to-add-bottom-bar">\n\
          <span class="status-error" v-if="status.error">{{status.error}}</span>\n\
          <span class="btns-to-add">\n\
            <a class="btn btn-add" @click="add"><i class="fa fa-plus"></i> Add</a>\n\
            <a class="btn btn-cancel" @click="cancel"> Cancel</a>\n\
          </span>\n\
        </div>\n\
      </li>\n\
      '
	}
  },
  // ---
  computed: {
    hasChild: function() {
      return this.model && this.model.length
    },
    default: function() {
      // trace.log(">> list.default")
      return undefined
    },
    canAdd: function() {
      if (this.toAdd) {
        return false
      }
      return !this.schema.maxElem || (this.model.length < this.schema.maxElem)
    },
    classMap4IconDefault: function() {
      return {"fa-list-ul": true}
    }
  },
  methods: {
    autocast(obj) {
      if (obj instanceof Object && !(obj instanceof Array)) {
        // automatically construct as array if only one item
        return [obj]
      }
      return obj
    },
    removeItem: function(item) {
      item = this.model.indexOf(item)
   	  this.model.splice(item, 1)
      if (this.model.length == 0) {
        this.model = undefined
      }
      // call delete
    },
    addItem: function(item) {
      trace.log("addItem")
      this.open = true
      if (! this.model) {
        this.model = []
      }
      item = item || {}
      if (! this.fromWithinToAdd) {
        this.toAdd = item
      }
      this.model.push(item)
    },
    itemKey: function(item) {
      if (! this.schema.key) {
        return ""
      }
      return this.schema.key.map(function(k) {
        return item[k]
      }).join('-')
    },
    expandAll: function() {
      var f = function(vm) {
         vm.open = true 
         for (var i in vm.$children) {
           var c = vm.$children[i]
           f(c)
         }
      }
      f(this)
    },
    setVar: function(name, value) {
      this.$parent.setVar(name, value)
    },
    getVar: function(name) {
      return this.$parent.getVar(name)
    }
  },
  template: '\
  <li class="yang-list" :class="classMap4Node">\n\
    <i :class="classMap4CO" aria-hidden="true" @click="toggle"></i>\n\
    <span class="node-head">\n\
    <i :class="classMap4Icon" aria-hidden="true" @click="toggle"></i>\n\
    <span class="label" @click.stop="select()">{{label}}</span>\n\
   	<span class="btns-ctxt">\n\
      <a class="btn btn-exand-all" @click="expandAll()" v-show="hasChild" title="expand all"><i class="fa fa-angle-double-down"></i></a>\n\
      <a class="btn btn-to-add" @click="addItem()" v-show="canAdd" title="add item"><i class="fa fa-plus"></i></a>\n\
      <a class="btn btn-export" @click="toExport()" title="export node" v-if="shareable"><i class="fa fa-share"></i></a>\n\
      <a class="btn btn-import" @click="toImport()" title="import node" v-if="shareable"><i class="fa fa-share fa-rotate-180"></i></a>\n\
    </span>\n\
	</span>\n\
    <tooltips v-if="showTooltips"></tooltips>\n\
    <ol>\n\
      <list-item v-for="item in model" :pmodel="item" :key="item" :schema=schema></list-item>\n\
    </ol>\n\
  </li>\n\
  '
})

Vue.component('leaf-list', {
  name: 'leaf-list',
  mixins: [DataNode],
  data: function() {
    return {
      open: false,
      toAdd: null
    }
  },
  computed: {
    hasChild: function() {
      return this.model && this.model.length
    },
    //classMap4IconDefault: function() {
    //  return {"fa-ellipsis-v": true}
    //},
    classMap4IconDefault: function() {
      return {"fa-dot-circle-o": true}
    }
  },
  methods: {
    autocast(obj) {
      if (obj && !(obj instanceof Array)) {
        // automatically construct as array if only one item
        return [obj]
      }
      return obj
    },
    removeItem: function (idx) {
      this.model.splice(idx, 1)
      if (this.model.length == 0) {
    	this.model = undefined
      }
    },
    addItem: function () {
      this.open = true
      if (! this.model) {
        this.model = []
      }
      this.model.push("")
      // force update when one item + add, otherwise view update rendered correctly with data
      this.$forceUpdate()
    },
    remove(idx) {
      // TODO: confirm/alert
      this.removeItem(idx)
      if (! this.fromWithinToAdd) {
        this.edit("DELETE", this.dri)
      }
    },
    canMoveUp: function() {
      return this.model.indexOf(this.model) > 0
    },
    canMoveDown: function() {
      return this.model.indexOf(this.model) < this.$parent.model.length-1
    },
    canAdd: function() {
      return !this.schema.maxElem || (this.model.length < this.schema.maxElem)
    },
    canDelete: function() {
      return true // TODO: check max-elements
    },
    setVar: function(name, value) {
      this.$parent.setVar(name, value)
    },
    getVar: function(name) {
      return this.$parent.getVar(name)
    }
  },
  template: '\
  <li class="yang-leaf-list" :class="classMap4Node">\n\
    <i :class="classMap4CO" aria-hidden="true" @click="toggle"></i>\n\
    <span class="node-head">\n\
    <i class="fa fa-fw fa-ellipsis-v" aria-hidden="true" @click="toggle"></i>\n\
    <span class="label" @click.stop="select()">{{label}}</span>\n\
   	<span class="btns-ctxt">\n\
      <a class="btn btn-to-add" @click="addItem()" v-show="canAdd" title="add item"><i class="fa fa-plus"></i></a>\n\
      <a class="btn btn-export" @click="toExport()" title="export node" v-if="shareable"><i class="fa fa-share"></i></a>\n\
      <a class="btn btn-import" @click="toImport()" title="import node" v-if="shareable"><i class="fa fa-share fa-rotate-180"></i></a>\n\
	</span>\n\
	</span>\n\
    <tooltips v-if="showTooltips"></tooltips>\n\
    <ol>\n\
      <li v-for="(itm, idx) in model">\n\
        <i :class="class4Pad" aria-hidden="true"></i>\n\
        <span class="node-head">\n\
        <i :class="classMap4Icon" aria-hidden="true"></i>\n\
        <input-comp :idx="idx"></input-comp>\n\
        <span class="btns-ctxt">\n\
        <a class="btn btn-delete" @click="remove(idx)"><i class="fa fa-minus"></i></a>\n\
        </span>\n\
        </span>\n\
      </li>\n\
    </ol>\n\
  </li>\n\
  '
})

Vue.component('choice', {
  name: 'choice',
  mixins: [DataNode],
  created: function() {
    // trace.log('choice.created')
  },
  data: function() {
    return {
      current: null,
      cached: {}
    }
  },
  computed: {
	model: {
      set: function(value) {
        // n/a
      },
      get: function() {
        return this.pmodel || this.$parent.model
      }
	},
// pm: function() {
// //console.log('choice.pm')
// return (this.pmodel || this.$parent.model)
// },
    choosing: {
      get: function() {
        // console.log("choice.choosing.get")
        if (this.current) {
          return this.current.name
        }
        // var dm = this.dm
        var ks = null  // case
        var ksm = null // case matched
        for (var i in this.schema.children) {
          ks = this.schema.children[i]
          for (var j in ks.body) {
            var s = ks.body[j]
            if (this.model[s.name] != undefined) {
              ksm = ks
              break
            }
          }
          if (ksm) break
        }
        if (!ksm) {
          ksm = this.schema.children[0]
        }
        // console.log("get ksm:"+ksm.name)
        this.current = ksm
        this.restoreCase()
        return ksm.name
      },
      set: function(sel) {
        // console.log("choice.choosing.set:"+sel)
        this.cacheCase()
        this.removeCase() 
        this.current = this.getCase(sel)
        this.restoreCase()
      }
    },
    classMap4IconDefault: function() {
      return {"fa-hand-o-right": true}
    }
  },
  methods: {
    cacheCase: function() {
      var name = this.current.name
      var self = this
      this.current.body.forEach(function(s) {
        var cd = self.cached[name]
        if (! cd) {
          // console.log("cacheCase !cd")
          cd = self.cached[name] = {}
        }
        cd[s.name] = self.model[s.name]
      })
      // console.log("cacheCase:"+JSON.stringify(this.cached))
    },
    removeCase: function(name) {
      var self = this
      this.current.body.forEach(function(s) {
        Vue.delete(self.model, s.name)
      })
    },
    restoreCase: function() {
      // console.log("restoreCase:"+JSON.stringify(this.cached))
      var name = this.current.name
      var cd = this.cached[name]
      if (! cd) {
        // console.log("restoreCase !cd")
        this.cached[name] = cd = {}
      } else {
        // console.log("have cd:")
      }
      for (var i in this.current.body) {
        var k = this.current.body[i].name
        Vue.set(this.model, k, cd[k])
      }
    },
    getCase: function(name) {
      for (var i in this.schema.children) {
        var ks = this.schema.children[i]
        if (name == ks.name) {
          console.log("return case:"+name)
          return ks
        }
      }
      console.log("ERROR: no such case:"+name)
    },
    setVar: function(name, value) {
      this.$parent.setVar(name, value)
    },
    getVar: function(name) {
      return this.$parent.getVar(name)
    }
    // default: function(cm) {
    // return []
    // }
  },
  template: '\
  <li class="yang-choice">\n\
    <i :class="classMap4CO" aria-hidden="true"></i>\n\
    <span class="node-head">\n\
    <i :class="classMap4Icon" aria-hidden="true"></i>\n\
    <span class="label">\n\
      {{label}}\n\
      <select v-model="choosing">\n\
        <option v-for="kase in schema.children" v-bind:value="kase.name">\n\
        {{ kase.name }}\n\
        </option>\n\
      </select>\n\
    </span>\n\
    </span>\n\
    <tooltips v-if="showTooltips"></tooltips>\n\
    <ul v-for="ks in schema.children" v-if="ks.name == choosing">\n' +
      components('ks.body', '') +
   '</ul>\n\
  </li>'
})

// Vue.component('data-node', DataNode)
Vue.component('anyxml', {
  name: 'anyxml',
  mixins: [DataNode],
  data: function() {
    return {
      datatreeOpt: {
        shareable: true
      }
    }
  },
  beforeCreate: function() {
  },
  created: function() {
	// trace.log("anyxml.created") 
    // trace.log("leaf:"+this.schema.name+" created")
	//     ss="/schema/datacook/data/datacook:device-schema"\n\
	//     rr="/restconf/datacook" class="data-tree">\n\
  },
  computed: {
    default: function() {
      return {}
    },
	ss: function() {
	  //trace.log(">> anyxml.ss") 
	  var self = this
      var exss = this.schema['taiji:schema-select']
      //trace.log("anyxml.exss:"+exss) 
      var errs = []
      if (exss) {
        var nss = exss.replace(/\$[A-Za-z0-9\-]+/g, function(vn) {
          vn = vn.substring(1)
          vv = self.getVar(vn)
          if (vv == undefined) {
       	    // might be invalid variable name
            errs.push("no such variable: "+vn)
          }
          //trace.log("anyxml.vv:"+vv) 
          return vv
        })
        //trace.log("<< anyxml.ss nss:"+nss) 
        if (errs.length > 0) {
          console.log("ERROR: ",errs)
          return undefined
          //return nss
        }
        return nss
      }
	  return undefined
      //return exss
    },
    classMap4IconDefault: function() {
      return {"fa-cog": true}
    }
  },
  methods: {
    setVar: function(name, value) {
      this.$parent.setVar(name, value)
    },
    getVar: function(name) {
      return this.$parent.getVar(name)
    }
  },
  directives: {
  },
  // XXX: hard-code shareable=true for now.
  template: '\
  <li class="yang-anyxml" :class="classMap4Node">\n\
    <i :class="classMap4CO" aria-hidden="true"></i>\n\
    <span class="node-head">\n\
    <i :class="classMap4Icon" aria-hidden="true"></i>\n\
    <span class="label" @click="select()">{{label}}</span>\n\
   	<span class="btns-ctxt">\n\
      <a class="btn btn-export" @click="toExport()" title="export node" v-if="shareable"><i class="fa fa-share"></i></a>\n\
      <a class="btn btn-import" @click="toImport()" title="import node" v-if="shareable"><i class="fa fa-share fa-rotate-180"></i></a>\n\
	</span>\n\
    </span>\n\
    <tooltips v-if="showTooltips"></tooltips>\n\
    <div>\n\
      <data-tree :isSub="true" :ss="ss" :pmodel="model" :debug="true" :shareable="datatreeOpt.shareable">\n\
      </data-tree>\n\
    </div>\n\
  </li>\n\
  '
})

Vue.directive('auto-width', {
  /*
  bind: function(el, binding, vnode) {
	//trace.log("autowidth.bind: el=",el)
	//trace.log("autowidth.bind: offsetWidth=",el.offsetWidth)
	//trace.log("autowidth.bind: clientWidth=",el.clientWidth)
  },
  */
  inserted: function(el, binding, vnode) {
	//trace.log("autowidth.inserted: offsetWidth=",el.offsetWidth)
	//trace.log("autowidth.inserted: clientWidth=",el.clientWidth)
	if (el.clientWidth > el.parentElement.clientWidth) {
      el.style.width = el.parentElement.clientWidth+"px"
	}
  }
  /*
  ,
  update: function(el, binding, vnode) {
	//trace.log("autowidth.update: offsetWidth=",el.offsetWidth)
	//trace.log("autowidth.update: clientWidth=",el.clientWidth)
	if (el.clientWidth > el.parentElement.clientWidth) {
      el.style.width = el.parentElement.clientWidth+"px"
	}
  }
  */
})

Vue.component('tooltips', {
  name: 'tooltips',
  beforeCreate: function() {
  },
  created: function() {
    this.closeAfter(5000)
  },
  data: function() {
	return {
      open: true,
      lock: false
	}
  },
  computed: {
	schema: function() {
	  return this.$parent.schema	
	},
	show: function() {
      return this.open == true && (this.schema.description || this.schema.type)
	},
    type: function() {
      var type = $.extend(true, {}, this.schema.type)
      var t = type.name
      type.name = undefined 
      return t + ":" + JSON.stringify(type)
    },
    classMap4Node: function() {
      return {
        "open":   this.show,
        "closed": !this.show
      }
    }
  },
  methods: {
    closeAfter: function(timeout) {
      var self = this
      setTimeout(function() {
        self.close()
      }, timeout)
    },
    close: function(force) {
      if (this.lock && !force) {
        this.closeAfter(1500)
      } else {
        this.open = false	
      }
      //trace.log("tooltips: open:"+this.open)
    }
  },
  template: '\
  <div class="tooltips-ph" :class="classMap4Node">\n\
    <div class="tooltips" v-auto-width @click.stop="lock=close(true)" @mouseover="lock=true" @mouseout="lock=false">\n\
    <span class="description" v-if="schema.description">\n\
      <i class="fa fa-fw fa-lightbulb-o" aria-hidden="true"></i>\n\
	  {{schema.description}}\n\
	</span>\n\
    <pre class="type" v-if="schema.type">{{type}}</pre>\n\
    </div>\n\
  </div>\n\
  '
})

function XPath(xpath) {
  this.steps = parse(xpath)
  trace.log("xpath="+xpath+" => ",this.steps)
  var context = null
  this.eval = function(ctxt) {
	 context = ctxt
	 var nodeSet = [ctxt]
	 this.steps.forEach(function(step) {
		nodeSet = step.step(nodeSet) 
	 })
	 return nodeSet
  }
  this.create = function(ctxt) {
     // TODO: create object by path
  }
  function Expr(ex) {
    this.op = "child" // default is get child value
    this.lv = null
    this.rv = null
    this.evalAsBoolean = function(node, contextSet) {
      var b = f_boolean(this.eval(node, contextSet))
      trace.log("evalAsBoolean=>"+b)
      return b
    }
    this.eval = function(node, contextSet) {
      trace.log("expr eval:"+this.op+"/"+this.lv+","+this.rv+" | node=",node.model)
	  var lval = this.lv
	  var rval = this.rv
	  if (lval instanceof Expr) {
        lval = lval.eval(node, contextSet)
	  }
	  if (rval instanceof Expr) {
        rval = rval.eval(node, contextSet)
	  }
	  switch (this.op) {
      case "child":
        //return node.getChild(lval)
        var v = node.model[lval]
        if (v == undefined) {
          throw "no child '"+lval+"' from node:"+JSON.stringify(node.model)
        }
        //trace.log("expr child:"+lval+" from ", node.model, " => ",v)
        return v
      case "$":
        return context.getVar(lval)
      case "=":
        // autocast...
		//trace.log("++++ expr[=]:"+lval+"=="+rval)
        return f_string(lval) == f_string(rval)
	  }
    }
	function f_string(val) {
      if (val.model) { // TODO: how to detect a Vue Model
        val = val.model	
      }
	  return val == null ? null : val.toString()
	}
	function f_boolean(val) {
	  return val
	}
  }
  function Step() {
	this.axis = 'child'
	this.prefix = null
	this.name = null
    this.predicates = []

	this.setName = function(name) {
	  this.name = name
      var t = name.split(":")
      if (t.length == 1) {
        this.name = t[0]
      } else {
        this.prefix = t[0]
        this.name = t[1] 
      }
	}

    this.addPredicate = function(expr) {
      this.predicates.push(expr)
	}

    this.step = function(nodes) {
      trace.log("{{ step("+this.name+")<="+nodes)
      var result = []
      for (var i in nodes) {
        var node = nodes[i]
        // XXX: need handle none-data node like 'choice'
        switch(this.axis) {
        case 'child':
          result = result.concat(this.nodeTest(node.$children))
          break
        case 'root':
          return node.datatree.roots
        }
      }
      trace.log("}} step("+this.name+")=>"+result)
      return result
    }
    // more efficent way by calling nodeTest() of each node?
    this.nodeTest = function(nodes) {
      function put(result, node) {
        if (node.schema.node == 'list') {
          // NOTE: here call node.model to chain dependency
      	  var __ = node.model
      	  //trace.log("!!! don't remove: chain dependency by model:"+node.model)
          for (var i in node.$children) {
            var item = node.$children[i]
            result.push(item)
          }
        } else {
          result.push(node)
        }
      }
      function matchQN(ms, name1, prefix, name2) {
        trace.log("matchQN: "+ms+":"+name1+"<=>"+prefix+":"+name2)
        if (name1 != name2) {
          return false
        }
        // TODO: match prefix,module
        return true
      }
      var result = []
      for (var i in nodes) {
        var node = nodes[i]
        var ms = null
        var name = node.schema.name
        var qn = name.split(":")
        if (qn.length == 2) {
          ms = qn[0]
          name = qn[1]
        }
        trace.log("nodeTest."+i)
        //if (name == this.name) {
        if (matchQN(ms, name, this.prefix, this.name)) {
          put(result, node)
        }
      }
      if (result.length == 0) {
        return result
      }
      // handle predicates
      var contextSet = null
      this.predicates.forEach(function(expr) {
        contextSet = result
        result = []
        contextSet.forEach(function(node) {
          if (expr.evalAsBoolean(node, contextSet)) {
            result.push(node)
          }
        })
      })
      //trace.log("nodeTest:result=>"+result)
      return result
    }
  }
  function parseExpr(str) {
    var tokens = str.split("=")
	var val;
    if (tokens.length == 2) {
      val = new Expr()
      val.op = "="
      val.lv = parseExpr(tokens[0])
      val.rv = parseExpr(tokens[1])
    } else {
      if (str.startsWith('$')) {// variable
        val = new Expr()
        val.op = '$'
        val.lv = str.substring(1)
      } else if (str.startsWith("'") || str.startsWith('"')){
        val = str.substring(1, str.length-1)
      } else {
        val = new Expr()
    	val.lv = str 
      }
    }
    return val
  }
  function parse(xpath) {
    var path = []
	var steps = xpath.split("/")
    for (var i in steps) {
      var step = new Step()
      var ss = steps[i] 
      var sks = ss.split("[")
      for (var n in sks) {
        var k = sks[n]
        if (k.endsWith("]")) {
          var ex = k.substring(0, k.length-1)
          var expr = parseExpr(ex)
          step.addPredicate(expr)
        } else {
          // TODO: support AXIS
          step.setName(k)
          if (k == "") {
            step.axis = 'root'
          }
        }
      }
      path.push(step)
    }
    return path
  }
}

exports.taiji = exports.taiji || {}
exports.taiji.settings = settings
exports.taiji.datanode = datanode
exports.taiji.PointWatcher = PointWatcher

})(this);
