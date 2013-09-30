var fifo = require('fifo');
var util = require('util');
var vm = require('vm');
var EE = require('events').EventEmitter;
var Duplex = require('stream').Duplex;
var StringDecoder = require('string_decoder').StringDecoder;
var pump = require('pump');

var noop = function() {};

var hasArray = function(list) {
	return list.some(function(arg) {
		return arg.array;
	});
};

var parse = function(def) {
	def = def.toString().trim().replace(/^\$+/, '').trim().split(/\s+/);
	var result = {};
	result.specification = '$ '+def.join(' ')+'\n';
	result.fullname = def.shift();
	var ns = result.fullname.split('.');
	result.name = ns.pop();
	result.ns = ns;

	var map = function(val, i) {
		return {
			offset: i+1,
			array: /\.\.\.$/.test(val),
			name: val.replace(/\.\.\.$/, '')
		};
	};

	if (def.indexOf('>') > -1) {
		result.incoming = map(def.pop(), 0);
		def.pop();
	}

	result.outgoing = def.map(map);
	return result;
};

var first = function(cb) {
	if (!cb) return cb;
	return function(err, list) {
		if (err) return cb(err);
		cb(null, list[0]);
	};
};

var compile = function(src, context) {
	return vm.runInNewContext('('+src+')', context);;
};

var writegen = function(node) {
	var args = node.outgoing.map(function(arg) {
		return arg.name;
	});

	var src = 'function '+node.name+'('+args.concat('cb').join(', ')+') {\n';

	args = args.map(function(arg, i) {
		return node.outgoing[i].array ? arg+'.map(encodeURI)' : 'encodeURI('+arg+')';
	});

	args.unshift(JSON.stringify(node.fullname));

	if (hasArray(node.outgoing)) {
		var arr = args.pop();
		args = '['+args.join(', ')+'].concat('+arr+')';
	} else {
		args = '['+args.join(', ')+']'
	}

	if (node.incoming) {
		src += '\tthis._p._incoming.push('+(node.incoming.array ? 'cb' : 'first(cb)')+');\n';
		src += '\tthis._p.stream.command('+args+');\n';
	} else {
		src += '\tthis._p.stream.command('+args+');\n';
		src += '\tif (cb) this._p.ping(cb);\n';
	}

	return compile(src+'}', {first:first});
};

var casegen = function(node) {
	var args = node.outgoing.map(function(arg) {
		return arg.array ? 'line.slice('+arg.offset+').map(decodeURI)' : 'decodeURI(line['+arg.offset+'])';
	});

	if (node.incoming) args.push('pushResponse(self)');

	var src = '\t\tcase '+JSON.stringify(node.fullname)+':\n';
	var min = node.outgoing.length+1;

	if (hasArray(node.outgoing)) min--;
	if (min > 0) src += '\t\tif (line.length < '+min+') return;\n';

	var ns = ['self'].concat(node.ns).join('.');
	args.unshift(JSON.stringify(node.name));
	src += '\t\t'+ns+'.emit('+args.join(', ')+');\n';

	return src+'\t\treturn;\n';
};

var switchgen = function(defs, context) {
	var src = '';
	defs.forEach(function(def) {
		src += casegen(def);
	});
	src = 'function oncommand(self, line) {\n\tswitch (line[0]) {\n'+src+'\t}\n}';
	return compile(src, context);
};

var protogen = function(defs) {
	var protos = {};
	var NS = function() {
		EE.call(this);
		this._p = this;
	};

	util.inherits(NS, EE);
	protos.__default__ = NS;

	defs.forEach(function(def) {
		var ns = def.ns.join('.') || '__default__';
		if (!protos[ns]) {
			protos[ns] = function(p) {
				EE.call(this);
				this._p = p;
			};
			util.inherits(protos[ns], EE);
		}
		protos[ns].prototype[def.name] = writegen(def);
	});

	return protos;
};

var nsgen = function(ns) {
	var names = Object.keys(ns).sort();
	var src = '';
	var close = '';

	names.forEach(function(name) {
		src += '\tself.'+name+' = new ns.'+name+'(self);\n';
	});
	names.forEach(function(name) {
		close += '\t\tself.'+name+'.emit("close");\n';
	});

	return compile('function init(self) {\n'+src+'\treturn function() {\n'+close+'\t};\n}', {ns:ns});
};

var CommandStream = function() {
	Duplex.call(this);
	this._decoder = new StringDecoder();
	this._buffer = '';
	this._destroyed = false;
};

util.inherits(CommandStream, Duplex);

CommandStream.prototype.command = function(line) {
	if (this._destroyed) return;
	this.push(line.join(' ')+'\n');
};

CommandStream.prototype.destroy = function() {
	if (this._destroyed) return;
	this._destroyed = true;
	this.push(null);
	this.emit('close');
};

CommandStream.prototype._read = noop;

CommandStream.prototype._write = function(data, enc, callback) {
	var chunk = this._buffer + this._decoder.write(data);
	var end = 0;
	var offset = -1;

	while ((offset = chunk.indexOf('\n', end)) > -1) {
		var line = chunk.substring(end, offset).trim();
		if (line[0] !== '#' && line[0] !== '$') this.emit('command', line.split(/\s+/));
		end = offset+1;
	}

	if (end < chunk.length) this._buffer = end === 0 ? chunk : chunk.substring(end);

	callback();
};

var pushResponse = function(self) {
	var node = self._outgoing.push(null);
	return function(err, args) {
		if (err) {
			args = ['!', encodeURI(err.message)];
		} else {
			args = Array.isArray(args) ? args.map(encodeURI) : [encodeURI(args)];
			args.unshift('>');
		}
		self._outgoing.set(node, args);
		while (self._outgoing.first()) self.stream.command(self._outgoing.shift());
	};
};

var shiftRequest = function(self, err, value) {
	(self._incoming.shift() || noop)(err, value);
};

var hprotocol = function(spec) {
	var defs = [];
	var Protocol;

	var fn = function(input, output) {
		if (Protocol) return new Protocol(input, output);

		var protos = protogen(defs);
		var NS = protos.__default__;
		delete protos.__default__;

		var init = nsgen(protos);
		var oncommand = switchgen(defs, {
			shiftRequest:shiftRequest,
			pushResponse:pushResponse
		});

		Protocol = function(input, output) {
			NS.call(this);

			this.stream = new CommandStream();
			this._incoming = fifo();
			this._outgoing = fifo();

			var uninit = init(this);
			var self = this;

			this.stream.on('command', function(line) {
				switch (line[0]) { // baked in stuff
					case '>':
					return shiftRequest(self, null, line.slice(1).map(decodeURI));
					case '!':
					return shiftRequest(self, new Error(decodeURI(line[1])));
					case 'ping':
					return pushResponse(self)(null, 'pong');
					default:
					return oncommand(self, line);
				}
			});

			this.stream.on('close', function() {
				while (self._incoming.length) shiftRequest(self, new Error('stream has closed'));
				self.emit('close');
				uninit();
			});

			if (input) pump(input, this.stream, output || input);
		};

		util.inherits(Protocol, NS);

		Protocol.prototype.ping = function(cb) {
			this._incoming.push(cb);
			this.stream.command(['ping']);
		};

		return new Protocol(input, output);
	};

	fn.specification = '';

	fn.use = function(def) {
		def = parse(def);
		defs.push(def);
		fn.specification += def.specification;
		return fn;
	};

	if (!spec) return fn;

	spec.toString().trim().split('\n').forEach(function(line) {
		if (line.trim()[0] === '$') fn.use(line.trim());
	});

	return fn;
};

module.exports = hprotocol;