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
	private: false,
	banned: []
}];
var users = [];
var rid = 1;
var uid = 0;
var mid = 0;

var dis = 0;
var con = 0;

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
	
	socket.on('newUser', function(data){
		usrIfo = {
			un: data,
			uid: users.length
		};
		users.push(usrIfo);
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
	});
	
	
	socket.on('newRoom', function(data){
		rooms[rid] = data;
		rid++;
		//console.log(JSON.stringify(rooms));
		io.sockets.emit('roomList', rooms);
	});
	
	socket.on('enterRoom', function(data){
		rooms[parseInt(socket.room)].users = rooms[parseInt(socket.room)].users.filter(function(val){
			return val.uid != socket.uid;
		});//removes user from rooms[room].users		
		socket.leave(socket.room);
		socket.join(data + "");
		socket.room = data + "";
		rooms[parseInt(socket.room)].users.push(socket.info);
		socket.emit("enterRoomAlert",rooms[parseInt(socket.room)]);
		io.sockets.emit('roomList', rooms);
	});
	
	socket.on('message_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.
 		if(data["message"])
		{
			//console.log("message: "+data["message"]); // log it to the Node.JS output
			io.sockets.to(socket.room).emit("message_to_client",{poster: socket.un + "", message:data["message"] }) // broadcast the message to other users
			
		}		
	});
	
	socket.on('disconnect', function(){
		console.log("disconnect: " + dis);
		dis++;
		rooms[parseInt(socket.room)].users = rooms[parseInt(socket.room)].users.filter(function(val){
			return val.uid != socket.uid;
		});//removes user from rooms[room].users		
		socket.leave(socket.room);
		socket.emit("enterRoomAlert",rooms);
	});
	
});