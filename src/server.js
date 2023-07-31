import express from 'express';
import http from 'http';
import { Socket } from 'socket.io';

const app = express();

app.set('view engine', 'pug');
app.set('views', __dirname + '/views');

app.use('/public', express.static(__dirname + '/public'));

app.get('/', (req, res) => res.render('home'));
app.get('/*', (req, res) => res.redirect('/'));

const handleListen = () => console.log(`Listening on http://localhost:3000`);
// app.listen(3000, handleListen);

// http, ws server 두 개 동시에 실행하기
// localhost:3000에서 http, ws 둘다 사용 가능하도록 함
const server = http.createServer(app);
const wsServer = new Socket(server);

function publicRooms() {
  const {
    sockets: {
      adapter: { sids, rooms },
    },
  } = wsServer;
  const publicRooms = [];
  rooms.forEach((_, key) => {
    if (!sids.get(key)) {
      publicRooms.push(key);
    }
  });
  return publicRooms;
}

function countRoom(room) {
  return wsServer.sockets.adapter.rooms.get(room)?.size;
}

/**
 * Adapter
 * 다른 서버들 사이에 실시간 어플리케이션을 동기화 하는 역할
 * 백엔드에 db 유지하도록 하는 것..?
 */

wsServer.on('connection', (socket) => {
  socket['nickname'] = 'anonymous';

  // socket의 이벤트 공통으로 처리
  socket.onAny((event) => {
    console.log(`Socket Event: ${event}`);
  });

  // front에서 emit에 보내는 여러 인자들을 back의 callback의 인자에 한 번에 다 담아낼 수 있다.
  // callback이 있을 경우 서버에서 프론트의 callback을 대신 실행해준다.
  // front에서 요청한 함수가 backend에서 실행되면 안 된다. => 보안 이슈
  socket.on('enter_room', (room, done) => {
    socket.join(room);
    done();
    socket.to(room).emit('welcome', socket.nickname, countRoom(room));
    wsServer.sockets.emit('room_change', publicRooms());
  });

  // 서버와 클라이언트 연결이 끊어지기 바로 전에 실행 => room 이름을 알고 있다는 것이 특징
  socket.on('disconnecting', () => {
    // 방을 나가기 직전에 사람의 수를 세기 때문에 이후에 나갈 것을 생각하면 -1을 해야함
    socket.rooms.forEach((room) => socket.to(room).emit('bye', socket.nickname, countRoom(room)-1));
  });

  // 서버와 클라이언트 연결이 완전히 끊어질 때 실행
  socket.on('disconnect', () => {
    wsServer.sockets.emit('room_change', publicRooms());
  });

  socket.on('new_message', (msg, room, done) => {
    socket.to(room).emit('new_message', `${socket.nickname}: ${msg}`);
    done();
  });

  socket.on('nickname', (nickname) => (socket['nickname'] = nickname));
});

server.listen(3000, handleListen);
