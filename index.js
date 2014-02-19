var net = require('net');
var stream = require('stream');
var fifo = require('fifo');
var util = require('util');
var StringDecoder = require('string_decoder').StringDecoder;

var noop = function() {};

var encode = function(arr) {
	return arr.map(encodeURIComponent);
};

var decode = function(arr) {
	return arr.map(decodeURIComponent);
};

var echo = function(arr) {
	return arr;
};

var HumanParser = function(opts) {
	if (!(this instanceof HumanParser)) return new HumanParser(opts);

	stream.Duplex.call(this);

	this.incoming = fifo();
	this.outgoing = fifo();

	this.ended = false;
	this.closed = false;

	if (opts && opts.encode === false) {
		this.encode = echo;
		this.decode = echo;
	} else {
		this.encode = encode;
		this.decode = decode;
	}

	this.buffer = '';
	this.decoder = new StringDecoder('utf-8');

	this.on('finish', function() {
		this._push(null);
		this.destroy();
	});

	this.on('close', function() {
		while (this.outgoing.length) (this.outgoing.shift() || noop)(new Error('protocol has closed'));
	});
};

util.inherits(HumanParser, stream.Duplex);

HumanParser.prototype._read = noop;

HumanParser.prototype._write = function(data, enc, callback) {
	data = this.decoder.write(data);

	var cur = -1;
	var prev = 0;

	while ((cur = data.indexOf('\n', prev)) > -1) { // TODO: strip \r
		var msg = (this.buffer + data.slice(prev, cur)).trim();
		this.buffer = '';
		prev = cur+1;
		msg = msg ? msg.split(/\s+/) : [];
		this._onmessage(msg.shift(), this.decode(msg));
	}

	this.buffer += data.slice(prev);
	callback();
};

HumanParser.prototype._onmessage = function(cmd, msg) {
	if (!cmd) return;
	if (cmd[0] === '~') return this.emit('message', cmd.slice(1), msg, noop);

	if (cmd === '!') return (this.outgoing.shift() || noop)(new Error(msg.join(' ')));
	if (cmd === '>') return (this.outgoing.shift() || noop)(null, msg);

	var self = this;
	var node = this.incoming.push(null);

	var cb = function(err, result) {
		if (err) {
			self.incoming.set(node, '! '+err.message+'\n');
		} else {
			if (result === undefined) result = [];
			if (!Array.isArray(result)) result = [result];
			self.incoming.set(node, '> '+self.encode(result).join(' ')+'\n');
		}
		while (self.incoming.first()) self._push(self.incoming.shift());
	};

	this.emit('message', cmd, msg, cb);
};

HumanParser.prototype._push = function(data) {
	if (this.ended) return;
	this.ended = data === null;
	this.push(data);
};

HumanParser.prototype.send = function(cmd, args, cb) {
	if (typeof args === 'function') return this.send(cmd, [], args);
	if (args === undefined) args = [];
	if (!Array.isArray(args)) args = [args];
	args = args.length ? ' '+this.encode(args).join(' ') : '';
	if (!cb) return this._push('~'+cmd+args+'\n');
	this.outgoing.push(cb);
	this._push(cmd+args+'\n');
};

HumanParser.prototype.destroy = function() {
	if (this.closed) return;
	this.closed = true;
	this.end();
	this.emit('close');
};

module.exports = HumanParser;