var hprotocol = require('./index');
var protocol = hprotocol()
	.use('hello')
	.use('add a b > sum')

var p = protocol();

// for demo purpose we just pipe to ourselves
p.stream.pipe(p.stream);

p.on('hello', function() {
	console.log('hello command received')
});

p.on('add', function(a,b,cb) {
	cb(null, Number(a)+Number(b));
});

p.hello(); // lets say hello
p.add(1,2,function(err,sum) {
	console.log('1+2='+sum);
});