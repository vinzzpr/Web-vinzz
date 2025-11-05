// server.js
// Relay server: serves static web files, WebSocket relay, HTTP /cmd & /status
// Usage: set PORT and optional AUTH_TOKEN env vars. Run: npm install && node server.js

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const PORT = process.env.PORT || 8080;
const AUTH_TOKEN = process.env.AUTH_TOKEN || null; // optional: set to require x-auth header on POST /cmd

const app = express();
app.use(cors());
app.use(express.json());

// Serve web/ as static (controller & phone client)
const webRoot = path.join(__dirname, '..', 'web');
app.use(express.static(webRoot));
app.get('/', (req, res) => res.sendFile(path.join(webRoot, 'index.html')));

// tracking
let lastSeen = null;

// POST /cmd : controller (or other) can POST commands to be broadcasted to phones
app.post('/cmd', (req, res) => {
  if (AUTH_TOKEN) {
    const token = req.header('x-auth') || req.query.token || null;
    if (token !== AUTH_TOKEN) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
  }
  const body = req.body || {};
  const payload = JSON.stringify({ type: 'cmd', cmd: body.cmd, meta: body.meta || null });
  let sent = 0;
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN && c.role === 'phone') {
      c.send(payload);
      sent++;
    }
  });
  if (sent > 0) lastSeen = Date.now();
  console.log(`[HTTP /cmd] broadcast -> ${sent} phone(s). cmd=`, body.cmd);
  res.json({ ok: true, sentTo: sent });
});

// GET /status : basic status for controller to check
app.get('/status', (req, res) => {
  const phones = Array.from(wss.clients).filter(c => c.readyState === WebSocket.OPEN && c.role === 'phone').length;
  const controllers = Array.from(wss.clients).filter(c => c.readyState === WebSocket.OPEN && c.role === 'controller').length;
  res.json({
    ok: true,
    clients: { phones, controllers },
    lastSeen: lastSeen ? new Date(lastSeen).toISOString() : null,
    serverTime: new Date().toISOString()
  });
});

// Create HTTP server & WS server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Accept WS and expect a registration message: {type:'register', role:'phone'|'controller'}
wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.role = 'unknown';
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (msg) => {
    let data = null;
    try { data = JSON.parse(msg.toString()); } catch(e) { data = msg.toString(); }
    // handle registration
    if (data && data.type === 'register' && (data.role === 'phone' || data.role === 'controller')) {
      ws.role = data.role;
      ws.clientId = data.clientId || null;
      console.log(`[WS] client registered role=${ws.role} id=${ws.clientId || '-'}`);
      ws.send(JSON.stringify({ type: 'welcome', role: ws.role, time: Date.now() }));
      lastSeen = Date.now();
      return;
    }

    // handle commands from controller via WS
    if (data && data.type === 'cmd') {
      // broadcast to phones
      const payload = JSON.stringify({ type: 'cmd', cmd: data.cmd, meta: data.meta || null });
      let sent = 0;
      wss.clients.forEach((c) => {
        if (c.readyState === WebSocket.OPEN && c.role === 'phone') {
          c.send(payload);
          sent++;
        }
      });
      if (sent > 0) lastSeen = Date.now();
      console.log(`[WS] cmd from controller -> broadcast to ${sent} phone(s):`, data.cmd);
      return;
    }

    // other messages: log
    console.log('[WS] message', data);
  });

  ws.on('close', () => {
    console.log(`[WS] client disconnected role=${ws.role}`);
  });
});

// heartbeat to drop dead clients
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`VZC1 relay server listening on http://0.0.0.0:${PORT}`);
  console.log(`Serving web files from ${webRoot}`);
});