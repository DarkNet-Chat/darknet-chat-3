var Chat = function()
{
	var socket = null;

	var init = function()
	{
		//var socket = io.connect("ws://chat.mudz.me/", { resource: "server" });
		socket = io.connect("ws://172.16.70.130:9940/", { resource: "server" });
		socket.on("error", function(e)
		{
			console.log("ERROR");
			console.log(e);
		});
		socket.on("connect", function()
		{
			Auth.socketReady();

			var cookies = document.cookie.split("; ");
			for(var i = 0; i < cookies.length; i++)
			{
				if(cookies[i].indexOf("authToken=") == 0)
				{
					var token = cookies[i].substr(10);
					socket.emit("token", token);
				}
			}
		});
		socket.on("disconnect", function(d)
		{
			console.log("DISCONNECT");
			console.log(d);
		});
	};

	var Auth = function()
	{
		var _$scope;
		var _authenticated;

		var socketReady = function()
		{
			socket.on("challenge", function(challenge)
			{
				var password = _$scope.auth.password;

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

				socket.emit("authenticate", { username: _$scope.auth.username, response: response });
			});

			socket.on("authenticate", function(user)
			{
				if(user.authenticated)
				{
					// Expire in 10 days
					var expires = new Date();
					expires.setDate(expires.getDate() + 10);

					document.cookie = "authToken=" + user.token + "; expires=" + expires.toGMTString();

					_authenticated = true;
					if(_$scope)
						_$scope.$apply(function()
						{
							_$scope.auth.password = "";
							_$scope.auth.visible = false;
						});

				}
				else if(user.method == "credentials")
				{
					alert("Username and/or password is incorrect.");
				}
			});
		}

		return {
			controller: function($scope)
			{
				_$scope = $scope;

				$scope.auth = {
					visible: true,
					username: "",
					password: ""
				}

				$scope.login = function()
				{
					socket.emit("challenge", { username: $scope.auth.username });
				};
			},

			socketReady: socketReady
		}
	}();

	var ChatAngularApp = angular.module("DarkNetChat", [ ]);

	ChatAngularApp.controller("auth", [ "$scope", Auth.controller ]);

	ChatAngularApp.controller("header", [ "$scope", function($scope)
	{
		$scope.info = {
			active: "",
			hover: ""
		};

		$scope.click = function(menu)
		{
			if(menu == $scope.info.active)
				$scope.info.active = "";
			else
				$scope.info.active = menu;
		};

		$scope.hover = function(menu)
		{
			$scope.info.hover = menu;
			console.log("Now hovering " + menu);
		};

		$scope.unhover = function(menu)
		{
			$scope.info.hover = "";
		};
	}]);

	return {
		init: init
	};
}();

$(document).ready(Chat.init);