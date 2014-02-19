var test = require('tap').test;
var hprotocol = require('../index');

test('hello in one buffer', function(t) {
	var protocol = hprotocol()
		.use('hello');

	var client = protocol();

	client.on('hello', function() {
		t.ok(true);
		t.end();
	});

	client.stream.write('hello\n');
});

test('hello in one buffer', function(t) {
	var protocol = hprotocol()
		.use('hello');

	var client = protocol();

	client.on('hello', function() {
		t.ok(true);
		t.end();
	});

	client.stream.write('hello\n');
});

test('hello + hello in one buffer', function(t) {
	var protocol = hprotocol()
		.use('hello');

	var client = protocol();
	var hellos = 0;

	client.on('hello', function() {
		hellos++;
		if (hellos < 2) return;
		t.same(hellos, 2);
		t.end();
	});

	client.stream.write('hello\n');
	client.stream.write('hello\n');
});

test('hello in fragments', function(t) {
	var protocol = hprotocol()
		.use('hello');

	var client = protocol();

	client.on('hello', function() {
		t.ok(true);
		t.end();
	});

	client.stream.write('h');
	client.stream.write('el');
	client.stream.write('l');
	client.stream.write('o\n');
});

test('two commands', function(t) {
	var protocol = hprotocol()
		.use('first')
		.use('second');

	var client = protocol();
	var visited = 0;

	client.on('first', function() {
		t.same(++visited, 1);
	});
	client.on('second', function() {
		t.same(++visited, 2);
		t.end();
	});

	client.stream.write('fir');
	client.stream.write('st\nsec');
	client.stream.write('ond\n');
});

test('hello + argument', function(t) {
	var protocol = hprotocol()
		.use('hello world');

	var client = protocol();

	client.on('hello', function(world) {
		t.same(world, 'verden');
		t.end();
	});

	client.stream.write('hello verden\n');
});

test('hello + varargs', function(t) {
	var protocol = hprotocol()
		.use('hello worlds...');

	var client = protocol();

	client.on('hello', function(worlds) {
		t.same(worlds, ['world', 'verden', 'welt']);
		t.end();
	});

	client.stream.write('hello world verden welt\n');
});

test('hello + encoding', function(t) {
	var protocol = hprotocol()
		.use('hello worlds');

	var client = protocol();

	client.on('hello', function(world) {
		t.same(world, 'øåæ¡™£¢∞§');
		t.end();
	});

	client.stream.write('hello %C3%B8%C3%A5%C3%A6%C2%A1%E2%84%A2%C2%A3%C2%A2%E2%88%9E%C2%A7\n');
});