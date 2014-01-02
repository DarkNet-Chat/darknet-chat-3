var logging = require("./logging");
var db = require("./db");

var uuid = require("uuid");
var crypto = require("crypto");
var CryptoJS = require("node-cryptojs-aes").CryptoJS;
var JsonFormatter = require("node-cryptojs-aes").JsonFormatter;

exports.User = function()
{
	var _all = [ ];

	var getAllUserObjects = function()
	{
		var all = [ ];
		for(var i = 0; i < _all.length; i++)
		{
			var u = _all[i].toObject();
			delete u.auth;
			delete u.password;
			delete u.salt;
			delete u.preferences;

			if(u.avatars.length == 0)
				u.avatars.push({ index: 0, path: "assvatar.png" });

			all.push(u);
		}

		return all;
	}

	return function(socket, _io)
	{
		if(!io)
			io = _io;

		var _token = null;
		var _username = null;

		socket.on("token", function(token)
		{
			logging.verbose("Received authentication attempt with token [%s]", token);

			db.users.model.findOne({ "auth.token": token }, function(error, user)
			{
				var authenticated = false;
				var realToken = "";

				if(error || !user)
				{
					if(error)
						logging.error("Error fetching user", error);
					logging.warn("No user found with requested token [%s].", token);
				}
				else
				{
					if(Date.now() < user.auth.expiry.getTime())
					{
						authenticated = true;
						realToken = user.auth.token;
						_token = user.auth.token;

						var expiry = new Date();
						expiry.setDate(expiry.getDate() + 10);
						user.auth.expiry = expiry;

						logging.info("Successfully authenticated user [%s] with token [%s]", user.username, user.auth.token);
					}
					else
						logging.info("Token [%s] expired for user [%s]", token, user.username);
				}

				socket.emit("authenticate", { authenticated: authenticated, method: "token", token: realToken });
			});
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
				else if(Date.now() - user.auth.sent.getTime() > 3000)
				{
					logging.warn("Authentication challenge for user [%s] expired.", username)
				}
				else
				{
					var key = user.password;

					var plaintext = CryptoJS.AES.decrypt(response, key, { format: JsonFormatter }).toString(CryptoJS.enc.Utf8);

					var expected = user.auth.challenge.split("").reverse().join("");
					if(plaintext == expected)
					{
						logging.info("Successfully authenticated user [%s]", username);

						if(user.auth && user.auth.expiry && Date.now() < user.auth.expiry.getTime())
							token = user.auth.token;

						_token = token;

						authenticated = true;
						user.auth.token = token;
						var expiry = new Date();
						expiry.setDate(expiry.getDate() + 10);
						user.auth.expiry = expiry;
						user.save();
					}
					else
						logging.warn("Authentication challenge for user [%s] does not match expected value", username);
				}

				socket.emit("authenticate", { authenticated: authenticated, method: "credentials", token: token });
			});
		});

		socket.on("me", function()
		{
			logging.verbose("Getting own information for token [%s]", _token);
			db.users.model.findOne({ "auth.token": _token }, function(error, user)
			{
				if(error || !user)
				{
					if(error)
						logging.error("Error getting user for token [%s]", _token, error);
					logging.warn("Could not get user for token [%s]", _token);
				}
				else
				{
					var u = user.toObject();
					delete u.auth;
					delete u.password;
					delete u.salt;

					_username = u.username;

					socket.emit("me", u);
				}
			})
		});

		socket.on("join", function()
		{
			logging.verbose("User [%s] joining chat", _token);
			db.users.model.findOne({ "auth.token": _token }, function(error, user)
			{
				if(error || !user)
				{
					if(error)
						logging.error("Error getting user for token [%s]", _token, error);
					logging.warn("Could not get user for token [%s]", _token);
				}
				else
				{
					user.lastSeen = new Date();
					user.save();

					_all.push(user);

					socket.emit("join", {
						title: "",
						users: getAllUserObjects()
					})
				}
			});
		});

		socket.on("message", function(message)
		{
			logging.verbose("Sending message from [%s]", _username);
			socket.broadcast.emit("message", { from: _username, message: message });
			socket.emit("message", { from: _username, message: message });
		});
	}
}();
