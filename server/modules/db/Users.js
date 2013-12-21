var mongoose = require("mongoose");

var schema = new mongoose.Schema({
	username: { type: String, index: { unique: true }},
	password: String,
	salt: String,
	role: String,
	color: String,
	title: String,
	lastSeen: { type: Date, default: Date.now },
	auth: {
		challenge: String,
		sent: { type: Date, default: Date.now },
		token: String
	}
});

exports.model = mongoose.model("User", schema);
