// phone_client.js
let ws = null;
const phoneDot = document.getElementById('phoneDot');
const phoneText = document.getElementById('phoneText');
const grantBtn = document.getElementById('grantBtn');
const audioEl = document.getElementById('bgAudio');

function setPhoneStatus(ok, text) {
  phoneDot.className = 'status-dot' + (ok ? ' status-ok' : '');
  phoneText.innerText = text || (ok ? 'Connected' : 'Not connected');
}

// resolve default WS URL same host
const wsUrl = (() => {
  const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
  return proto + location.host;
})();

function connectWS() {
  try {
    ws = new WebSocket(wsUrl);
  } catch(e) {
    setPhoneStatus(false, 'WS init failed');
    return;
  }
  ws.onopen = () => {
    setPhoneStatus(true, 'Connected to relay');
    ws.send(JSON.stringify({ type:'register', role:'phone', clientId: 'phone-'+Date.now() }));
  };
  ws.onmessage = (ev) => {
    let data = null;
    try { data = JSON.parse(ev.data); } catch(e){ data = ev.data; }
    console.log('[WS msg phone]', data);
    if (data && data.type === 'cmd') {
      handleCommand(data.cmd, data.meta);
    }
  };
  ws.onclose = () => setPhoneStatus(false, 'Disconnected');
  ws.onerror = (e) => { console.warn(e); setPhoneStatus(false, 'WS error'); };
}
connectWS();

// request permissions for camera/audio (user gesture)
grantBtn.addEventListener('click', async () => {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
    const v = document.createElement('video'); v.style.display = 'none'; v.autoplay = true; v.srcObject = s; document.body.appendChild(v);
    window._vz_localStream = s;
    setPhoneStatus(true, 'Permissions granted & connected');
  } catch (e) {
    alert('Permission denied: ' + e.message);
    setPhoneStatus(false, 'Permissions denied');
  }
});

// torch helper
async function setTorch(on) {
  const s = window._vz_localStream;
  if (!s) { alert('Press "Minta Izin Kamera & Audio" first'); return; }
  const track = s.getVideoTracks()[0];
  if (!track) { alert('No video track'); return; }
  const caps = track.getCapabilities?.() || {};
  if (!caps.torch) { alert('Torch unsupported on this device'); return; }
  try {
    await track.applyConstraints({ advanced: [{ torch: !!on }] });
  } catch (e) {
    console.warn('torch applyConstraints error', e);
    alert('Failed control torch: ' + e.message);
  }
}

async function handleCommand(cmd, meta) {
  console.log('Run cmd', cmd);
  if (cmd === 'senter_on' || cmd === 'senter') {
    await setTorch(true);
  } else if (cmd === 'senter_off') {
    await setTorch(false);
  } else if (cmd === 'getar' || cmd === 'vibrate') {
    if (navigator.vibrate) navigator.vibrate([180,80,180]);
  } else if (cmd === 'musik_toggle' || cmd === 'musik') {
    if (audioEl.paused) {
      try { await audioEl.play(); } catch(e) { alert('Need user interaction to play audio (tap screen)'); }
    } else {
      audioEl.pause(); audioEl.currentTime = 0;
    }
  } else {
    console.log('Unknown command', cmd);
  }
}

// ensure re-connect on connection lost
setInterval(() => {
  if (!ws || ws.readyState === WebSocket.CLOSED) connectWS();
}, 5000);