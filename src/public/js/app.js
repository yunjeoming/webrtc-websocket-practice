// back-end의 socket과 연결해주는 함수
const socket = io();

const myFace = document.querySelector('#myFace');
const muteBtn = document.querySelector('#mute');
const cameraBtn = document.querySelector('#camera');
const camerasSelect = document.querySelector('#cameras');

const call = document.querySelector('#call');

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;
let myDataChannel;

async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === 'videoinput');
    const currCamera = myStream.getVideoTracks()[0];
    cameras.forEach((camera) => {
      const option = document.createElement('option');
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currCamera.label == camera.label) {
        option.selected = true;
      }
      camerasSelect.append(option);
    });
  } catch (e) {
    console.log(e);
  }
}

async function getMedia(deviceId) {
  const initialConstraints = { audio: true, video: true };
  const cameraConstraints = {
    audio: true,
    video: {
      deviceId: {
        exact: deviceId,
      },
    },
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(deviceId ? cameraConstraints : initialConstraints);
    myFace.srcObject = myStream;
    if (!deviceId) {
      await getCameras();
    }
  } catch (e) {
    console.log(e);
  }
}

function handleMuteClick() {
  myStream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
  if (!muted) {
    muteBtn.innerText = 'Unmute';
    muted = true;
  } else {
    muteBtn.innerText = 'Mute';
    muted = false;
  }
}

function handleCameraClick() {
  myStream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));

  if (cameraOff) {
    cameraBtn.innerText = 'Turn Camera Off';
    cameraOff = false;
  } else {
    cameraBtn.innerText = 'Turn Camera On';
    cameraOff = true;
  }
}

async function handleCameraChange() {
  await getMedia(camerasSelect.value);

  // peer끼리 연결된 후 특정 브라우저의 카메라가 바뀌었을 때, 위 getMedia의 stream이 바뀌게 된다!
  if (myPeerConnection) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = myPeerConnection.gerSenders().find((sender) => sender.track.inkd === 'video');
    videoSender.replaceTrack(videoTrack);
  }
}

muteBtn.addEventListener('click', handleMuteClick);
cameraBtn.addEventListener('click', handleCameraClick);
camerasSelect.addEventListener('input', handleCameraChange);

// Welcome Form (join a room)

const welcome = document.querySelector('#welcome');
const welcomeForm = welcome.querySelector('form');

async function initCall() {
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();
  makeConnection();
}

async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const input = welcomeForm.querySelector('input');
  await initCall();
  socket.emit('join_room', input.value);
  roomName = input.value;
  input.value = '';
}

welcomeForm.addEventListener('submit', handleWelcomeSubmit);

// Socket Code

// peer1 알림을 받는 브라우저에서 실행되는 코드
socket.on('welcome', async () => {
  console.log('someone joined');

  // peer1의 dataChannel
  myDataChannel = myPeerConnection.createDataChannel('chat');
  myDataChannel.addEventListener('message', console.log);

  // offer란? 다른 브라우저가 참가할 수 있도록 초대장을 만드는 것.
  // 내 브라우저의 정보를 담고 있나..?
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  console.log('sent the offer');
  socket.emit('offer', offer, roomName);
});

// peer2 브라우저에서 실행되는 코드
socket.on('offer', async (offer) => {
  myPeerConnection.addEventListener('datachannel', (event) => {
    // peer2의 dataChannel
    myDataChannel = event.channel;
    myDataChannel.addEventListener('message', console.log)
  });

  // peer1에서 만든 offer가 peer2에게 전달되었다!
  console.log(offer);
  console.log('received the offer');

  // websocket은 속도가 빠르기 때문에 밑에서 생성된 myPeerConnection이 여기선 아직 생성이 되어 있지 않은 상황
  // 따라서 연결된 후 media 생성이 되는 것이 아닌 media를 먼저 생성한 후 socket 연결을 해준다. (그만큼 빠르다는 것..)
  myPeerConnection.setRemoteDescription(offer);

  // offer를 생성했으면 이제 답신을 보낸다.
  // offer - description과 비슷한 형태지만 이젠 반대로 answer - description을 만들어준다.
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit('answer', answer, roomName);
  console.log('sent the answer');
});

// peer1 브라우저에서 실행되는 코드. peer2로부터 전달받은 answer!!
socket.on('answer', (answer) => {
  console.log('received the answer');
  myPeerConnection.setRemoteDescription(answer);
});

socket.on('ice', (ice) => {
  console.log('received candidate');
  myPeerConnection.addIceCandidate(ice);
});

// RTC Code

// addStream 대신 사용하는 makeConnection
function makeConnection() {
  // 두 브라우저가 같은 socket에 연결되었을 경우 두 브라우저를 서로 연결시켜주는 통로
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
          'stun:stun3.l.google.com:19302',
          'stun:stun4.l.google.com:19302',
        ],
      },
    ],
  });
  myPeerConnection.addEventListener('icecandidate', handleIce);
  myPeerConnection.addEventListener('addstream', handleAddStream);

  // 주고받을 데이터(영상or오디오)를 피어에 넣어준다!!
  // stream의 데이터를 가져다가 연결을 만든다.
  myStream.getTracks().forEach((track) => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data) {
  // candidate는 브라우저의 소통 방법을 알려주는 것
  // peer1, peer2에 각각 생성된 candidate를 상대 브라우저에게 보내줘야 함
  // console.log('got ice candidate');

  socket.emit('ice', data.candidate, roomName);
}

function handleAddStream(data) {
  const peerFace = document.querySelector('#peerFace');
  peerFace.srcObject = data.stream;

  // console.log('got a stream from my peer');
  // console.log('Peers stream', data.stream);
  // console.log('My stream', myStream);
}
