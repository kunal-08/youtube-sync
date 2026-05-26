const $ = (id) => document.getElementById(id);

const connectSection = $("connectSection");
const lobbySection = $("lobbySection");
const roomSection = $("roomSection");

function showSection(section) {
  connectSection.classList.add("hidden");
  lobbySection.classList.add("hidden");
  roomSection.classList.add("hidden");
  section.classList.remove("hidden");
}

function updateUI(state) {
  const dot = $("statusDot");
  const text = $("statusText");

  if (state.connected) {
    dot.classList.add("connected");
    text.textContent = "Connected";

    if (state.roomCode) {
      showSection(roomSection);
      $("roomCodeDisplay").textContent = state.roomCode;

      const badge = $("roleBadge");
      if (state.isDj) {
        badge.textContent = "DJ";
        badge.className = "role-badge dj";
        $("takeDjBtn").classList.add("hidden");
      } else {
        badge.textContent = "Listener";
        badge.className = "role-badge listener";
        $("takeDjBtn").classList.remove("hidden");
      }

      $("memberCount").textContent = `${state.memberCount || 1} connected`;
    } else {
      showSection(lobbySection);
    }
  } else {
    dot.classList.remove("connected");
    text.textContent = "Disconnected";
    showSection(connectSection);
  }
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

$("connectBtn").addEventListener("click", () => {
  const url = $("serverUrl").value.trim();
  if (!url) return;

  const name = $("nameInput").value.trim() || "Listener";
  localStorage.setItem("yt-sync-server", url);
  localStorage.setItem("yt-sync-name", name);

  browser.runtime.sendMessage({ type: "connect", url });
});

$("createRoomBtn").addEventListener("click", () => {
  const name = localStorage.getItem("yt-sync-name") || "DJ";
  browser.runtime.sendMessage({ type: "create-room", name });
});

$("joinRoomBtn").addEventListener("click", () => {
  const code = $("roomCodeInput").value.trim().toUpperCase();
  if (code.length !== 4) {
    showToast("Enter a 4-character room code");
    return;
  }
  const name = localStorage.getItem("yt-sync-name") || "Listener";
  browser.runtime.sendMessage({ type: "join-room", code, name });
});

$("roomCodeInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("joinRoomBtn").click();
});

$("takeDjBtn").addEventListener("click", () => {
  browser.runtime.sendMessage({ type: "take-dj" });
});

$("disconnectBtn").addEventListener("click", () => {
  browser.runtime.sendMessage({ type: "disconnect" });
});

$("leaveRoomBtn").addEventListener("click", () => {
  browser.runtime.sendMessage({ type: "disconnect" });
});

browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === "state-update") {
    updateUI(msg.state);
  } else if (msg.type === "toast") {
    showToast(msg.message);
  }
});

const savedUrl = localStorage.getItem("yt-sync-server");
if (savedUrl) $("serverUrl").value = savedUrl;

const savedName = localStorage.getItem("yt-sync-name");
if (savedName) $("nameInput").value = savedName;

browser.runtime.sendMessage({ type: "get-state" }).then((state) => {
  if (state) updateUI(state);
}).catch(() => {});
