// Establish socket connection with the server
const socket = io('http://localhost:8000')
// Select HTML elements
const form = document.getElementById('send-container');
const messageInput = document.getElementById('messageInp');
const messageContainer = document.getElementById("chatContainer");
const recordButton = document.getElementById('recordButton');
const voiceTimerDisplay = document.getElementById('voiceTimerDisplay');
const imageUploadInput = document.getElementById('imageUpload');

// Variables
let currentUserName;
let mediaRecorder;
let audioChunks = [];
let voiceRecordTimerInterval;
let secondsRecorded = 0;
let mediaStream = null;

const allowedUsernames = ["Hafizabdullah19", "roman4","344","366","e-5a5","e-5s6","e-5d7","e-5f8","e-5h9","e-6k0","e-6j1","e-6u2","e-6y3","e-6t4","e-6r5","e-6e6","e-6w7","e-6q8","e-6x9","e-7z0"]; 

const appendMessage = (content, position, senderName = '') => {
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('message', position);

    if (senderName && position !== 'event') {
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('sender-name');
        let nameText = `${senderName}`;
        if (typeof content === 'string') {
            nameText += ": ";
        } else if (content.tagName === 'AUDIO') {
            nameText += " (voice): ";
        } else if (content.tagName === 'IMG') {
            nameText += " (image):";
        }
        nameSpan.innerText = nameText;
        messageWrapper.appendChild(nameSpan);
    }

    if (position === 'event' && typeof content === 'string') {
        messageWrapper.innerText = content;
        messageWrapper.classList.add('event-message');
    } else if (typeof content === 'string') {
        const textNode = document.createTextNode(content);
        messageWrapper.appendChild(textNode);
    } else {
        messageWrapper.appendChild(content);
        if (content.tagName === 'IMG') {
            messageWrapper.classList.add('image-message-wrapper');
        }
    }

    messageContainer.append(messageWrapper);
    if (messageContainer.scrollHeight > messageContainer.clientHeight) {
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
    if (content && content.tagName === 'IMG') {
        content.onload = () => {
            if (messageContainer.scrollHeight > messageContainer.clientHeight) {
                messageContainer.scrollTop = messageContainer.scrollHeight;
            }
        };
    }
};

const createAudioPlayer = (audioBlob) => {
    const audioElement = document.createElement('audio');
    audioElement.controls = true;
    const audioURL = URL.createObjectURL(audioBlob);
    audioElement.src = audioURL;
    return audioElement;
};

const startRecordingTimer = () => {
    secondsRecorded = 0;
    voiceTimerDisplay.textContent = `Recording: ${secondsRecorded}s`;
    voiceTimerDisplay.style.display = 'block';
    voiceRecordTimerInterval = setInterval(() => {
        secondsRecorded++;
        voiceTimerDisplay.textContent = `Recording: ${secondsRecorded}s`;
    }, 1000);
};

const stopRecordingTimer = () => {
    clearInterval(voiceRecordTimerInterval);
    voiceTimerDisplay.style.display = 'none';
    secondsRecorded = 0;
};

const stopMediaStream = () => {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
};

if (recordButton) {
    recordButton.addEventListener('click', async () => {
        if (!currentUserName) {
            appendMessage('Please enter your name first to send voice messages.', 'event');
            return;
        }

        if (!mediaRecorder || mediaRecorder.state === "inactive") {
            try {
                stopMediaStream();
                const audioConstraints = {
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }
                };
                mediaStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
                let preferredMimeType = 'audio/webm; codecs=opus';
                if (!MediaRecorder.isTypeSupported(preferredMimeType)) preferredMimeType = 'audio/webm';
                if (!MediaRecorder.isTypeSupported(preferredMimeType)) {
                    appendMessage("Audio recording format not supported.", 'event');
                    stopMediaStream();
                    return;
                }
                const recorderOptions = { mimeType: preferredMimeType, audioBitsPerSecond: 128000 };
                mediaRecorder = new MediaRecorder(mediaStream, recorderOptions);
                audioChunks = [];

                mediaRecorder.ondataavailable = event => {
                    if (event.data.size > 0) audioChunks.push(event.data);
                };

                mediaRecorder.onstart = () => {
                    startRecordingTimer();
                    recordButton.classList.add('is-recording');
                    recordButton.disabled = false;
                };

                mediaRecorder.onstop = async () => {
                    stopRecordingTimer();
                    recordButton.classList.remove('is-recording');
                    stopMediaStream();
                    if (audioChunks.length === 0) return;
                    const audioBlob = new Blob(audioChunks, { type: recorderOptions.mimeType });
                    const audioPlayer = createAudioPlayer(audioBlob);
                    appendMessage(audioPlayer, 'right', currentUserName);

                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = () => {
                        socket.emit('send-voice-message', { audioBase64: reader.result });
                        audioChunks = [];
                    };
                };

                mediaRecorder.start();
            } catch (err) {
                appendMessage(`Mic access error: ${err.message}`, 'event');
                stopRecordingTimer();
                recordButton.classList.remove('is-recording');
                stopMediaStream();
            }
        } else if (mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
    });
}

socket.on('voice-message', data => {
    if (data.name && data.audioBase64 && data.name !== currentUserName) {
        fetch(data.audioBase64).then(res => res.blob()).then(blob => {
            if (blob.size > 0) appendMessage(createAudioPlayer(blob), 'left', data.name);
        }).catch(err => console.error('Error processing voice:', err));
    }
});

const createImageElement = (imageDataUrl) => {
    const img = document.createElement('img');
    img.src = imageDataUrl;
    img.style.maxWidth = '250px';
    img.style.maxHeight = '250px';
    img.style.borderRadius = '8px';
    img.style.marginTop = '5px';
    img.style.cursor = 'pointer';
    img.onclick = () => {
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.left = '0'; modal.style.top = '0';
        modal.style.width = '100%'; modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.85)';
        modal.style.display = 'flex'; modal.style.justifyContent = 'center'; modal.style.alignItems = 'center';
        modal.style.zIndex = '1001';

        const fullImg = document.createElement('img');
        fullImg.src = imageDataUrl;
        fullImg.style.maxWidth = '90%'; fullImg.style.maxHeight = '90%';
        fullImg.style.border = '3px solid white'; fullImg.style.borderRadius = '5px';
        modal.appendChild(fullImg);
        modal.onclick = () => document.body.removeChild(modal);
        document.body.appendChild(modal);
    };
    return img;
};

