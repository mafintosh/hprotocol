var fifo = require('fifo');
var util = require('util');
var EE = require('events').EventEmitter;
var Duplex = require('stream').Duplex;
var StringDecoder = require('string_decoder').StringDecoder;

var noop = function() {};

var hasArray = function(list) {
	return list.some(function(arg) {
		return arg.array;
	});
};

var parse = function(def) {
	def = def.toString().trim().split(/\s+/);
	var result = {};
	result.name = def.shift();

	var map = function(val, i) {
		return {
			index: i+1,
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

var writegen = function(node) {
	var args = node.outgoing.map(function(arg) {
		return arg.name;
	});

	var src = 'function('+args.concat('cb').join(', ')+') {\n';

	args = args.map(function(arg) {
		return 'encodeURI('+arg+')';
	});

	args.unshift(JSON.stringify(node.name));

	if (hasArray(node.outgoing)) {
		var arr = args.pop();
		args = '['+args.join(', ')+'].concat('+arr+')';
	} else {
		args = '['+args.join(', ')+']'
	}

	src += '\tthis._writeLine('+args+');\n';

	if (node.incoming) src += '\tthis._incoming.push('+(node.incoming.array ? 'cb' : 'first(cb)')+');\n';
	else src += '\tif (cb) this.flush(cb);\n';

	return new Function('first', 'return '+src+'}')(first);
};

var switchgen = function(node) {
	var args = node.outgoing.map(function(arg) {
		return arg.array ? 'line.slice('+arg.index+').map(decodeURI)' : 'decodeURI(line['+arg.index+'])';
	});

	if (node.incoming) args.push('this._pushResponse()');

	var src = '\t\tcase '+JSON.stringify(node.name)+':\n';
	var min = node.outgoing.length+1;

	if (hasArray(node.outgoing)) min--;
	if (min > 0) src += '\t\tif (line.length < '+min+') return;\n';

	args.unshift(JSON.stringify(node.name));
	src += '\t\tthis.emit('+args.join(', ')+');\n';

	return src+'\t\treturn;\n';
};

var emitgen = function(events) {
	var src = '\tswitch (line[0]) {\n';

	Object.keys(events).forEach(function(e) {
		src += events[e];
	});

	src += '\t}\n';

	return new Function('return function(line) {\n'+src+'};')();
};

var LineStream = function() {
	Duplex.call(this);
	this._decoder = new StringDecoder();
	this._buffer = '';
};

util.inherits(LineStream, Duplex);

LineStream.prototype.line = function(line) {
	// TODO: if ended do nothing
	this.push(line+'\n');
};

LineStream.prototype._read = noop;

LineStream.prototype._write = function(data, enc, callback) {
	var chunk = this._buffer + this._decoder.write(data);
	var end = 0;
	var offset = -1;

	while ((offset = chunk.indexOf('\n', end)) > -1) {
		this.emit('line',chunk.substring(0, offset).trim());
		end = offset+1;
	}

	if (end < chunk.length) this._buffer = end === 0 ? chunk : chunk.substring(end);

	callback();
};

var protocolify = function() {
	var methods = {};
	var events = {};
	var Proto;

	var fn = function() {
		if (Proto) return new Proto();

		Proto = function() {
			this.stream = new LineStream();

			this._incoming = fifo();
			this._outgoing = fifo();

			var self = this;
			this.stream.on('line', function(line) {
				self._handleLine(line);
			});
		};

		util.inherits(Proto, EE);

		// protocol methods

		Proto.prototype.flush = function(cb) {
			this._writeLine(['flush']);
			this._incoming.push(first(cb));
		};

		Proto.prototype._writeLine = function(line) {
			this.stream.line(line.join(' '));
		};

		Proto.prototype._handleLine = function(line) {
			if (line[0] === '#') return; // is a comment
			line = line.split(/\s+/);

			switch (line[0]) { // baked in stuff
				case '>':
				this._shiftRequest(null, line.slice(1).map(decodeURI));
				return;
				case '!':
				this._shiftRequest(new Error(decodeURI(line[1])));
				return;
				case 'flush':
				this._pushResponse()(null, 'ok');
				return;

				default:
				this._emitLine(line);
				return;
			}
		};

		Proto.prototype._emitLine = emitgen(events);

		Proto.prototype._pushResponse = function() {
			var self = this;
			var node = this._outgoing.push(null);

			return function(err, args) {
				if (err) {
					args = ['!', encodeURI(err.message)];
				} else {
					args = Array.isArray(args) ? args.map(encodeURI) : [encodeURI(args)];
					args.unshift('>');
				}
				self._outgoing.set(node, args);
				while (self._outgoing.first()) self._writeLine(self._outgoing.shift());
			};
		};

		Proto.prototype._shiftRequest = function(err, value) {
			(this._incoming.shift() || noop)(err, value);
		};

		Object.keys(methods).forEach(function(m) {
			Proto.prototype[m] = methods[m];
		});

		return new Proto();
	};

	fn.use = function(def) {
		def = parse(def);
		methods[def.name] = writegen(def);
		events[def.name] = switchgen(def);
		return fn;
	};

	return fn;
};

module.exports = protocolify;

if (require.main !== module) return;

var protocol = protocolify()
	.use('list key > values...')
	.use('push key value')
	.use('pull key value')
	.use('count key > number')
	.use('add numbers... > number')
	.use('keys')
	.use('clear');

var p = protocol();

p.stream.pipe(p.stream);

p.on('list', function(key, cb) {
	cb(null, ['hello', 'from', 'list', 'key', 'is', key]);
});

p.list('hello', console.log);