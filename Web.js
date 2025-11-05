// controller.js
let ws = null;
let serverInput = document.getElementById('serverInput');
let connectBtn = document.getElementById('connectBtn');
let statusDot = document.getElementById('statusDot');
let statusText = document.getElementById('statusText');
let controlArea = document.getElementById('controlArea');

const btnSenter = document.getElementById('btnSenter');
const btnGetar = document.getElementById('btnGetar');
const btnMusik = document.getElementById('btnMusik');

function setStatus(ok, text) {
  statusDot.className = 'status-dot' + (ok ? ' status-ok' : '');
  statusText.innerText = text || (ok ? 'Connected' : 'Not connected');
  controlArea.style.display = ok ? 'block' : 'none';
}

function connectWS() {
  const wsUrl = resolveWsUrl(serverInput.value);
  try {
    ws = new WebSocket(wsUrl);
  } catch(e) {
    setStatus(false, 'Failed create WS: ' + e.message);
    return;
  }
  ws.onopen = () => {
    setStatus(true, 'Connected to relay');
    // register as controller
    ws.send(JSON.stringify({ type: 'register', role: 'controller', clientId: 'controller-' + Date.now() }));
  };
  ws.onmessage = (ev) => {
    let data = null;
    try { data = JSON.parse(ev.data); } catch(e) { data = ev.data; }
    console.log('[WS msg]', data);
  };
  ws.onclose = () => setStatus(false, 'Disconnected');
  ws.onerror = (e) => {
    console.warn('[WS err]', e);
    setStatus(false, 'WS error');
  };
}

connectBtn.addEventListener('click', ()=> {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try { ws.close(); } catch(e) {}
    setStatus(false, 'Disconnected');
    connectBtn.innerText = 'Connect';
    return;
  }
  connectWS();
  connectBtn.innerText = 'Disconnect';
});

// send command via WS if available, else via HTTP POST fallback
async function sendCommand(cmd) {
  const payload = { type:'cmd', cmd };
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
    return;
  }
  // fallback: use serverInput value as http host
  const host = (serverInput.value||location.host).trim();
  const url = (host.startsWith('http') ? host : 'http://' + host) + '/cmd';
  try {
    await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ cmd }) });
  } catch(e){
    alert('Failed to send command: ' + e.message);
  }
}

btnSenter.addEventListener('click', ()=> {
  // toggle visual only, send both on/off accordingly
  if (btnSenter.dataset.on === '1') {
    btnSenter.dataset.on = '0'; btnSenter.innerText = 'SENTER';
    sendCommand('senter_off');
  } else {
    btnSenter.dataset.on = '1'; btnSenter.innerText = 'SENTER (ON)';
    sendCommand('senter_on');
  }
});
btnGetar.addEventListener('click', ()=> sendCommand('getar'));
btnMusik.addEventListener('click', ()=> sendCommand('musik_toggle'));

// auto connect to host if serverInput empty -> use current host
if (!serverInput.value) {
  // attempt auto connect (useful if site served from same server)
  setTimeout(() => connectWS(), 300);
}