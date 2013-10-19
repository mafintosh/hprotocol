# hprotocol

Streaming human readable command protocol

	npm install hprotocol

[![build status](https://secure.travis-ci.org/mafintosh/hprotocol.png)](http://travis-ci.org/mafintosh/hprotocol)

## What does it do?

hprotocol is a redis like protocol that its easy to parse both for programs and human beings.
As an example lets echo a value

``` js
var hprotocol = require('hprotocol');
var net = require('net');

net.createServer(function(socket) {
	var protocol = hprotocol()

	// listen for the echo command
	client.on('message', function(cmd, args, callback) {
		if (cmd === 'echo') return callback(null, args);
		callback(new Error('unknown command'));
	});

	// setup the pipe chain
	socket.pipe(protocol).pipe(socket);
}).listen(9999);
```

Open a new termainal and try interfacing with the server.

	$ nc localhost 9999 # create a socket to the server
	$ echo test         # send a echo command
	$ > test            # this is the reply from the server

Similary you can interface with the server using node:

``` js
var protocol = hprotocol(); // using the same protocol as above
var socket = net.connect(9999, 'localhost');

socket.pipe(protocol).pipe(socket);

protocol.send('echo', ['test'], function(err, value) {
	console.log(value); // prints ['test']
});
```

## Protocol syntax

All messages are seperated by newlines and arguments are seperated by whitespace.

```
command arg1 arg2 ...
```

A response starts with `>` and error responses start with `!`

```
echo a b c
> a b c
bad
! unknown command
```

If you do care about the response send ~ before the command

```
~echo a b c
```

## License

MIT