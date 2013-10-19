var test = require('tap').test;
var hprotocol = require('../index');

test('hello', function(t) {
	var protocol = hprotocol();

	protocol.on('data', function(data) {
		t.same(data.toString(), '~hello\n');
		t.end();
	});

	protocol.send('hello');
});

test('hello + argument', function(t) {
	var protocol = hprotocol();

	protocol.on('data', function(data) {
		t.same(data.toString(), '~hello verden\n');
		t.end();
	});

	protocol.send('hello', 'verden');
});

test('hello + flush', function(t) {
	var protocol = hprotocol();
	var messages = ['hello\n'];

	protocol.on('data', function(data) {
		t.same(data.toString(), messages.shift());
		if (!messages.length) t.end();
	});

	protocol.send('hello', function() {
		// force a flush
	});
});

test('hello + varargs', function(t) {
	var protocol = hprotocol();

	protocol.on('data', function(data) {
		t.same(data.toString(), '~hello world verden welt\n');
		t.end();
	});

	protocol.send('hello', ['world', 'verden', 'welt']);
});

test('hello + encoding', function(t) {
	var protocol = hprotocol();

	protocol.on('data', function(data) {
		t.same(data.toString(), '~hello %C3%B8%C3%A5%C3%A6%C2%A1%E2%84%A2%C2%A3%C2%A2%E2%88%9E%C2%A7\n');
		t.end();
	});

	protocol.send('hello', 'øåæ¡™£¢∞§');
});