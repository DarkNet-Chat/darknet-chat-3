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
				if(error)
					logging.error("Error fetching user", error);
				logging.warn("Requested user [%s] not found.  Sending fake data instead.", username);
			}
			else
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

			var cipher = CryptoJS.AES.encrypt(challenge, key, { format: JsonFormatter }).toString();
			socket.emit("challenge", { salt: salt, challenge: cipher });
		});
	});

	socket.on("authenticate", function(auth)
	{
		var username = auth.username;
		var response = auth.response;

		var token = uuid.v4();
		var authenticated = false;

		logging.verbose("Received authentication response for user [%s]", username);

		db.users.model.findOne({ username: username }, function(error, user)
		{
			if(error || !user)
			{
				if(error)
					logging.error("Error fetching user", error);
				logging.warn("Requested user [%s] not found.  Denying authentication.", username);
			}
			else
			{
				console.log(user.auth.sent);
				key = user.password;

				var plaintext = CryptoJS.AES.decrypt(response, key, { format: JsonFormatter }).toString(CryptoJS.enc.Base64);
				console.log(plaintext);
			}

			var cipher = CryptoJS.AES.encrypt(challenge, key, { format: JsonFormatter }).toString();
			socket.emit("challenge", { salt: salt, challenge: cipher });
		});
	});
});
