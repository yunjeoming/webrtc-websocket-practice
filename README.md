# WebRTC practice

Zoom 클론 코딩하여 WebRTC, WebSocket을 학습합니다.

## WebRTC

### 1. peer1 -> peer2: connection 생성 및 offer 전달

📌 각 peer의 stream이 있고, 서버 측 socket은 정의되어 있다고 가정한다.

1. peerConnection 생성

```js
const myPeerConnection = new RTCPeerConnection();
```

2. peerConnection에 addTrack 추가
   주고 받을 데이터(track-영상, 오디오)를 peerConnection에 넣어준다

```js
myStream.getTracks().forEach((track) => myPeerConnection.addTrack(track, myStream));
```

3. offer 생성, local description에 등록 후 peer2에게 offer 전달

peer1에서 실행되는 특정 socket 내부에 offer를 생성하고 peerConnection에 local description으로 등록한다.

offer란? 다른 브라우저가 참가할 수 있도록 초대장을 만드는 것으로 아래는 peer1에서 실행되는 코드이다.

```js
socket.on('welcome', async () => {
  console.log('someone joined');
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);

  console.log('sent the offer');
  socket.emit('offer', offer, roomName);
});
```

### 2. peer1 <- peer2: offer 등록 후 answer 전달

1. peer2는 offer를 remote description으로 등록한 후 answer를 전달

peer2는 peer1으로부터 전달 받은 offer를 remote description으로 등록하고 answer를 생성한다. 생성한 answer를 local description으로 등록하고 peer1에게 보낸다.

```js
socket.on('offer', async (offer) => {
  console.log('received the offer');

  myPeerConnection.setRemoteDescription(offer);

  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);

  socket.emit('answer', answer, roomName);
  console.log('sent the answer');
});
```

2. peer1은 answer를 remote description으로 등록

```
socket.on('answer', (answer) => {
  console.log('received the answer');
  myPeerConnection.setRemoteDescription(answer);
});
```

### 3. icecandidate, addstream event 생성

1. 생성된 myPeerConnection에 icecandidate 이벤트를 등록한다.

candidate는 브라우저의 소통 방법을 알려주는 것으로 myPeerConnection이 생성되면 connection에 브라우저의 candidate를 보낸다.

```js
myPeerConnection.addEventListener('icecandidate', handleIce);

function handleIce(data) {
  socket.emit('ice', data.candidate, roomName);
}
```

2. 생성된 myPeerConnection에 addstream 이벤트를 등록한다.

addstream 이벤트 핸들러로 상대 peer의 정보를 확인할 수 있다. data.stream에는 상대 peer의 stream이, 나의 stream은 myStream으로 확인할 수 있다.

```js
myPeerConnection.addEventListener('addstream', handleAddStream);

function handleAddStream(data) {
  const peerFace = document.querySelector('#peerFace');
  peerFace.srcObject = data.stream;

  // console.log('got a stream from my peer');
  // console.log('Peers stream', data.stream);
  // console.log('My stream', myStream);
}
```

## Data Channel

peer to peer 유저끼리 데이터를 주고받을 수 있게 한다. [MDN - Data channel](https://developer.mozilla.org/ko/docs/Web/API/WebRTC_API/Using_data_channels)

data channel을 만드는 주체는 offer를 만드는 주체, 즉 peer1이다. 그리고 offer를 받은 peer2에서 datachannel을 저장하기 위해 addEventListener를 활용하는데, 이 때 핸들러 내부에 dataChannel을 저장할 수 있다. (peer1에서 datachannel을 offer가 생성되기 전에 만들어야 한다.)

```js
myDataChannel.addEventListener('message', console.log);
```

peer1, peer2의 datachannel에 message 이벤트 리스너를 등록하자. 그 다음 브라우저의 콘솔창에서 myDataChannel.send("msg sth")을 쳐보면 상대 브라우저의 콘솔창에 MessageEvent 객체 정보가 뜨는데 여기에 "msg sth"이 담겨있다!


## 참고

- 데스크탑, 폰이 같은 wifi를 사용하고 있는 상태면 잘 작동되지만, 다를 경우에 작동되지 않음. 이럴 경우 STUN Server를 사용한다.
  - 여기에선 구글이 제공하는 무료 STUN Server를 사용하고 있지만, 실제 서비스에 사용할 예정이라면 개인 STUN Server를 사용할 것!

### 강의 출처

노마드 코더
