var logging = require("./modules/logging");
var users = require("./modules/User");

logging.verbose("Starting socket.io server on port 9940");

var io = require("socket.io").listen(9940);
io.set("resource", "/server");

io.sockets.on("connection", function(socket)
{
	new users.User(socket);
});
