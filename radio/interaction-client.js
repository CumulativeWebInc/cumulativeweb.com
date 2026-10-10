/**
 * Radio 365 Interaction Client
 *
 * Connects to the Cloudflare Durable Object via WebSocket.
 * Falls back to 15-second polling if WebSocket unavailable.
 * Audio NEVER depends on this layer.
 */

(function () {
  'use strict';

  const WS_URL = 'wss://radio-365-interaction.hp-ace.workers.dev';
  const API_URL = 'https://radio-365-interaction.hp-ace.workers.dev';
  const POLL_INTERVAL = 15000; // 15 seconds

  let ws = null;
  let usePolling = false;
  let pollTimer = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 5;

  // UI elements (created if not present)
  let ui = null;

  function createUI() {
    // Only create if we're on the radio page
    if (!document.querySelector('.radio-interaction-mount')) return null;

    const mount = document.querySelector('.radio-interaction-mount');
    mount.innerHTML = `
      <div class="ri-container">
        <div class="ri-listeners">
          <span class="ri-dot"></span>
          <span id="ri-listener-count">—</span> listening
        </div>
        <div class="ri-tabs">
          <button class="ri-tab active" data-tab="chat">Chat</button>
          <button class="ri-tab" data-tab="requests">Requests</button>
        </div>
        <div class="ri-panel" id="ri-chat-panel">
          <div class="ri-messages" id="ri-messages"></div>
          <div class="ri-input-row">
            <input type="text" id="ri-chat-input" placeholder="Say something..." maxlength="500">
            <button id="ri-chat-send">Send</button>
          </div>
        </div>
        <div class="ri-panel hidden" id="ri-requests-panel">
          <div class="ri-requests" id="ri-requests"></div>
          <div class="ri-input-row">
            <input type="text" id="ri-req-artist" placeholder="Artist" maxlength="100">
            <input type="text" id="ri-req-title" placeholder="Song title" maxlength="100">
            <button id="ri-req-submit">Request</button>
          </div>
        </div>
        <div class="ri-status" id="ri-status"></div>
      </div>
    `;

    // Tab switching
    mount.querySelectorAll('.ri-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        mount.querySelectorAll('.ri-tab').forEach(t => t.classList.remove('active'));
        mount.querySelectorAll('.ri-panel').forEach(p => p.classList.add('hidden'));
        tab.classList.add('active');
        document.getElementById(`ri-${tab.dataset.tab}-panel`).classList.remove('hidden');
      });
    });

    // Chat send
    const chatInput = document.getElementById('ri-chat-input');
    document.getElementById('ri-chat-send').addEventListener('click', () => sendChat(chatInput.value));
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendChat(chatInput.value);
    });

    // Request submit
    document.getElementById('ri-req-submit').addEventListener('click', () => {
      const artist = document.getElementById('ri-req-artist').value;
      const title = document.getElementById('ri-req-title').value;
      submitRequest(artist, title);
    });

    return mount;
  }

  function setStatus(msg, isError = false) {
    const el = document.getElementById('ri-status');
    if (el) {
      el.textContent = msg;
      el.style.color = isError ? '#ff6b6b' : '#888';
    }
  }

  function updateListenerCount(count) {
    const el = document.getElementById('ri-listener-count');
    if (el) el.textContent = count;
  }

  function addChatMessage(msg) {
    const container = document.getElementById('ri-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'ri-message';
    div.innerHTML = `<strong>${escapeHtml(msg.name)}</strong>: ${escapeHtml(msg.text)}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    // Keep last 50
    while (container.children.length > 50) {
      container.removeChild(container.firstChild);
    }
  }

  function renderRequests(requests) {
    const container = document.getElementById('ri-requests');
    if (!container) return;
    container.innerHTML = requests.map(r => `
      <div class="ri-request" data-id="${r.id}">
        <span class="ri-req-info">"${escapeHtml(r.title)}" by ${escapeHtml(r.artist)}</span>
        <span class="ri-req-votes">${r.votes} votes</span>
        <button onclick="window.riVote('${r.id}')">▲</button>
      </div>
    `).join('') || '<div class="ri-empty">No requests yet. Be the first!</div>';
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // WebSocket connection
  function connect() {
    if (usePolling) return;

    try {
      ws = new WebSocket(WS_URL);
    } catch (e) {
      fallBackToPolling('WebSocket not supported');
      return;
    }

    ws.onopen = () => {
      reconnectAttempts = 0;
      setStatus('Connected live');
      // Set a display name
      const name = localStorage.getItem('ri-name') || 'Listener';
      ws.send(JSON.stringify({ type: 'set_name', name }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (e) { /* ignore */ }
    };

    ws.onclose = () => {
      if (reconnectAttempts < MAX_RECONNECT) {
        reconnectAttempts++;
        setStatus(`Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT})`);
        setTimeout(connect, 3000 * reconnectAttempts);
      } else {
        fallBackToPolling('Live connection unavailable, using polling');
      }
    };

    ws.onerror = () => {
      // onclose will handle it
    };
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case 'welcome':
        updateListenerCount(msg.listeners);
        msg.chat.forEach(addChatMessage);
        renderRequests(msg.requests);
        break;
      case 'listeners':
        updateListenerCount(msg.count);
        break;
      case 'chat':
        addChatMessage(msg);
        break;
      case 'track_change':
        // Notify the main player of track change
        window.dispatchEvent(new CustomEvent('radio-track-change', { detail: msg }));
        break;
      case 'request_added':
        // Refresh requests
        fetchRequests();
        break;
      case 'request_voted':
        // Update vote count in UI
        const el = document.querySelector(`.ri-request[data-id="${msg.id}"] .ri-req-votes`);
        if (el) el.textContent = `${msg.votes} votes`;
        break;
    }
  }

  function sendChat(text) {
    text = text.trim();
    if (!text) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat', text }));
      document.getElementById('ri-chat-input').value = '';
    } else {
      setStatus('Not connected', true);
    }
  }

  function submitRequest(artist, title) {
    artist = artist.trim(); title = title.trim();
    if (!artist || !title) {
      setStatus('Enter both artist and title', true);
      return;
    }
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'request', artist, title }));
      document.getElementById('ri-req-artist').value = '';
      document.getElementById('ri-req-title').value = '';
    } else if (usePolling) {
      // POST via REST
      fetch(`${API_URL}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, title })
      }).then(() => fetchRequests());
    }
  }

  window.riVote = function (requestId) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'vote', requestId }));
    } else if (usePolling) {
      fetch(`${API_URL}/api/requests/${requestId}/vote`, { method: 'POST' })
        .then(() => fetchRequests());
    }
  };

  // Polling fallback
  function fallBackToPolling(reason) {
    usePolling = true;
    setStatus(reason);
    // Hide chat if WS unavailable (per spec 6.6)
    const chatPanel = document.getElementById('ri-chat-panel');
    const chatTab = document.querySelector('[data-tab="chat"]');
    if (chatPanel) chatPanel.style.display = 'none';
    if (chatTab) chatTab.style.display = 'none';
    // Switch to requests tab
    document.querySelector('[data-tab="requests"]')?.click();

    pollTimer = setInterval(poll, POLL_INTERVAL);
    poll(); // immediate
  }

  async function poll() {
    try {
      const [lRes, rRes] = await Promise.all([
        fetch(`${API_URL}/api/listeners`),
        fetch(`${API_URL}/api/requests`),
      ]);
      const lData = await lRes.json();
      const rData = await rRes.json();
      updateListenerCount(lData.listeners);
      renderRequests(rData.requests);
    } catch (e) {
      setStatus('Polling failed', true);
    }
  }

  async function fetchRequests() {
    try {
      const res = await fetch(`${API_URL}/api/requests`);
      const data = await res.json();
      renderRequests(data.requests);
    } catch (e) { /* ignore */ }
  }

  // Initialize
  function init() {
    ui = createUI();
    if (!ui) return; // not on radio page
    connect();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging
  window.riClient = { connect, sendChat, submitRequest, usePolling: () => usePolling };
})();
