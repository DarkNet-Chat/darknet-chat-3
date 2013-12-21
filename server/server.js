var logging = require("./modules/logging");

var users = require("./User");
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
	new users.User(socket);
	//socket.emit("message", { body: "Hello, asshole" });
});
