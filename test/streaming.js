var test = require('tap').test;
var net = require('net');
var hprotocol = require('../index');

test('protocol.pipe(protocol)', function(t) {
	var protocol = hprotocol();

	protocol.on('message', function(cmd, args, cb) {
		if (cmd === 'fail') return cb(new Error('fail'));
		cb(null, 'echo: '+args[0]);
	});

	protocol.send('echo', 'a', function(err, val) {
		t.same(val[0], 'echo: a');
		protocol.send('fail', function(err) {
			t.ok(!!err);
			t.same(err.message, 'fail');
			t.end();
		});
	});

	protocol.pipe(protocol);
});

test('pipe + burst', function(t) {
	var protocol = hprotocol();

	protocol.on('message', function(cmd, args, cb) {
		cb(null, args);
	});

	protocol.pipe(protocol);

	process.nextTick(function() {
		var expecting = 10;
		var next = 0;

		for (var i = 0; i < expecting; i++) {
			protocol.send('echo', ''+i, function(err, val) {
				t.same(val[0], ''+next++);
				if (next === expecting) t.end();
			});
		}
	});
});

test('net.connect() + protocol', function(t) {

	var server = net.createServer(function(socket) {
		var protocol = hprotocol();
		protocol.on('message', function(cmd, args, cb) {
			protocol.send(cmd, ['server'].concat(args), cb);
		});
		protocol.pipe(socket).pipe(protocol);
	});

	server.listen(9876, function() {
		var socket = net.connect(9876);
		var protocol = hprotocol();

		t.plan(2);
		protocol.on('message', function(cmd, args, cb) {
			if (cmd === 'echo') return cb(null, ['client'].concat(args));
			cb(new Error('unknown command'));
		});
		protocol.send('echo', 'a', function(err, val) {
			t.ok(!err);
			t.same(val, ['client', 'server', 'a']);
			socket.destroy();
			server.close();
		});
		protocol.on('close', function() {
			t.end();
		});
		protocol.pipe(socket).pipe(protocol);
	});
});