if (imageUploadInput) {
    imageUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            if (!currentUserName) {
                appendMessage('Please enter your name first to send images.', 'event');
                imageUploadInput.value = '';
                return;
            }
            const maxSize = 5 * 1024 * 1024;
            if (file.size > maxSize) {
                appendMessage(`Image is too large (max 5MB).`, 'event');
                imageUploadInput.value = '';
                return;
            }
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const imageDataUrl = reader.result;
                const imgEl = createImageElement(imageDataUrl);
                appendMessage(imgEl, 'right', currentUserName);
                socket.emit('send-image-message', { imageBase64: imageDataUrl });
            };
            imageUploadInput.value = '';
        }
    });
}

socket.on('image-message', data => {
    if (data.name && data.imageBase64 && data.name !== currentUserName) {
        appendMessage(createImageElement(data.imageBase64), 'left', data.name);
    }
});

const nameFromPrompt = prompt("Enter your allowed username to join the chat:");
if (nameFromPrompt && allowedUsernames.includes(nameFromPrompt.trim())) {
    currentUserName = nameFromPrompt.trim();
    socket.emit('new-user-joined', currentUserName);
    form.style.display = 'flex';
    recordButton.disabled = false;
    const label = document.querySelector('label[for="imageUpload"]');
    if (label) {
        label.style.opacity = '1';
        label.style.pointerEvents = 'auto';
    }
} else {
    appendMessage('Access denied or no username. Please refresh.', 'event');
}

socket.on('user-joined', name => {
    if (name !== currentUserName) appendMessage(`${name} joined the chat`, 'event');
});

socket.on('join-error', data => {
    appendMessage(data.message, 'event');
    currentUserName = null;
});

socket.on('chat-message', data => {
    if (data.name && data.message && data.name !== currentUserName) {
        appendMessage(data.message, 'left', data.name);
    }
});

if (form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = messageInput.value.trim();
        if (message && currentUserName) {
            appendMessage(message, 'right', currentUserName);
            socket.emit('send-chat-message', message);
            messageInput.value = '';
        }
    });
}

// ✅ OLD MESSAGES LOADER
socket.on('load-old-messages', messages => {
    messages.forEach(msg => {
        const position = msg.sender === currentUserName ? 'right' : 'left';
        if (msg.type === 'text') {
            appendMessage(msg.content, position, msg.sender);
        } else if (msg.type === 'voice' && msg.content) {
            fetch(msg.content).then(res => res.blob()).then(blob => {
                if (blob.size > 0) appendMessage(createAudioPlayer(blob), position, msg.sender);
            });
        } else if (msg.type === 'image' && msg.content) {
            appendMessage(createImageElement(msg.content), position, msg.sender);
        }
    });
    if (messageContainer.scrollHeight > messageContainer.clientHeight) {
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }
});
