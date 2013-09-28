var test = require('tap').test;
var net = require('net');
var hprotocol = require('../index');

test('client.stream.pipe(client.stream)', function(t) {
	var protocol = hprotocol()
		.use('echo value > value');

	var client = protocol();

	client.on('echo', function(val, cb) {
		if (val === 'fail') return cb(new Error('fail'));
		cb(null, 'echo: '+val);
	});

	client.echo('a', function(err, val) {
		t.same(val, 'echo: a');
		client.echo('fail', function(err) {
			t.ok(!!err);
			t.same(err.message, 'fail');
			t.end();
		});
	});

	client.stream.pipe(client.stream);
});

test('pipe + burst', function(t) {
	var protocol = hprotocol()
		.use('echo value > value');

	var client = protocol();

	client.on('echo', function(val, cb) {
		cb(null, val);
	});

	client.stream.pipe(client.stream);

	var expecting = 100;
	var next = 0;

	for (var i = 0; i < expecting; i++) {
		client.echo(''+i, function(err, val) {
			t.same(val, ''+next++);
			if (next === expecting) t.end();
		});
	}
});

test('protocol(socket)', function(t) {
	var protocol = hprotocol()
		.use('echo val > val');

	var server = net.createServer(function(socket) {
		var client = protocol(socket);
		client.on('echo', function(val, cb) {
			client.echo('server: '+val, cb);
		});
	});

	server.listen(9876, function() {
		var socket = net.connect(9876);
		var client = protocol(socket);

		t.plan(2);
		client.on('echo', function(val, cb) {
			cb(null, 'client: '+val);
		});
		client.echo('a', function(err, val) {
			t.ok(!err);
			t.same(val, 'client: server: a');
			socket.destroy();
			server.close();
		});
		client.on('close', function() {
			t.end();
		});
	});
});