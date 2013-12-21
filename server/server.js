var logging = require("./modules/logging");

var uuid = require("uuid");
var crypto = require("crypto");
var CryptoJS = require("node-cryptojs-aes").CryptoJS;
var JsonFormatter = require("node-cryptojs-aes").JsonFormatter;

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
		var username = challenge.username;
		logging.verbose("Received challenge request for user [%s]", username);

		db.users.model.findOne({ username: username }, function(error, user)
		{
			if(error || !user)
			{
				logging.error("Requested user [%s] not found.  Sending some bullshit data instead.", username);

				var salt = uuid.v4().replace("-", "");
				var cipher = CryptoJS.AES.encrypt(crypto.randomBytes(1024).toString("base64"), crypto.randomBytes(1024).toString("base64"), { format: JsonFormatter }).toString();
				socket.emit("challenge", { salt: salt, challenge: cipher });
			}
			else
			{
				if(user)
				{
					var challenge = crypto.randomBytes(1024).toString("base64");
					var cipher = CryptoJS.AES.encrypt(challenge, user.password, { format: JsonFormatter }).toString();

					user.auth.challenge = challenge;
					user.auth.sent = Date.now();
					user.save(function()
					{
						socket.emit("challenge", { salt: user.salt, challenge: cipher });
					});
				}
			}
		});
	});

	socket.on("authenticate", function(auth)
	{
		console.log(auth);
	});
});
