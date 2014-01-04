var logging = require("../logging");

var mongoose = require("mongoose");
var db = require("../db");

var schema = new mongoose.Schema({
	timestamp: { type: Date, default: Date.now },
	userID: String,
	type: String,
	body: String
});

exports.model = mongoose.model("History", schema, "history");

var chatInCache = 0;
var lastHundred = [ ];

var cleanUser = function(user)
{
	delete user.auth;
	delete user.preferences;
	delete user.avatars;
	delete user.salt;
	delete user.password;
}

var attachUserToHistory = function(h)
{
	return function(err, user)
	{
		if(err || !user)
		{
			if(err)
				logging.error("Error fetching user [%s] for history", h.userID, err);
			logging.warn("Could not get user [%s] for history", h.userID);
		}
		else
		{
			h.user = user;
			//cleanUser(h.user);
		}
	}
};

var q = exports.model.find().sort({ timestamp: -1 }).limit(300);
q.exec(function(err, history)
{
	if(err || !history)
	{
		if(err)
			logging.error("Error getting history", err);
		logging.warn("Could not load history");
	}
	else
	{
		var tmp_users = { };

		for(var i = history.length - 1; i >= 0; i--)
		{
			var h = history[i].toObject();

			if(chatInCache < 100)
			{
				lastHundred.push(h);
				if(h.type == "chat")
					chatInCache++;

				db.users.model.findOne({ _id: h.userID }, attachUserToHistory(h));
			}
		}
	}
});

exports.saveHistory = function(timestamp, user, type, body)
{
	var h = {
		timestamp: timestamp,
		userID: user._id,
		type: type,
		body: body
	};

	var history = new exports.model(h);
	history.save();

	h.user = user;

	lastHundred.push(h);
	if(h.type == "chat")
	{
		if(chatInCache == 100)
		{
			var remove = 0;
			for(var i = 0; i < lastHundred.length; i++)
			{
				remove++;
				if(lastHundred[i].type == "chat")
					break;
			}
			lastHundred.splice(0, remove);
		}
		else
			chatInCache++;
	}
};

exports.getLastHundred = function()
{
	return lastHundred;
};