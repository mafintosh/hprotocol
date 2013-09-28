var test = require('tap').test;
var hprotocol = require('../index');

test('hello', function(t) {
	var protocol = hprotocol()
		.use('hello');

	var client = protocol();

	client.stream.on('data', function(data) {
		t.same(data.toString(), 'hello\n');
		t.end();
	});

	client.hello();
});

test('hello + argument', function(t) {
	var protocol = hprotocol()
		.use('hello world');

	var client = protocol();

	client.stream.on('data', function(data) {
		t.same(data.toString(), 'hello verden\n');
		t.end();
	});

	client.hello('verden');
});

test('hello + flush', function(t) {
	var protocol = hprotocol()
		.use('hello');

	var client = protocol();
	var messages = ['hello\n', 'flush\n'];

	client.stream.on('data', function(data) {
		t.same(data.toString(), messages.shift());
		if (!messages.length) t.end();
	});

	client.hello(function() {
		// force a flush
	});
});

test('hello + varargs', function(t) {
	var protocol = hprotocol()
		.use('hello worlds...');

	var client = protocol();

	client.stream.on('data', function(data) {
		t.same(data.toString(), 'hello world verden welt\n');
		t.end();
	});

	client.hello(['world', 'verden', 'welt']);
});

test('hello + encoding', function(t) {
	var protocol = hprotocol()
		.use('hello worlds');

	var client = protocol();

	client.stream.on('data', function(data) {
		t.same(data.toString(), 'hello %C3%B8%C3%A5%C3%A6%C2%A1%E2%84%A2%C2%A3%C2%A2%E2%88%9E%C2%A7\n');
		t.end();
	});

	client.hello('øåæ¡™£¢∞§');
});