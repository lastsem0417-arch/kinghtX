# ♞ KnightX — Play Chess Online

KnightX is a premium, real-time chess platform built with Next.js, WebSockets, and Stockfish. Experience online matchmaking, grandmaster-level engine analysis, daily tactical puzzles, customizable AI bots, and voice-assisted chess coaches in a dark, high-performance aesthetic.

---

## 🚀 Core Features

### 1. Real-Time Multiplayer Matchmaking
- **Multiple Time Controls**: Matchmaking queues for Bullet (1m, 1|1, 2|1), Blitz (3m, 3|2, 5m), and Rapid (10m, 15|10, 30m) categories.
- **WebSocket Synchronization**: Fast matchmaking queues and live boards synced in real-time using Socket.io.
- **Elo Ratings**: Win or lose rating points with full matchmaking Elo adjustments.

### 2. Stockfish Engine Game Review & Replays
- **Interactive Move Analysis**: Review completed matches move-by-move. Stockfish 10 analyzes positions sequentially at depth 8.
- **Accuracy Report**: Deep review accuracy percentages calculated for both white and black.
- **Move Classifications**: Highlights move qualities (Brilliant `!!`, Great `!`, Best `⭐`, Excellent `✓`, Good `👍`, Book `📖`, Inaccuracy `❓`, Mistake `❌`, Blunder `🛑`) on the review graph.
- **Fast-Path Game-Over Resolution**: Instantly calculates draws and mates without clogging worker threads.

### 3. Voice-Assisted AI Chess Coaches
- **Speech Synthesis**: Choose from 5 voice-enabled tutors (such as Coach Sofia or John) explaining board lines.
- **Blunder Intercept Warning**: Coaches flag major mistakes, explaining why a move is a blunder and prompting you to either undo or proceed.
- **Live Advice Hints**: Ask your coach for suggestions, drawing interactive highlighter indicators on the board.

### 4. Computer Bots Arena
- **40+ Custom AI Bots**: Challenge computers from Beginner (Elspeth, Martin) to Intermediate (Nelson) and Grandmaster.
- **Difficulty and Ratings**: Bots have custom rating tiers, profiles, and distinct dialogue styles.
- **Stars Progress Tracker**: Win games to earn bot stars, recording your progress directly on your profile.

### 5. Tactical Puzzles
- **Solve and Streak**: Solve daily tactical chess puzzles with interactive board snapping.
- **Hints**: Request hints to see candidate piece highlights using Stockfish integration.

### 6. Social Panel & Live Notifications
- **Real-Time Alerts**: Receive instant toast notifications when receiving or accepting friend requests.
- **Interactive Profile Modals**: Search for players, inspect their Elo ratings, check their game statistics, and send requests or challenge them to live games.
- **Real-time Syncing**: Component structures use `router.refresh()` to sync friend requests and online lists instantly.

---

## 🛠️ Technology Stack

- **Frontend Framework**: Next.js 16 (App Router, React 19)
- **Styling**: Tailwind CSS & Lucide Icons
- **WebSocket Engine**: Socket.io (Node.js & Express server)
- **Database**: MongoDB (Mongoose ODM)
- **Chess Logic**: Chess.js & React-Chessboard
- **Engine**: Stockfish.js wrapper running inside a Web Worker thread
- **State Management**: Zustand stores (user state, multiplayer game state)

---

## ⚙️ Environment Variables

Configure the following variables in a `.env.local` file at the root of the project:

```env
# Database Connections
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/knightx?retryWrites=true&w=majority

# Session Cryptography
SESSION_SECRET=your_32_byte_base64_secret_key

# App and WebSocket Service
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
PORT=5000
```

---

## 🏃 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Puzzles (Optional)
If you want to populate the database with initial puzzle records:
```bash
npm run seed:puzzles
```

### 3. Run the Development Environment
Run Next.js development server and the Socket.io WebSocket server concurrently:
```bash
npm run dev:full
```

Open [http://localhost:3000](http://localhost:3000) on your browser.

---

## 📦 Directory Structure

```text
├── app/                  # Next.js App Router Pages and API Handlers
│   ├── actions/          # Next.js Server Actions (Auth, Social relations)
│   ├── api/              # API endpoints (users/me, games, puzzles)
│   ├── game/             # Lobby boards, bot matches, coaches, review, replay
│   └── play/             # Live matchmaking arena dashboard
├── components/           # React Components
│   ├── chess/            # Board sections, LeftNavbar, PlayerCards, GameControls
│   └── dashboard/        # Social panels, profiles, quick-play links
├── lib/                  # Helpers (MongoDB connections, session handlers)
├── models/               # Mongoose Database Schemas (User, Game)
├── public/               # Static Assets (Sounds, icons, Stockfish worker script)
├── server/               # Socket.io Node.js Web Socket Server (Express)
├── services/             # Client-side API request scripts (auth, matchmaking)
└── store/                # Zustand client stores (useUserStore, useGameStore)
```

License: GNU General Public License v3.
