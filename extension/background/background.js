let ws = null;
let state = {
  connected: false,
  roomCode: null,
  isDj: false,
  serverUrl: "ws://localhost:3000",
  name: "Listener",
  memberCount: 0,
};

function connect(url) {
  if (ws) {
    ws.close();
  }

  state.serverUrl = url;
  ws = new WebSocket(url);

  ws.onopen = () => {
    state.connected = true;
    notifyPopup({ type: "state-update", state });
  };

  ws.onclose = () => {
    state.connected = false;
    state.roomCode = null;
    state.isDj = false;
    ws = null;
    notifyPopup({ type: "state-update", state });
  };

  ws.onerror = () => {
    state.connected = false;
    notifyPopup({ type: "state-update", state });
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleServerMessage(msg);
  };
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case "room-created":
      state.roomCode = msg.code;
      state.isDj = true;
      state.memberCount = 1;
      notifyPopup({ type: "state-update", state });
      break;

    case "room-joined":
      state.roomCode = msg.code;
      state.isDj = false;
      state.memberCount = msg.count;
      notifyPopup({ type: "state-update", state });
      break;

    case "promoted-to-dj":
      state.isDj = true;
      notifyPopup({ type: "state-update", state });
      break;

    case "demoted-from-dj":
      state.isDj = false;
      notifyPopup({ type: "state-update", state });
      break;

    case "member-joined":
    case "member-left":
      state.memberCount = msg.count;
      notifyPopup({ type: "state-update", state });
      notifyPopup({ type: "toast", message: `${msg.name} ${msg.type === "member-joined" ? "joined" : "left"}` });
      break;

    case "dj-left":
      notifyPopup({ type: "toast", message: "DJ left the room" });
      break;

    case "new-dj":
      notifyPopup({ type: "toast", message: `${msg.name} is now the DJ` });
      break;

    case "error":
      notifyPopup({ type: "toast", message: msg.message });
      break;

    case "sync":
    case "play":
    case "pause":
    case "seek":
    case "change-video":
      forwardToContentScript(msg);
      break;
  }
}

function forwardToContentScript(msg) {
  browser.tabs.query({ url: "*://*.youtube.com/*" }).then((tabs) => {
    for (const tab of tabs) {
      browser.tabs.sendMessage(tab.id, msg).catch(() => {});
    }
  });
}

function notifyPopup(msg) {
  browser.runtime.sendMessage(msg).catch(() => {});
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

browser.runtime.onMessage.addListener((msg, sender) => {
  switch (msg.type) {
    case "connect":
      connect(msg.url);
      return;

    case "disconnect":
      if (ws) ws.close();
      return;

    case "create-room":
      send({ type: "create-room", name: msg.name });
      return;

    case "join-room":
      send({ type: "join-room", code: msg.code, name: msg.name });
      return;

    case "take-dj":
      send({ type: "take-dj" });
      return;

    case "get-state":
      return Promise.resolve(state);

    case "sync":
    case "play":
    case "pause":
    case "seek":
    case "change-video":
      if (state.isDj) {
        send(msg);
      }
      return;

    case "request-sync":
      send({ type: "request-sync" });
      return;
  }
});
