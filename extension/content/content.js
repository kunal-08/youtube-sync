(() => {
  let isDj = false;
  let ignoreEvents = false;
  let currentVideoId = null;
  let video = null;
  let observer = null;

  function getVideoId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("v");
  }

  function getVideoElement() {
    return document.querySelector("video.html5-main-video") || document.querySelector("video");
  }

  function getVideoTitle() {
    const el =
      document.querySelector("h1.ytd-watch-metadata yt-formatted-string") ||
      document.querySelector("#info-contents h1") ||
      document.querySelector("h1.title");
    return el ? el.textContent.trim() : "";
  }

  function sendToBackground(msg) {
    browser.runtime.sendMessage(msg).catch(() => {});
  }

  function attachVideoListeners() {
    video = getVideoElement();
    if (!video) return;

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeeked);
  }

  function detachVideoListeners() {
    if (!video) return;
    video.removeEventListener("play", onPlay);
    video.removeEventListener("pause", onPause);
    video.removeEventListener("seeked", onSeeked);
    video = null;
  }

  function onPlay() {
    if (ignoreEvents || !isDj) return;
    sendToBackground({ type: "play", currentTime: video.currentTime });
  }

  function onPause() {
    if (ignoreEvents || !isDj) return;
    sendToBackground({ type: "pause", currentTime: video.currentTime });
  }

  function onSeeked() {
    if (ignoreEvents || !isDj) return;
    sendToBackground({
      type: "seek",
      currentTime: video.currentTime,
    });
  }

  function sendPeriodicSync() {
    if (!isDj || !video) return;
    sendToBackground({
      type: "sync",
      videoId: getVideoId(),
      currentTime: video.currentTime,
      playing: !video.paused,
      videoUrl: window.location.href,
      title: getVideoTitle(),
    });
  }

  function applySync(msg) {
    if (isDj) return;
    video = getVideoElement();
    if (!video) return;

    ignoreEvents = true;

    if (msg.videoId && msg.videoId !== getVideoId()) {
      window.location.href = `https://www.youtube.com/watch?v=${msg.videoId}`;
      ignoreEvents = false;
      return;
    }

    if (msg.currentTime !== undefined) {
      const drift = Math.abs(video.currentTime - msg.currentTime);
      const networkDelay = msg.timestamp ? (Date.now() - msg.timestamp) / 1000 : 0;
      const adjustedTime = msg.currentTime + networkDelay;

      if (drift > 2) {
        video.currentTime = adjustedTime;
      }
    }

    if (msg.playing !== undefined) {
      if (msg.playing && video.paused) {
        video.play().catch(() => {});
      } else if (!msg.playing && !video.paused) {
        video.pause();
      }
    }

    setTimeout(() => {
      ignoreEvents = false;
    }, 500);
  }

  function watchForVideoChanges() {
    let lastVideoId = getVideoId();

    const check = () => {
      const vid = getVideoId();
      if (vid && vid !== lastVideoId) {
        lastVideoId = vid;
        currentVideoId = vid;

        setTimeout(() => {
          detachVideoListeners();
          attachVideoListeners();

          if (isDj) {
            sendToBackground({
              type: "change-video",
              videoId: vid,
              videoUrl: window.location.href,
              title: getVideoTitle(),
            });
          }
        }, 1000);
      }
    };

    observer = new MutationObserver(check);
    observer.observe(document.querySelector("title") || document.head, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    setInterval(check, 2000);
  }

  browser.runtime.onMessage.addListener((msg) => {
    switch (msg.type) {
      case "sync":
      case "change-video":
        applySync(msg);
        break;

      case "play":
        if (!isDj) {
          video = getVideoElement();
          if (video) {
            ignoreEvents = true;
            if (msg.currentTime !== undefined) video.currentTime = msg.currentTime;
            video.play().catch(() => {});
            setTimeout(() => (ignoreEvents = false), 500);
          }
        }
        break;

      case "pause":
        if (!isDj) {
          video = getVideoElement();
          if (video) {
            ignoreEvents = true;
            if (msg.currentTime !== undefined) video.currentTime = msg.currentTime;
            video.pause();
            setTimeout(() => (ignoreEvents = false), 500);
          }
        }
        break;

      case "seek":
        if (!isDj) {
          video = getVideoElement();
          if (video) {
            ignoreEvents = true;
            video.currentTime = msg.currentTime;
            setTimeout(() => (ignoreEvents = false), 500);
          }
        }
        break;
    }
  });

  browser.runtime.onMessage.addListener((msg) => {
    if (msg.type === "state-update") {
      isDj = msg.state.isDj;
    }
  });

  function init() {
    currentVideoId = getVideoId();
    attachVideoListeners();
    watchForVideoChanges();

    browser.runtime.sendMessage({ type: "get-state" }).then((s) => {
      if (s) isDj = s.isDj;
    }).catch(() => {});

    setInterval(sendPeriodicSync, 3000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  showSyncBadge();

  function showSyncBadge() {
    const badge = document.createElement("div");
    badge.id = "yt-sync-badge";
    badge.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 99999;
      background: #1a1a2e; color: #e94560; padding: 8px 14px;
      border-radius: 20px; font-family: -apple-system, sans-serif;
      font-size: 12px; font-weight: 600; opacity: 0.85;
      pointer-events: none; transition: opacity 0.3s;
      border: 1px solid #e94560;
    `;
    badge.textContent = "YT Sync Active";
    document.body.appendChild(badge);

    setTimeout(() => {
      badge.style.opacity = "0";
      setTimeout(() => badge.remove(), 300);
    }, 3000);
  }
})();
