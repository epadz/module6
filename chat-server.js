// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	url = require('url'),
	path = require('path'),
	mime = require('mime'),
	fs = require("fs");

var rooms = [{
	name:'Open Forum',
	pw:null,
	admin: null,
	users: [],
	isMessage: false,
	private: false,
	banned: [],
	openTo: [],
}];
var users = [];
var clients = [];
var rid = 1;
var uid = 0;
var mid = 0;

var dis = 0;
var con = 0;

//$.getScript("https://crypto-js.googlecode.com/svn/tags/3.1.2/build/rollups/aes.js", function(){});

var app = http.createServer(function(req, resp){
	var filename = path.join(__dirname, "", url.parse(req.url).pathname);
	(fs.exists || path.exists)(filename, function(exists){
		if (exists) {
			fs.readFile(filename, function(err, data){
				if (err) {
					// File exists but is not readable (permissions issue?)
					resp.writeHead(500, {
						"Content-Type": "text/plain"
					});
					resp.write("Internal server error: could not read file");
					resp.end();
					return;
				}
 
				// File exists and is readable
				var mimetype = mime.lookup(filename);
				resp.writeHead(200, {
					"Content-Type": mimetype
				});
				resp.write(data);
				resp.end();
				return;
			});
		}else{
			// File does not exist
			resp.writeHead(404, {
				"Content-Type": "text/plain"
			});
			resp.write("Requested file not found: "+filename);
			resp.end();
			return;
		}
	});
});
app.listen(3456);
 
// Do the Socket.IO magic:
var io = socketio.listen(app);
io.sockets.on("connection", function(socket){
	// This callback runs when a new Socket.IO connection is established.
	console.log("connect: " + con);
	con++;
	console.log(socket.id);
	
	socket.on('newUser', function(data){
		usrIfo = {
			un: data,
			uid: users.length
		};
		
		names = users.filter(function(val){
			return val.un == data;
		});
		if(names.length > 0){
			socket.emit('unTaken', data);
		}else{
			users.push(usrIfo);
			
			clients.push(socket)
			//console.log(users.toString());
			
			socket.emit('unResponse', usrIfo);
			socket.un = data;
			socket.uid = usrIfo.uid;
			socket.info = usrIfo;
			
			rooms[0].users.push(usrIfo);
			
			io.sockets.emit('roomList', rooms);
			socket.join("0");
			socket.room = "0";
			//console.log(JSON.stringify(rooms));
		}
	});
	
	
	socket.on('newRoom', function(data){
		data.pw = CryptoJS.AES.encrypt(data.pw + "", "keyphrase");
		rooms[rid] = data;
		rid++;
		console.log("New Room" + JSON.stringify(rooms));
		io.sockets.emit('roomList', rooms);
	});
	
	socket.on('enterRoom', function(data){
		console.log(JSON.stringify(data));
		console.log(JSON.stringify(rooms));
		console.log(data.p != null);
		console.log(data.p == rooms[parseInt(data.r)].pw);
		var pwCorrect = data.p != null && CryptoJS.AES.encrypt(data.p, "keyphrase") == rooms[parseInt(data.r)].pw;
		if(data.p == null || pwCorrect){
			console.log("good");
			rooms[parseInt(socket.room)].users = rooms[parseInt(socket.room)].users.filter(function(val){
				return val.uid != socket.uid;
			});//removes user from rooms[room].users		
			socket.leave(socket.room);
			socket.join(data.r + "");
			socket.room = data.r + "";
			rooms[parseInt(socket.room)].users.push(socket.info);
			socket.emit("enterRoomAlert",rooms[parseInt(socket.room)]);
			io.sockets.emit('roomList', rooms);
		}else{
			socket.emit("wrongPass", "");
		}
	});
	socket.on('askUsers', function(data){
		socket.emit("giveUsers", users);
	});
	socket.on('message_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.
 		if(data["message"])
		{
			//console.log("message: "+data["message"]); // log it to the Node.JS output
			io.sockets.to(socket.room).emit("message_to_client",{poster: socket.un + "", message:data["message"] }) // broadcast the message to other users
			
		}		
	});
	
	socket.on('kickOut', function(data){
		if(socket.uid == rooms[parseInt(data.rid)].admin && clients[data.uid].connected){//checks to make sure it is the admin issuing the request and client is still connected		
			rooms[parseInt(clients[data.uid].room)].users = rooms[parseInt(clients[data.uid].room)].users.filter(function(val){
				return val.uid != clients[data.uid].uid;
			});//removes user from rooms[room].users		
			clients[data.uid].leave(clients[data.uid].room);
			clients[data.uid].join(0 + "");
			clients[data.uid].room = 0 + "";
			rooms[parseInt(clients[data.uid].room)].users.push(clients[data.uid].info);
			clients[data.uid].emit("enterRoomAlert",rooms[parseInt(clients[data.uid].room)]);
			io.sockets.emit('roomList', rooms);		
			clients[data.uid].emit("kickedOut","");	
		}
	});
	socket.on('ban', function(data){
		if(socket.uid == rooms[parseInt(data.rid)].admin && clients[data.uid].connected){//checks to make sure it is the admin issuing the request and client is still connected		
			rooms[parseInt(clients[data.uid].room)].users = rooms[parseInt(clients[data.uid].room)].users.filter(function(val){
				return val.uid != clients[data.uid].uid;
			});//removes user from rooms[room].users		
			clients[data.uid].leave(clients[data.uid].room);
			clients[data.uid].join(0 + "");
			clients[data.uid].room = 0 + "";
			rooms[parseInt(clients[data.uid].room)].users.push(clients[data.uid].info);
			clients[data.uid].emit("enterRoomAlert",rooms[parseInt(clients[data.uid].room)]);
			rooms[parseInt(data.rid)].banned.push(parseInt(data.uid));
			io.sockets.emit('roomList', rooms);		
			clients[data.uid].emit("banned","");				
		}
	});
	
	socket.on('disconnect', function(){
		if(typeof socket.uid !== 'undefined'){
			console.log("disconnect: " + dis + " from " + socket.room + " by " + socket.uid);
			dis++;
			rooms[parseInt(socket.room)].users = rooms[parseInt(socket.room)].users.filter(function(val){
				return val.uid != socket.uid;
			});//removes user from rooms[room].users		
			socket.leave(socket.room);
			
			users[parseInt(socket.uid)].disconnected = true;
			
			io.sockets.emit('roomList', rooms);
		}
	});
	
});