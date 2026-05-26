# YT Sync

Sync YouTube playback across devices on the same WiFi. One person is the DJ, everyone else listens in sync.

## How It Works

1. A lightweight WebSocket server runs on one device (the host)
2. A Safari Web Extension connects to the server
3. The DJ's play/pause/seek/track changes are mirrored to all listeners in real-time

## Quick Start

### 1. Start the Server

```bash
cd server
npm install
npm start
```

The server prints its local network IP — share this with other devices.

### 2. Install the Safari Extension

#### Option A: Convert to Safari Extension (recommended)

```bash
# Requires Xcode with command line tools
xcrun safari-web-extension-converter extension/ --project-location ./safari-extension --app-name "YT Sync"
```

This creates an Xcode project. Then:

1. Open the generated `.xcodeproj` in Xcode
2. Select your development team in Signing & Capabilities
3. Build and run (Cmd+R)
4. Enable the extension: Safari → Settings → Extensions → check "YT Sync"

#### Option B: Load as unsigned extension (for development)

1. Safari → Settings → Advanced → check "Show features for web developers"
2. Develop menu → check "Allow Unsigned Extensions"
3. Safari → Settings → Extensions → check "YT Sync"

Note: Unsigned extensions must be re-enabled each Safari launch.

### 3. Use It

1. Click the YT Sync extension icon in Safari's toolbar
2. Enter the server URL (e.g., `ws://192.168.1.100:3000`)
3. Enter your name
4. **DJ**: Click "Create Room" → share the 4-letter room code
5. **Listener**: Enter the room code → click "Join"
6. Open YouTube and play something — listeners will sync automatically

## Features

- **Room codes**: Simple 4-letter codes to join sessions
- **DJ controls**: Only the DJ's playback is broadcast
- **Auto-sync**: Periodic sync corrects drift (within 2 seconds)
- **Video changes**: When the DJ plays a new video, listeners navigate automatically
- **DJ handoff**: Any listener can become the DJ
- **Auto-promotion**: If the DJ leaves, the next listener is promoted

## Architecture

```
┌──────────┐     WebSocket      ┌──────────┐
│  Safari   │◄──────────────────►│  Server  │
│  (DJ)     │                    │ (Node.js)│
└──────────┘                    └────┬─────┘
                                     │
┌──────────┐     WebSocket      ┌────┴─────┐
│  Safari   │◄──────────────────►│          │
│ (Listener)│                    │          │
└──────────┘                    └──────────┘
```

## Troubleshooting

- **Extension not connecting**: Make sure the server is running and the URL uses `ws://` (not `http://`). Check that both devices are on the same WiFi network.
- **Video not syncing**: The extension only works on `youtube.com`. Make sure you're on a video page (`/watch?v=...`).
- **Autoplay blocked**: Safari may block autoplay. Click the video once to allow playback, then sync will work.
