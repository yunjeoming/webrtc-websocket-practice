import express from 'express';
import http from 'http';
import WebSocket from 'ws';

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
const wss = new WebSocket.Server({ server });

const sockets = [];

wss.on('connection', (socket) => {
  sockets.push(socket);
  socket['nickname'] = 'Anonymous';

  // 여기서의 socket => 연결된 브라우저
  console.log('Connected to Browser!');
  socket.on('close', () => {
    // 브라우저가 닫힐 때 실행됨 => 브라우저의 연결이 끊기면 서버에 event를 발생시킴
    console.log('Disconnected to Browser!');
  });
  socket.on('message', (msgStr) => {
    const message = JSON.parse(msgStr);
    switch (message.type) {
      case 'new_message': {
        sockets.forEach((aSocket) => aSocket.send(`${socket['nickname']}:${message.payload.toString()}`));
      }
      case 'nickname': {
        socket['nickname'] = message.payload;
      }
    }
  });
});

server.listen(3000, handleListen);
