# 🥊 Gang Beasts — Telegram Mini App Game

A hilarious multiplayer gelatinous ragdoll physics brawler built specifically for **Telegram Mini Apps** and web browsers, inspired by [Gang Beasts](https://gangbeasts.game/).

Play in real-time with group members directly inside Telegram group chats or via private invite links!

---

## 🎮 Game Features

- **Server-Authoritative Ragdoll Physics**: 60 Hz Matter.js simulation on server, 30 Hz compressed snapshot broadcasts, smooth client-side interpolation.
- **Telegram Group Integration**:
  - Add the bot to any Telegram group and type `/play` or `/fight`.
  - Bot sends an interactive card with a **"🔥 Join Group Brawl"** button.
  - All group members tapping the button seamlessly land in that group's synchronized match lobby.
- **Iconic Arenas**:
  - 🏙️ **Rooftop Rumble**: High building roof with deadly drop-offs and antenna catwalks.
  - 🥊 **Wrestling Ring**: Classic boxing/wrestling ring with bouncy ropes and turnbuckles.
  - 🏭 **Meat Factory**: Industrial catwalks over an incinerator hazard pit.
  - 🚚 **Highway Trucks**: Moving dual truck trailers with a fatal road gap.
- **Gang Beasts Combat Mechanics**:
  - **Punching**: Rapid punches increase opponent damage percentage and knockback.
  - **Grabbing & Lifting**: Hold grab to latch onto opponents and lift them above your head.
  - **Throwing (Yeeting)**: Combine grab + punch to hurl your opponent off the stage!
  - **Stamina & Recovery**: Managing stamina is essential to maintain grabs and recover from stuns.
  - **Last Beast Standing**: 2 to 6 players battle until one survivor claims victory.
- **Cross-Platform Controls**:
  - **Desktop Keyboard & Mouse**: WASD/Arrows to move, Space to Jump, J or Left-Click to Punch, K/Shift or Right-Click to Grab (hold).
  - **Mobile Touch**: Virtual floating analog joystick + responsive on-screen action buttons (Jump, Punch, Grab).
  - **Telegram Haptic Feedback**: Native vibration impulses on punches, throws, and KOs.
  - **Zero-Dependency Web Audio Synthesizer**: Procedural sound effects with mute toggle.

---

## 🚀 Quick Start

### 1. Install & Build
```bash
npm install
npm run build
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Development Mode (Hot Reload)
```bash
# Terminal 1: Server
npm run dev:server

# Terminal 2: Vite Client (http://localhost:5173)
npm run dev:client
```

### 3. Automated Tests
```bash
# Telegram auth & deep-link routing test:
npm run test:tg

# 2-Player physics simulation & combat smoke test:
npm run test:smoke
```

---

## 🤖 Telegram Bot & Mini App Setup

1. **Create Bot**: Open [@BotFather](https://t.me/BotFather) in Telegram and run `/newbot`. Save your bot token.
2. **Deploy Server**: Deploy this repository to any host with HTTPS (e.g., Render, Railway, Fly.io, or VPS).
3. **Configure Environment Variables**:
   ```ini
   BOT_TOKEN=your_bot_token_from_botfather
   PUBLIC_URL=https://your-app-domain.com
   PORT=3000
   ```
4. **Enable Mini App in BotFather**:
   - In [@BotFather](https://t.me/BotFather), send `/mybots` -> select your bot -> **Bot Settings** -> **Configure Mini App** -> **Enable**.
   - Set the Mini App URL to your `PUBLIC_URL` (e.g. `https://your-app-domain.com`).
   - Also set your Menu Button to Web App pointing to `PUBLIC_URL`.
5. **Play in Telegram Groups**:
   - Add your bot to any Telegram group chat.
   - Send `/play` in the group.
   - Group members tap **"Join Group Brawl"** to fight together in the same room!
   - Inside the lobby, tap **"📢 Invite Group Members"** to open Telegram's native share sheet.

---

## 📁 Project Structure

```
gang-beasts-game/
├── client/                 # Frontend (HTML5 Canvas, Web Audio, Telegram WebApp)
│   ├── index.html          # UI screens (menu, lobby, HUD, touch controls)
│   ├── vite.config.js      # Vite build configuration
│   └── src/
│       ├── main.js         # Game loop, input handling, rendering, audio, socket events
│       └── style.css       # Gang Beasts styling & mobile layout
├── server/
│   └── src/
│       ├── index.js        # Express & Socket.io server, room management, rate limiter
│       ├── rooms/
│       │   └── room.js     # Matter.js 60 Hz physics engine, grab/throw, combat rules
│       └── telegram/
│           ├── auth.js     # HMAC-SHA256 validation for Telegram Mini App initData
│           └── bot.js      # Telegram Bot polling & group /play interactive messages
├── shared/
│   └── maps.js             # Platform dimensions, spawns, boundaries & themes
├── test/
│   ├── smoke.mjs           # Automated multiplayer combat & physics test
│   └── tg.mjs              # Telegram authentication & group deep-linking test
├── .env.example            # Environment variables template
├── .gitignore              # Clean git rules (node_modules, dist, .env excluded)
└── package.json            # Scripts & project metadata
```

---

## 🛡️ Security

When `BOT_TOKEN` is configured:
- Every connection requires valid Telegram `initData` cryptographically validated with HMAC-SHA256 using your secret bot token.
- User IDs and names are extracted directly from the verified signature.
- Expired (older than 24h) or forged signatures are rejected.
- Rate-limiting token bucket prevents input spamming.
