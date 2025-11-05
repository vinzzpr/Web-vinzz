// common.js - helper to resolve default WS URL (current host) if input empty
function resolveWsUrl(inputValue) {
  const raw = (inputValue || '').trim();
  if (raw) {
    // allow user to pass ws:// or wss:// or http(s)://host:port -> convert to ws
    if (raw.startsWith('ws://') || raw.startsWith('wss://')) return raw;
    if (raw.startsWith('http://')) return 'ws://' + raw.slice('http://'.length);
    if (raw.startsWith('https://')) return 'wss://' + raw.slice('https://'.length);
    return 'ws://' + raw; // assume host:port
  } else {
    // use current host
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    return proto + location.host;
  }
}