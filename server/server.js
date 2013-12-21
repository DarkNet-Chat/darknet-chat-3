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
			var key = crypto.randomBytes(1024).toString("base64");
			var salt = uuid.v4().replace("-", "").toUpperCase();
			var challenge = crypto.randomBytes(1024).toString("base64");

			if(error || !user)
			{
				logging.error("Error fetching user", error);
				logging.warn("Requested user [%s] not found.  Sending fake data instead.", username);
			}
			else
			{
				if(user)
				{
					key = user.password;
					salt = user.salt;

					var challenge = crypto.randomBytes(1024).toString("base64");

					user.auth.challenge = challenge;
					user.auth.sent = Date.now();
					user.save(function()
					{
					});
				}
				else
					logging.warn("Requested user [%s] not found.  Sending fake data instead.", username);
			}

			var cipher = CryptoJS.AES.encrypt(challenge, key, { format: JsonFormatter }).toString();
			socket.emit("challenge", { salt: salt, challenge: cipher });
		});
	});

	socket.on("authenticate", function(auth)
	{
		console.log(auth);
	});
});
