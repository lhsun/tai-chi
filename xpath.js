/*
 * xpath javascript implementation
 * 
 * jimmy.sun@alcatel-lucent.com
 */

(function(exports) {
	
var trace = console
	
function f_string(val) {
	if (val instanceof Array) {
		if (val.length == 0) { // emptyset from step
			return null
		}
		if (val[0].model) {// use first element, correct?
			// TODO: how to detect a Vue Model
			val = val[0].model	
		}
	}
	return val == null ? null : val.toString()
}

function f_boolean(val) {
	return val
}


/*
 *  xpath.Expr
 * 
 */

var Expr = {
	varref: function(name) {
		this.name = name
	},
	equals: function(lv, rv) {
		this.lv = lv
		this.rv = rv
	},
	path: function(steps, abs) {
		this.steps = steps
		this.absolute = abs
	}
}

Expr.varref.prototype.eval = function(node, contextSet, ctxt) {
	var v = ctxt.getVar(this.name)
	trace.log("expr varref:"+this.name+" return:", v)
	return v
}

Expr.varref.prototype.toString = function() {
	return "$"+this.name
}

Expr.equals.prototype.eval = function(node, contextSet, ctxt) {
	var lval = this.lv
	var rval = this.rv
	if (lval.eval) {
		lval = lval.eval(node, contextSet, ctxt)
	}
	if (rval.eval) {
		rval = rval.eval(node, contextSet, ctxt)
	}
	// autocast...
	trace.log("++++ expr[=1]:"+lval+"=="+rval)
	var l = f_string(lval); var r = f_string(rval)
	trace.log("++++ expr[=2]:"+l+"=="+r)
	return f_string(lval) == f_string(rval)
}

Expr.equals.prototype.toString = function() {
	return this.lv+"="+this.rv
}

Expr.path.prototype.eval = function(node, contextSet, ctxt) {
	var nodeSet
	if (this.absolute) {
		nodeSet = node.datatree.roots
	} else {
		nodeSet = [node]
	}
	this.steps.forEach(function(step) {
		nodeSet = step.step(nodeSet, ctxt) 
	})
	return nodeSet
}

Expr.path.prototype.toString = function() {
	return (this.absolute?"/":"")+this.steps.join("/")
}

// ----- WName -------------
function WName(prefix, name) {
	this.prefix = prefix
	this.name = name
}

WName.prototype.match = function(node) {
	var ms   = null
	var name = node.schema.name
	var qn = name.split(":")
	if (qn.length == 2) {
		ms   = qn[0]
		name = qn[1]
	}
	trace.log("wname.match("+name+"<?=?>"+this.name+")...")
	if (name != this.name) {
		//trace.log("wname.match("+this.ms+":"+this.name+") => false")
		return false
	}
	// TODO: match prefix,module
	trace.log("wname.match("+this.ms+":"+this.name+") => true")
	return true
}

WName.prototype.toString = function() {
	return this.prefix ? this.prefix +":"+this.name : this.name
}

// ----- NodeTest -----------
function NodeTest(name, type) {
	this.name = name
	this.type = type
}

NodeTest.prototype.test = function(node) {
	if (this.name && this.name.match(node)) {
		return true
	}
	// TODO: match type
	return false
}

NodeTest.prototype.toString = function() {
	return this.name
}

/*
 * xpath.Step
 */
// ----- Step -----------------------
function Step(axis, test, predicates) {
	this.axis = axis
	this.test = test
	this.predicates = predicates
}

Step.prototype.step = function(nodes, ctxt) {
	var result = []
	for (var i in nodes) {
		var node = nodes[i]
		// XXX: need handle none-data node like 'choice'
		switch(this.axis) {
		case 'child':
			trace.log("step.child: "+this.toString(),"|"+node)
			result = result.concat(this.nodeTest(node.$children, ctxt))
			break
		default:
			console.log("unsupported axis:"+this.axis)
		}
	}
	return result
}

// more efficent way by calling nodeTest() of each node?
Step.prototype.nodeTest = function(nodes, ctxt) {
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
	var result = []
	for (var i in nodes) {
		var node = nodes[i]
		if (this.test.test(node)) {
			put(result, node)
			trace.log("nodeTest:"+this.test.toString()+"=>"+result)
		} else {
			trace.log("nodeTest:"+this.test.toString())
		}
	}
	if (result.length == 0) {
		trace.log("nodeTest: no result")
		return result
	}
	// handle predicates
	var contextSet = null
	this.predicates.forEach(function(expr) {
		contextSet = result
		result = []
		trace.log("nodeTest.predicate: "+expr)
		contextSet.forEach(function(node) {
			if (f_boolean(expr.eval(node, contextSet, ctxt))) {
				trace.log("nodeTest.predicate: true")
				result.push(node)
			}
		})
	})
	trace.log("nodeTest: =>"+result)
	return result
}

Step.prototype.toString = function() {
	return this.axis+"::"+this.test.toString()+(this.predicates.length>0?"["+this.predicates.join("][")+"]":"")
}

function XPath(xpath) {
	try {
		this.path = taiji.getXPathParser().parse(xpath)
	} catch (e) {
		console.log(e.message)
	}
	this.xpath = xpath
	this.create = false // TODO: support create node by path
}

XPath.prototype.eval = function(ctxt) {
	var nodeSet = [ctxt]
	return this.path.eval(ctxt, nodeSet, ctxt)
}

XPath.prototype.toString = function() {
	return this.xpath+" = "+this.path.toString()
}

exports.taiji = exports.taiji || {}
exports.taiji.getXPathParser = function() {
	// TODO: better solution
	return ((typeof XPathParser)!="undefined")?XPathParser : parser
}
exports.taiji.xpath = {
	XPath: XPath,
	Expr: Expr,
	Step: Step,
	WName: WName,
	NodeTest: NodeTest
}

})(this);