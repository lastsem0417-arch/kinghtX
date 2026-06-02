# ♞ KnightX — Play Chess Online

KnightX is a premium, real-time chess platform built with Next.js, WebSockets, and Stockfish. Experience online matchmaking, grandmaster-level engine analysis, daily tactical puzzles, customizable AI bots, and voice-assisted chess coaches in a dark, high-performance aesthetic.

---

## 🚀 Core Features

### 1. Real-Time Multiplayer Matchmaking & Variants
- **Multiple Time Controls**: Matchmaking queues for Bullet (1m, 1|1, 2|1), Blitz (3m, 3|2, 5m), and Rapid (10m, 15|10, 30m) categories.
- **WebSocket Synchronization**: Fast matchmaking queues and live boards synced in real-time using Socket.io.
- **Elo Ratings**: Win or lose rating points with full matchmaking Elo adjustments.
- **Chess Variants**: Play standard chess or choose:
  - **3-Check**: The player checking the opponent's king 3 times wins the game immediately. Features live check counters.
  - **Chess960 (Fischer Random)**: Generates random back-rank configurations (opposite-colored bishops, king between rooks) with fully compliant Fischer Random castling support.

### 2. Stockfish Engine Game Review & Self-Analysis
- **Interactive Move Analysis**: Review completed matches move-by-move. Stockfish 10 analyzes positions sequentially.
- **Accuracy Report**: Deep review accuracy percentages calculated for both white and black.
- **Move Classifications**: Highlights move qualities (Brilliant `!!`, Great `!`, Best `⭐`, Excellent `✓`, Good `👍`, Book `📖`, Inaccuracy `❓`, Mistake `❌`, Blunder `🛑`) on the review graph.
- **Lichess Opening Explorer**: Live integration on the self-analysis board. Fetches master opening names and win/draw percentages, rendered as a sleek visual bar, alongside top book continuations.
- **Tactical Vision Scanners**: Active client-side scanners automatically flag critical tactical motifs (Forks, Pins, Skewers) on the review and analysis boards.

### 3. Voice-Assisted AI Chess Coaches
- **Speech Synthesis (TTS)**: Choice of 5 voice-enabled tutors (Coach Sofia, John, etc.) speaking directly to you to explain lines and tactical motifs.
- **Blunder Intercept Warning**: Coaches flag major mistakes, explaining why a move is a blunder and prompting you to either undo or proceed.
- **Live Advice Hints**: Ask your coach for suggestions, drawing interactive highlighter indicators on the board.

### 4. Computer Bots Arena
- **40+ Custom AI Bots**: Challenge computers from Beginner (Elspeth, Martin) to Intermediate (Nelson) and Grandmaster.
- **Difficulty and Ratings**: Bots have custom rating tiers, profiles, and distinct dialogue styles.
- **Stars Progress Tracker**: Win games to earn bot stars, recording your progress directly on your profile.

### 5. Tactical Puzzles & Puzzle Battles
- **Solve and Streak**: Solve daily tactical chess puzzles with interactive board snapping.
- **Puzzle Battles**: Face off in real-time multiplayer puzzle solving contests! Solves are synchronized over WebSockets, displaying split score bars, wrong-submission freezes, and strike limits (3 strikes and out).
- **Hints**: Request hints to see candidate piece highlights using Stockfish integration.

### 6. Endgame Drills Arena
- **Presets & Engine Defense**: Challenge yourself against Stockfish depth 12 in predefined endgame templates: King & Rook, King & Queen, King & 2 Bishops, and King & Pawn (promotion practice).
- **Move Limits**: Enforces a 50-move limit to convert the checkmate before drawing.

### 7. Social Panel & Live Chat
- **Real-Time Direct Messaging (DMs)**: Sleek glassmorphic chat overlay. Connects friends in real-time, displaying online status, database message history logs, and instant Socket.io chat synchronization.
- **Real-Time Alerts**: Receive instant toast notifications when receiving or accepting friend requests.
- **Interactive Profile Modals**: Search for players, inspect their Elo ratings, check their game statistics, and send requests or challenge them to live games.

### 8. Secure Database-Backed Account Recovery
- **Verification Code Token**: Secure database persistence of password reset pins with a 15-minute expiration timeline.
- **Server Verification**: Server-side code checks prevent client-side authentication bypasses, securely updating credentials with `bcrypt`.

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
