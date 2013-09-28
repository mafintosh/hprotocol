# hprotocol

Streaming human readable command protocol

	npm install hprotocol

[![build status](https://secure.travis-ci.org/mafintosh/hprotocol.png)](http://travis-ci.org/mafintosh/hprotocol)

## What does it do?

hprotocol allows you to easily generate a command protocol that its easy to
parse both for programs and human beings.

As an example lets generate a protocol that echoes a value

``` js
var hprotocol = require('hprotocol');
var net = require('net');

var protocol = hprotocol()
	.use('echo value > value');

net.createServer(function(socket) {
	var client = protocol();

	// listen for the echo command
	client.on('echo', function(value, callback) {
		callback(null, 'echo: '+value);
	});

	// setup the pipe chain
	socket.pipe(client.stream).pipe(socket);
}).listen(9999);
```

The `echo value > value` syntax denotes an `echo` command that accepts a value and returns a value.
Open a new termainal and try interfacing with the server.

	$ nc localhost 9999 # create a socket to the server
	$ echo test         # send a echo command
	$ > test            # this is the reply from the server

Similary you can interface with the server using node:

``` js
var client = protocol(); // using the same protocol as above
var socket = net.connect(9999, 'localhost');

socket.pipe(client.stream).pipe(socket);

client.echo('test', function(err, value) {
	console.log(value); // prints echo: test
});
```

Optionally you can use pass the stream to protocol to setup the pipe chain for you

``` js
var socket = net.connect(9999, 'localhost');
var client = protocol(socket);

client.echo(...);
```

## Command syntax

Similary to the above example the command syntax is always

	command argument1 argument2 ... > response

If the command does not have a response just do

	command argument1 arguments2

If a series of arguments should the passed as an array add `...` to the syntax

	command test args... > response

Similary if your response is an array

	command test args... > response...

Some examples of this could be

``` js
var protocol = hprotocol()
	.use('hello')
	.use('add numbers... > number')
	.use('reverse values... > values...')

var client = protocol();

client.on('hello', function() {
	// no response for this since no > in the spec
	console.log('hello world');
});

client.on('add', function(numbers, callback) {
	numbers = numbers.map(Number); // convert to numbers
	var sum = numbers.reduce(function(a, b) {
		return a+b;
	}, 0);
	callback(null, sum); // return a single value
});

client.on('reverse', function(values, callback) {
	callback(null, values.reverse());
});

// setup a pipe chain
socket.pipe(client.stream).pipe(socket);
```

If the above socket was listening on port 9999 we could do

	echo 'add 1 2 3 4' | nc localhost 9999
	# prints > 10

## License

MIT