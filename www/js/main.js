var Chat = function()
{
	var _preferences = { };

	var Socket = function()
	{
		var socket = null;

		_ons = [ ];

		return {
			start: function()
			{
				//var socket = io.connect("ws://chat.mudz.me/", { resource: "server" });
				socket = io.connect("ws://192.168.0.56:9940/", { resource: "server" });

				socket.on("connect", function()
				{
					var connects = [ ];
					for(var i = 0; i < _ons.length; i++)
					{
						socket.on(_ons[i].message, _ons[i].callback);
						if(_ons[i].message == "connect")
							connects.push(_ons[i].callback);
					}
					for(var i = 0; i < connects.length; i++)
						connects[i]();

					_ons = [ ];
				});
				socket.on("error", function(e)
				{
					console.log("ERROR");
					console.log(e);
				});
				socket.on("disconnect", function(d)
				{
					console.log("DISCONNECT");
					console.log(d);
				});
			},

			on: function(message, callback)
			{
				if(socket)
					socket.on(message, callback);
				else
					_ons.push({ message: message, callback: callback });
			},

			emit: function(message, data)
			{
				if(socket)
					socket.emit(message, data);
			}
		}
	}();

	var init = function()
	{
		Socket.start();
	};

	var ChatAngularApp = angular.module("DarkNetChat", [ ]);

	ChatAngularApp.controller("base", [ "$scope", function($scope)
	{
		$scope.blahblah = "asdf";

		$scope.preferences = { };

		var preferenceWatcher = function(newVal, oldVal)
		{
			for(var pref in newVal)
			{
				if(newVal[pref] != oldVal[pref])
				{
					console.log(pref, "changed");
					Socket.emit("preference", { name: pref, value: newVal[pref] });
					break;
				}
			}
		}

		var unwatch = function() { };

		Socket.on("me", function(me)
		{
			unwatch();

			$scope.$apply(function()
			{
				$scope.preferences.showJoinLeave = me.preferences.showJoinLeave;

				$scope.preferences.showTimestamps = me.preferences.showTimestamps;
				$scope.preferences.twelveHourTime = me.preferences.twelveHourTime;

				$scope.preferences.afkMessage = me.preferences.afkMessage;
			});

			unwatch = $scope.$watch("preferences", preferenceWatcher, true);
		});
	}]);

	ChatAngularApp.controller("auth", [ "$scope", function($scope)
	{
		$scope.auth = {
			visible: true,
			username: "",
			password: ""
		}

		$scope.login = function()
		{
			Socket.emit("challenge", { username: $scope.auth.username });
		};

		var _authenticated;

		Socket.on("connect", function()
		{
			var cookies = document.cookie.split("; ");
			for(var i = 0; i < cookies.length; i++)
			{
				if(cookies[i].indexOf("authToken=") == 0)
				{
					var token = cookies[i].substr(10);
					Socket.emit("token", token);
				}
			}
		});
		Socket.on("challenge", function(challenge)
		{
			var password = $scope.auth.password;

			var bits = password.split("");
			var offset = 0;

			for(var i = 0; i < bits.length; i++)
			{
				var v = bits[i].charCodeAt(0);
				if((i % 5) == 4)
					offset = offset / v;
				else if((i % 5) == 0 || (i % 5) == 3)
					offset += v;
				else
					offset *= v;
			}
			offset = Math.round(offset);

			var hpass = SHA256(password);

			for(var i = 0; i < challenge.salt.length; i++)
			{
				var uc = challenge.salt.substr(i, 1);
				var pos = offset % hpass.length;
				hpass = hpass.substr(0, pos) + uc + hpass.substring(pos);
				offset -= pos;
			}

			var key = SHA256(hpass);

			challenge = challenge.challenge;
			var plaintext = "fail";
			try
			{
				plaintext = CryptoJS.AES.decrypt(challenge, key, { format: JsonFormatter}).toString(CryptoJS.enc.Utf8);
			} catch(e){ }

			var response = plaintext.split("").reverse().join("");
			response = CryptoJS.AES.encrypt(response, key, { format: JsonFormatter }).toString();

			Socket.emit("authenticate", { username: $scope.auth.username, response: response });
		});

		Socket.on("authenticate", function(user)
		{
			if(user.authenticated)
			{
				// Expire in 10 days
				var expires = new Date();
				expires.setDate(expires.getDate() + 10);

				document.cookie = "authToken=" + user.token + "; expires=" + expires.toGMTString();

				_authenticated = true;
				$scope.$apply(function()
				{
					$scope.auth.password = "";
					$scope.auth.visible = false;
				});

				Socket.emit("me");
			}
			else if(user.method == "credentials")
			{
				alert("Username and/or password is incorrect.");
			}
		});
	}]);

	ChatAngularApp.controller("users", [ "$scope", function($scope)
	{
		var _me = null;

		Socket.on("me", function(me)
		{
			_me = me;
			Socket.emit("join");
		});

		Socket.on("join", function(room)
		{
			console.log(room);
		});
	}]);

	ChatAngularApp.controller("input", [ "$scope", function($scope)
	{
		$scope.input = {
			value: ""
		}

		$scope.send = function()
		{
			var message = $scope.input.value.trim();

			var ct = message.toUpperCase();

			if(ct.substring(0, 6) == "/CLEAR")
			{
			}
			else if(ct.substring(0, 4) == "/AFK")
			{
				Socket.emit("afk", message.substring(5));
			}
			else if(ct.substring(0, 8) == "/IGNORE ")
			{
				var ignore = message.substring(8);
			}
			else if(ct.substring(0, 8) == "/UNIGNORE ")
			{
				var unignore = message.substring(10);
			}
			else if(ct.substring(0, 7) == "/STALK ")
			{
				var stalk = message.substring(7);
			}
			else if(ct.substring(0, 7) == "/UNSTALK ")
			{
				var unstalk = message.substring(9);
			}
			else if(ct.substring(0, 11) == "/HIGHLIGHT ")
			{
				var highlight = message.substring(11);
			}
			else if(ct.substring(0, 11) == "/UNHIGHLIGHT ")
			{
				var unhighlight = message.substring(13);
			}
			else
			{
				if(message != "")
					Socket.emit("message", message);
			}

			$scope.input.value = "";
		}
	}]);

	ChatAngularApp.controller("chatlog", [ "$scope", function($scope)
	{
		$scope.log = [ ];

		var cl = $("#chatlog")[0];

		Socket.on("joined", function(user)
		{
			$scope.$apply(function()
			{
				$scope.log.push({ type: "join", username: user.username, color: user.color, time: new Date(user.joined) });
			});
		});

		Socket.on("left", function(user)
		{
			$scope.$apply(function()
			{
				$scope.log.push({ type: "leave", username: user.username, color: user.color, time: new Date(user.left) });
			});
		});

		Socket.on("message", function(message)
		{
			console.log("message");
			var doScroll = (cl.scrollTop == 0 || (cl.scrollTop == (cl.scrollHeight - cl.offsetHeight)));

			message.time = new Date(message.time);
			$scope.$apply(function()
			{
				if($scope.log.length > 0 && $scope.log[$scope.log.length - 1].type == "user" && $scope.log[$scope.log.length - 1].username == message.from.username)
					$scope.log[$scope.log.length - 1].messages.push(message);
				else
					$scope.log.push({ type: "user", username: message.from.username, avatar: message.from.avatar, color: message.from.color, messages: [ message ]});
			});

			if(doScroll)
				setTimeout(function()
				{
					cl.scrollTop = cl.scrollHeight;
				}, 10);
		});
	}]);

	ChatAngularApp.controller("header", [ "$scope", function($scope)
	{
		$scope.info = {
			active: ""
		};

		$scope.click = function(menu)
		{
			if(menu == $scope.info.active)
				$scope.info.active = "";
			else
				$scope.info.active = menu;
		};
	}]);

	ChatAngularApp.directive("noBubble", function()
	{
		return {
			link: function(scope, element, attrs)
			{
				element.on("click", function(e)
				{
					e.stopPropagation();
					//e.preventDefault();
					//return false;
				})
			}
		}
	});

	return {
		init: init
	};
}();

$(document).ready(Chat.init);