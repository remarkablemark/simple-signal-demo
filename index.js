const fs = require('fs').promises;
const http = require('http');
const socketio = require('socket.io');
const SimpleSignalServer = require('simple-signal-server');

const html = fs.readFile('index.html');

async function requestListener(req, res) {
  res.setHeader('Content-Type', 'text/html');
  res.end(await html);
}

const server = http.createServer(requestListener);
const io = socketio(server);
const signal = new SimpleSignalServer(io);

let connections = 0;

io.on('connection', socket => {
  console.log('Connections: %d', ++connections);

  socket.on('disconnect', () => {
    console.log('Connections: %d', --connections);
  });
});

// here we hardcode some fixed rooms, but you could easily create them dynamically
const rooms = {
  'Room 1': new Set(),
  'Room 2': new Set(),
  'Room 3': new Set(),
};

// when a peer starts, it will request a list of rooms
// after that, it will request peers in a specific room
signal.on('discover', request => {
  if (!request.discoveryData) {
    // return list of rooms
    request.discover({
      rooms: Object.keys(rooms),
    });
  } else {
    // return peers in a room
    const roomId = request.discoveryData;

    // return the roomId so client can correlate discovery data
    request.discover({
      roomResponse: roomId,
      peers: Array.from(rooms[roomId]),
    });

    // if peer was already in a room
    if (request.socket.roomId) {
      // remove peer from that room
      rooms[request.socket.roomId].delete(request.socket.id);
      console.log('%s: %o', roomId, Array.from(rooms[roomId]));
    }

    // if peer is joining a new room
    if (request.socket.roomId !== roomId) {
      // track the current room in the persistent socket object
      request.socket.roomId = roomId;
      // add peer to new room
      rooms[roomId].add(request.socket.id);
      console.log('%s: %o', roomId, Array.from(rooms[roomId]));
    }
  }
});

const port = process.env.PORT || 8000;
server.listen(port, () => console.log('Listening on port %d', port));
