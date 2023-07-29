const messageList = document.querySelector('ul');
const messageForm = document.querySelector('#message');
const nickForm = document.querySelector('#nick');

function makeMessage(type, payload) {
  const message = {
    type,
    payload,
  };
  return JSON.stringify(message);
}

// 여기서의 socket => server와의 연결
const webSocket = new WebSocket(`ws://${window.location.host}`);

webSocket.addEventListener('open', () => {
  console.log('Connected to Server!');
});

webSocket.addEventListener('message', (message) => {
  const li = document.createElement('li');
  li.innerText = message.data;
  messageList.append(li);
  console.log(`New message:${message.data}`);
});

webSocket.addEventListener('close', () => {
  // 서버가 오프라인이 되면 브라우저에게 알려줌
  console.log('Disconnected to Server!');
});

nickForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = nickForm.querySelector('input');
  webSocket.send(makeMessage('nickname', input.value));
});

messageForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = messageForm.querySelector('input');
  webSocket.send(makeMessage('new_message', input.value));
  input.value = '';
});
