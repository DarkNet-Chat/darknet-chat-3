var logging = require("./modules/logging");

var uuid = require("uuid");
var crypto = require("crypto");
var node_cryptojs = require('node-cryptojs-aes');
var aes = node_cryptojs.CryptoJS.AES;
var aesJSON = node_cryptojs.JsonFormatter;

var db = require("./modules/db");


logging.verbose("Starting socket.io server on port 9940");
var io = require("socket.io").listen(9940);
io.set("resource", "/server");

io.sockets.on("connection", function(socket)
{
	//socket.emit("message", { body: "Hello, asshole" });
	socket.on("token", function(token)
	{
		console.log(token);
	});

	socket.on("challenge", function(challenge)
	{
		logging.verbose("Received challenge request for user [%s]", challenge.username);

		db.users.model.findOne({ username: challenge.username }, function(error, user)
		{
			if(error || !user)
			{
				logging.error("Requested user [%s] not found.  Sending some bullshit data instead.", challenge.username);

				var salt = uuid.v4().replace("-", "");
				var cipher = aes.encrypt(crypto.randomBytes(1024).toString("base64"), crypto.randomBytes(1024).toString("base64"), { format: aesJSON }).toString();
				socket.emit("challenge", { salt: salt, challenge: cipher });
			}
			else
			{
				if(user)
				{
					var challenge = crypto.randomBytes(1024).toString("base64");
					var cipher = aes.encrypt(challenge, user.password, { format: aesJSON }).toString();

					user.auth.challenge = challenge;
					user.auth.sent = Date.now();
					socket.emit("challenge", { salt: user.salt, challenge: cipher });
				}
			}
		});
	});

	socket.on("authenticate", function(auth)
	{
		console.log(auth);
	});
});
