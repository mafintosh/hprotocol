var test = require('tap').test;
var hprotocol = require('../index');

test('hello in one buffer', function(t) {
	var protocol = hprotocol();

	protocol.on('message', function(cmd) {
		t.same(cmd, 'hello');
		t.end();
	});

	protocol.write('hello\n');

});

test('hello + hello in one buffer', function(t) {
	var protocol = hprotocol();
	var hellos = 0;

	protocol.on('message', function(cmd) {
		t.same(cmd, 'hello');
		hellos++;
		if (hellos < 2) return;
		t.same(hellos, 2);
		t.end();
	});

	protocol.write('hello\n');
	protocol.write('hello\n');
});

test('hello in fragments', function(t) {
	var protocol = hprotocol();

	protocol.on('message', function(cmd) {
		t.same(cmd, 'hello');
		t.end();
	});

	protocol.write('h');
	protocol.write('el');
	protocol.write('l');
	protocol.write('o\n');
});

test('two commands', function(t) {
	var protocol = hprotocol();
	var visited = 0;

	protocol.on('message', function(cmd) {
		if (cmd === 'first') return t.same(++visited, 1);
		if (cmd === 'second') {
			t.same(++visited, 2);
			t.end();
			return;
		}
		t.ok(false);
	});

	protocol.write('fir');
	protocol.write('st\nsec');
	protocol.write('ond\n');
});

test('hello + argument', function(t) {
	var protocol = hprotocol();

	protocol.on('message', function(cmd, args) {
		t.same(cmd, 'hello');
		t.same(args[0], 'verden');
		t.end();
	});

	protocol.write('hello verden\n');
});

test('hello + varargs', function(t) {
	var protocol = hprotocol();

	protocol.on('message', function(cmd, args) {
		t.same(cmd, 'hello');
		t.same(args, ['world', 'verden', 'welt']);
		t.end();
	});

	protocol.write('hello world verden welt\n');
});

test('hello + encoding', function(t) {
	var protocol = hprotocol();

	protocol.on('message', function(cmd, args) {
		t.same(cmd, 'hello');
		t.same(args[0], 'øåæ¡™£¢∞§');
		t.end();
	});

	protocol.write('hello %C3%B8%C3%A5%C3%A6%C2%A1%E2%84%A2%C2%A3%C2%A2%E2%88%9E%C2%A7\n');
});