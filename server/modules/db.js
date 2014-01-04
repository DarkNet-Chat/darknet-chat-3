var mongoose = require("mongoose");
mongoose.connect("mongodb://localhost/DarkNetChat");

exports.users = require("./db/Users");
exports.history = require("./db/History");
