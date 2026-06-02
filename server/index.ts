import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import { Chess } from 'chess.js';
import mongoose from 'mongoose';
import { jwtVerify } from 'jose';
import dotenv from 'dotenv';
import path from 'path';

// ─── Load Environment Variables ──────────────────────────────────────────────
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;
const PORT = process.env.PORT || 3001;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI is not defined in .env.local');
  process.exit(1);
}
if (!SESSION_SECRET) {
  console.error('Error: SESSION_SECRET is not defined in .env.local');
  process.exit(1);
}

// ─── MongoDB Models ──────────────────────────────────────────────────────────
// Define models locally to avoid path resolution conflicts
const UserSchema = new mongoose.Schema({
  username: String,
  email: String,
  rating: {
    rapid: { type: Number, default: 800 },
    blitz: { type: Number, default: 800 },
    bullet: { type: Number, default: 800 },
    puzzle: { type: Number, default: 800 },
  },
  stats: {
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
  },
  friends: [mongoose.Schema.Types.ObjectId],
  gameHistory: [mongoose.Schema.Types.ObjectId],
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

const GameSchema = new mongoose.Schema({
  players: {
    white: {
      userId: mongoose.Schema.Types.ObjectId,
      username: String,
      rating: Number,
      ratingChange: Number,
    },
    black: {
      userId: mongoose.Schema.Types.ObjectId,
      username: String,
      rating: Number,
      ratingChange: Number,
    },
  },
  pgn: { type: String, default: '' },
  fen: { type: String, default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
  result: { type: String, enum: ['white', 'black', 'draw'] },
  termination: { type: String, enum: ['checkmate', 'resign', 'timeout', 'draw', 'abandoned', 'three-check'] },
  timeControl: String,
  timeControlCategory: { type: String, enum: ['bullet', 'blitz', 'rapid', 'classical'] },
  opening: { type: String, default: '' },
  variant: { type: String, enum: ['standard', '3check', 'chess960'], default: 'standard' },
  checks: {
    white: { type: Number, default: 0 },
    black: { type: Number, default: 0 },
  },
  status: { type: String, enum: ['waiting', 'active', 'completed'], default: 'waiting' },
  roomId: { type: String, required: true, unique: true },
  endedAt: Date,
}, { timestamps: true });

const Game = mongoose.models.Game || mongoose.model('Game', GameSchema);

const PuzzleSchema = new mongoose.Schema({
  puzzleId: { type: String, required: true, unique: true },
  fen: { type: String, required: true },
  moves: [{ type: String, required: true }],
  rating: { type: Number, required: true },
  ratingDeviation: { type: Number, required: true },
  popularity: { type: Number, required: true },
  themes: [{ type: String }],
  gameUrl: { type: String },
}, { timestamps: true });

const Puzzle = mongoose.models.Puzzle || mongoose.model('Puzzle', PuzzleSchema);

const samplePuzzles = [
  {
    puzzleId: 'scholar_mate',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    moves: ['h5f7'],
    rating: 600,
    ratingDeviation: 80,
    popularity: 95,
    themes: ['mate', 'mateIn1', 'opening', 'short'],
  },
  {
    puzzleId: 'back_rank_mate',
    fen: '6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1',
    moves: ['e1e8'],
    rating: 800,
    ratingDeviation: 75,
    popularity: 98,
    themes: ['mate', 'mateIn1', 'backRankMate', 'endgame'],
  },
  {
    puzzleId: 'bishop_sacrifice',
    fen: 'rn1qkbnr/ppp2ppp/3p4/4p3/2B1P1b1/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 4',
    moves: ['c4f7', 'e8f7', 'f3g5', 'f7e8', 'd1g4'],
    rating: 1100,
    ratingDeviation: 60,
    popularity: 90,
    themes: ['tactics', 'fork', 'sacrifice', 'opening'],
  }
];

interface PuzzleBattleRoom {
  battleId: string;
  p1: {
    userId: string;
    username: string;
    socketId: string;
    score: number;
    strikes: number;
    currentPuzzleIndex: number;
    finished: boolean;
  };
  p2: {
    userId: string;
    username: string;
    socketId: string;
    score: number;
    strikes: number;
    currentPuzzleIndex: number;
    finished: boolean;
  };
  puzzles: any[];
  startTime: number;
  duration: number;
  timer: NodeJS.Timeout | null;
}

// ─── Initialize Express & Socket Server ──────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB via Socket Server'))
  .catch((err) => console.error('MongoDB connection error in Socket Server:', err));

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface SessionPayload {
  userId: string;
  username: string;
  email: string;
}

interface SocketUser {
  userId: string;
  username: string;
  email: string;
}

interface GamePlayer {
  userId: string;
  username: string;
  rating: number;
  socketId: string;
}

interface GameRoom {
  roomId: string;
  white: GamePlayer;
  black: GamePlayer;
  chess: Chess;
  timeControl: string; // e.g. "10+0" or "3+2"
  timeControlCategory: 'bullet' | 'blitz' | 'rapid' | 'classical';
  status: 'active' | 'completed';
  clocks: {
    white: number; // seconds
    black: number; // seconds
  };
  lastMoveTime: number; // timestamp ms
  activeTimer: NodeJS.Timeout | null;
  drawOfferedBy: string | null; // userId
  spectators: Set<string>; // socketIds
  disconnectTimers: {
    white?: NodeJS.Timeout;
    black?: NodeJS.Timeout;
  };
  variant: 'standard' | '3check' | 'chess960';
  checks: {
    white: number;
    black: number;
  };
}

interface QueuePlayer {
  userId: string;
  username: string;
  rating: number;
  timeControl: string;
  category: 'bullet' | 'blitz' | 'rapid' | 'classical';
  socketId: string;
  joinedAt: number;
  variant?: 'standard' | '3check' | 'chess960';
}

// ─── In-Memory Game State ────────────────────────────────────────────────────
const activeGames = new Map<string, GameRoom>();
const matchmakingQueue: QueuePlayer[] = [];
const onlineUsers = new Map<string, Set<string>>(); // userId -> Set of socketIds

const puzzleBattleQueue: QueuePlayer[] = [];
const activePuzzleBattles = new Map<string, PuzzleBattleRoom>();

// Helper to determine time control category
function getCategory(timeControl: string): 'bullet' | 'blitz' | 'rapid' | 'classical' {
  // Parsing standard forms like "10 min", "3 | 2", "1 min"
  const clean = timeControl.toLowerCase();
  if (clean.includes('1 min') || clean.includes('1 | 1') || clean.includes('2 | 1')) {
    return 'bullet';
  }
  if (clean.includes('3 min') || clean.includes('3 | 2') || clean.includes('5 min')) {
    return 'blitz';
  }
  if (clean.includes('10 min') || clean.includes('15 | 10') || clean.includes('30 min')) {
    return 'rapid';
  }
  return 'classical';
}

// Helper to calculate Elo rating changes
function calculateElo(ratingA: number, ratingB: number, scoreA: number, kFactor = 17) {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));
  const scoreB = 1 - scoreA;

  const newRatingA = Math.round(ratingA + kFactor * (scoreA - expectedA));
  const newRatingB = Math.round(ratingB + kFactor * (scoreB - expectedB));

  return {
    a: { newRating: newRatingA, change: newRatingA - ratingA },
    b: { newRating: newRatingB, change: newRatingB - ratingB },
  };
}

// ─── Socket Authentication Middleware ────────────────────────────────────────
async function authenticateSocket(socket: Socket): Promise<SocketUser | null> {
  let token = socket.handshake.auth?.token;

  if (!token && socket.handshake.headers?.cookie) {
    const cookies = socket.handshake.headers.cookie.split(';').reduce((acc: any, curr: string) => {
      const [key, value] = curr.split('=').map((c) => c.trim());
      if (key && value) acc[key] = value;
      return acc;
    }, {});
    token = cookies['knightx_session'];
  }

  if (!token) return null;

  try {
    const encodedKey = new TextEncoder().encode(SESSION_SECRET);
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ['HS256'],
    });
    const session = payload as unknown as SessionPayload;
    return {
      userId: session.userId,
      username: session.username,
      email: session.email,
    };
  } catch (err) {
    return null;
  }
}

// Socket Connection Handler
io.use(async (socket, next) => {
  const user = await authenticateSocket(socket);
  if (!user) {
    return next(new Error('Authentication failed'));
  }
  socket.data.user = user;
  next();
});

io.on('connection', (socket: Socket) => {
  const user = socket.data.user as SocketUser;
  console.log(`User connected: @${user.username} (${socket.id})`);

  // Add to online users
  if (!onlineUsers.has(user.userId)) {
    onlineUsers.set(user.userId, new Set());
  }
  onlineUsers.get(user.userId)!.add(socket.id);

  // Broadcast user online status
  io.emit('user_status', { userId: user.userId, status: 'online' });

  // ─── EVENT: join_queue ─────────────────────────────────────────────────────
  socket.on('join_queue', async (payload: { timeControl: string; variant?: 'standard' | '3check' | 'chess960' }) => {
    const isAlreadyQueued = matchmakingQueue.some(p => p.userId === user.userId);
    if (isAlreadyQueued) return;

    try {
      const category = getCategory(payload.timeControl);
      const userDoc = await User.findById(user.userId);
      const rating = userDoc?.rating?.[category] ?? 800;
      const variant = payload.variant || 'standard';

      const player: QueuePlayer = {
        userId: user.userId,
        username: user.username,
        rating,
        timeControl: payload.timeControl,
        category,
        socketId: socket.id,
        joinedAt: Date.now(),
        variant
      };

      matchmakingQueue.push(player);
      socket.emit('queue_joined', { timeControl: payload.timeControl, rating, variant });
      console.log(`Player @${user.username} joined matchmaking for ${payload.timeControl} Variant: ${variant} (Rating: ${rating})`);
    } catch (err) {
      console.error('Error joining queue:', err);
    }
  });

  // ─── EVENT: leave_queue ────────────────────────────────────────────────────
  socket.on('leave_queue', () => {
    const index = matchmakingQueue.findIndex(p => p.socketId === socket.id);
    if (index !== -1) {
      matchmakingQueue.splice(index, 1);
      socket.emit('queue_left');
      console.log(`Player @${user.username} left matchmaking queue`);
    }
  });

  // ─── EVENT: join_game ──────────────────────────────────────────────────────
  socket.on('join_game', (payload: { roomId: string }) => {
    const { roomId } = payload;
    const room = activeGames.get(roomId);

    if (!room) {
      socket.emit('error_message', { message: 'Game not found.' });
      return;
    }

    socket.join(`game:${roomId}`);

    const isWhitePlayer = room.white.userId === user.userId;
    const isBlackPlayer = room.black.userId === user.userId;

    if (isWhitePlayer || isBlackPlayer) {
      // Reconnection logic
      const side = isWhitePlayer ? 'white' : 'black';
      
      // Clear disconnect timer if active
      if (room.disconnectTimers[side]) {
        clearTimeout(room.disconnectTimers[side]);
        delete room.disconnectTimers[side];
        io.to(`game:${roomId}`).emit('player_reconnected', { username: user.username, side });
      }

      // Update socket ID
      if (isWhitePlayer) room.white.socketId = socket.id;
      else room.black.socketId = socket.id;

      // Send complete room state back to reconnecting player
      socket.emit('game_state', {
        roomId: room.roomId,
        fen: room.chess.fen(),
        pgn: room.chess.pgn(),
        turn: room.chess.turn(),
        timeControl: room.timeControl,
        clocks: room.clocks,
        white: { username: room.white.username, rating: room.white.rating },
        black: { username: room.black.username, rating: room.black.rating },
        yourColor: side,
        status: room.status,
        variant: room.variant,
        checks: room.checks,
      });
    } else {
      // Spectator join
      room.spectators.add(socket.id);
      socket.emit('game_state', {
        roomId: room.roomId,
        fen: room.chess.fen(),
        pgn: room.chess.pgn(),
        turn: room.chess.turn(),
        timeControl: room.timeControl,
        clocks: room.clocks,
        white: { username: room.white.username, rating: room.white.rating },
        black: { username: room.black.username, rating: room.black.rating },
        yourColor: 'spectator',
        status: room.status,
        variant: room.variant,
        checks: room.checks,
      });

      // Update spectator counts
      io.to(`game:${roomId}`).emit('spectator_count', { count: room.spectators.size });
    }
  });

  // ─── EVENT: make_move ──────────────────────────────────────────────────────
  socket.on('make_move', async (payload: { roomId: string; move: any }) => {
    const { roomId, move } = payload;
    const room = activeGames.get(roomId);

    if (!room || room.status !== 'active') return;

    const isWhiteTurn = room.chess.turn() === 'w';
    const activePlayer = isWhiteTurn ? room.white : room.black;

    // Verify it's the correct player making the move
    if (activePlayer.userId !== user.userId) return;

    try {
      const prevFen = room.chess.fen();
      const moveResult = room.chess.move(move);

      if (moveResult) {
        // Calculate elapsed time and decrement active player's clock
        const now = Date.now();
        const elapsedSeconds = Math.max(0, (now - room.lastMoveTime) / 1000);
        
        if (isWhiteTurn) {
          room.clocks.white = Math.max(0, room.clocks.white - elapsedSeconds);
          // Handle increment
          const inc = parseIncrement(room.timeControl);
          room.clocks.white += inc;
        } else {
          room.clocks.black = Math.max(0, room.clocks.black - elapsedSeconds);
          const inc = parseIncrement(room.timeControl);
          room.clocks.black += inc;
        }

        room.lastMoveTime = now;
        room.drawOfferedBy = null; // Clear draw offers on a move

        // Check if opponent is checked after our move
        const inCheck = room.chess.inCheck();
        if (inCheck) {
          const checkingSide = room.chess.turn() === 'w' ? 'black' : 'white';
          room.checks[checkingSide] += 1;
        }

        // Broadcast move execution to all participants in the room
        io.to(`game:${roomId}`).emit('move_made', {
          move: moveResult,
          fen: room.chess.fen(),
          pgn: room.chess.pgn(),
          turn: room.chess.turn(),
          clocks: room.clocks,
          checks: room.checks,
        });

        // Restart timer countdown for the other player
        startRoomCountdown(roomId);

        // Check 3-check victory or standard chess game over
        const currentCheckingSide = room.chess.turn() === 'w' ? 'black' : 'white';
        if (room.variant === '3check' && room.checks[currentCheckingSide] >= 3) {
          await handleGameOver(room, currentCheckingSide, 'three-check');
        } else if (room.chess.isGameOver()) {
          let winner: 'white' | 'black' | 'draw' = 'draw';
          let termination: 'checkmate' | 'draw' | 'three-check' = 'draw';

          if (room.chess.isCheckmate()) {
            winner = room.chess.turn() === 'w' ? 'black' : 'white';
            termination = 'checkmate';
          }

          await handleGameOver(room, winner, termination);
        }
      }
    } catch (err) {
      socket.emit('move_error', { message: 'Illegal move attempted.' });
    }
  });

  // ─── EVENT: resign ─────────────────────────────────────────────────────────
  socket.on('resign', async (payload: { roomId: string }) => {
    const { roomId } = payload;
    const room = activeGames.get(roomId);

    if (!room || room.status !== 'active') return;

    const isWhite = room.white.userId === user.userId;
    const isBlack = room.black.userId === user.userId;

    if (!isWhite && !isBlack) return;

    const winner = isWhite ? 'black' : 'white';
    await handleGameOver(room, winner, 'resign');
  });

  // ─── EVENT: offer_draw ─────────────────────────────────────────────────────
  socket.on('offer_draw', (payload: { roomId: string }) => {
    const { roomId } = payload;
    const room = activeGames.get(roomId);

    if (!room || room.status !== 'active') return;

    const isPlayer = room.white.userId === user.userId || room.black.userId === user.userId;
    if (!isPlayer) return;

    room.drawOfferedBy = user.userId;
    const recipient = room.white.userId === user.userId ? room.black.socketId : room.white.socketId;
    io.to(recipient).emit('draw_offered');
  });

  // ─── EVENT: accept_draw ────────────────────────────────────────────────────
  socket.on('accept_draw', async (payload: { roomId: string }) => {
    const { roomId } = payload;
    const room = activeGames.get(roomId);

    if (!room || room.status !== 'active') return;

    // Verify there was a draw offered and it wasn't by the accepting user
    if (!room.drawOfferedBy || room.drawOfferedBy === user.userId) return;

    await handleGameOver(room, 'draw', 'draw');
  });

  // ─── EVENT: decline_draw ───────────────────────────────────────────────────
  socket.on('decline_draw', (payload: { roomId: string }) => {
    const { roomId } = payload;
    const room = activeGames.get(roomId);

    if (!room || room.status !== 'active') return;

    room.drawOfferedBy = null;
    const recipient = room.white.userId === user.userId ? room.black.socketId : room.white.socketId;
    io.to(recipient).emit('draw_declined');
  });

  // ─── EVENT: chat_message ───────────────────────────────────────────────────
  socket.on('chat_message', (payload: { roomId: string; text: string }) => {
    const { roomId, text } = payload;
    const room = activeGames.get(roomId);

    if (!room) return;

    // Send chat message to all room members
    io.to(`game:${roomId}`).emit('chat_received', {
      sender: user.username,
      text: text.substring(0, 150), // prevent long texts spam
      timestamp: Date.now(),
    });
  });

  // ─── EVENT: global_chat_send ────────────────────────────────────────────────
  socket.on('global_chat_send', (payload: { text: string }) => {
    const { text } = payload;
    if (!text || !text.trim()) return;

    io.emit('global_chat_received', {
      sender: user.username,
      text: text.substring(0, 150),
      timestamp: Date.now(),
    });
  });

  // ─── EVENT: send_direct_message ─────────────────────────────────────────────
  socket.on('send_direct_message', (payload: { receiverId: string; text: string; createdAt?: string }) => {
    const { receiverId, text } = payload;
    if (!receiverId || !text || !text.trim()) return;

    const messageToEmit = {
      senderId: user.userId,
      receiverId,
      text: text.trim(),
      createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
    };

    // Send to all receiver's socket connections
    const receiverSockets = onlineUsers.get(receiverId);
    if (receiverSockets) {
      receiverSockets.forEach((sId) => {
        io.to(sId).emit('receive_direct_message', messageToEmit);
      });
    }

    // Send to all other sender's socket connections (multi-tab sync)
    const senderSockets = onlineUsers.get(user.userId);
    if (senderSockets) {
      senderSockets.forEach((sId) => {
        if (sId !== socket.id) {
          io.to(sId).emit('receive_direct_message', messageToEmit);
        }
      });
    }
  });

  // ─── EVENT: join_puzzle_battle_queue ─────────────────────────────────────────
  socket.on('join_puzzle_battle_queue', async () => {
    const isAlreadyQueued = puzzleBattleQueue.some(p => p.userId === user.userId);
    if (isAlreadyQueued) return;

    try {
      const userDoc = await User.findById(user.userId);
      const rating = userDoc?.rating?.puzzle ?? 800;

      const player: QueuePlayer = {
        userId: user.userId,
        username: user.username,
        rating,
        timeControl: 'puzzle',
        category: 'rapid',
        socketId: socket.id,
        joinedAt: Date.now(),
      };

      puzzleBattleQueue.push(player);
      socket.emit('puzzle_queue_joined', { rating });
      console.log(`Player @${user.username} joined Puzzle Battle queue (Rating: ${rating})`);
    } catch (err) {
      console.error('Error joining puzzle queue:', err);
    }
  });

  // ─── EVENT: leave_puzzle_battle_queue ────────────────────────────────────────
  socket.on('leave_puzzle_battle_queue', () => {
    const index = puzzleBattleQueue.findIndex(p => p.socketId === socket.id);
    if (index !== -1) {
      puzzleBattleQueue.splice(index, 1);
      socket.emit('puzzle_queue_left');
      console.log(`Player @${user.username} left Puzzle Battle queue`);
    }
  });

  // ─── EVENT: puzzle_battle_submit ─────────────────────────────────────────────
  socket.on('puzzle_battle_submit', (payload: { battleId: string; isCorrect: boolean }) => {
    const { battleId, isCorrect } = payload;
    const battle = activePuzzleBattles.get(battleId);
    if (!battle) return;

    const isP1 = battle.p1.userId === user.userId;
    const player = isP1 ? battle.p1 : battle.p2;

    if (player.finished) return;

    if (isCorrect) {
      player.score += 1;
    } else {
      player.strikes += 1;
      if (player.strikes >= 3) {
        player.finished = true;
      }
    }

    player.currentPuzzleIndex += 1;
    if (player.currentPuzzleIndex >= battle.puzzles.length) {
      player.finished = true;
    }

    // Broadcast sync
    io.to(`puzzle_battle:${battleId}`).emit('puzzle_battle_sync', {
      p1: { userId: battle.p1.userId, score: battle.p1.score, strikes: battle.p1.strikes, finished: battle.p1.finished, currentIndex: battle.p1.currentPuzzleIndex },
      p2: { userId: battle.p2.userId, score: battle.p2.score, strikes: battle.p2.strikes, finished: battle.p2.finished, currentIndex: battle.p2.currentPuzzleIndex }
    });

    // Check if both finished
    if (battle.p1.finished && battle.p2.finished) {
      endPuzzleBattle(battleId, "both_finished");
    }
  });

  // ─── EVENT: friend_request_notification ─────────────────────────────────────
  socket.on('friend_request_notification', (payload: { targetUserId: string }) => {
    const { targetUserId } = payload;
    const recipientSockets = onlineUsers.get(targetUserId);
    if (recipientSockets) {
      recipientSockets.forEach((socketId) => {
        io.to(socketId).emit('incoming_friend_request', {
          senderUsername: user.username,
          senderId: user.userId,
        });
      });
    }
  });

  // ─── EVENT: friend_request_accepted ─────────────────────────────────────────
  socket.on('friend_request_accepted', (payload: { targetUserId: string }) => {
    const { targetUserId } = payload;
    const recipientSockets = onlineUsers.get(targetUserId);
    if (recipientSockets) {
      recipientSockets.forEach((socketId) => {
        io.to(socketId).emit('friend_request_accepted_notify', {
          senderUsername: user.username,
        });
      });
    }
  });

  // ─── EVENT: disconnect ─────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`User disconnected: @${user.username} (${socket.id})`);

    // Remove socket from online status tracking
    if (onlineUsers.has(user.userId)) {
      const userSockets = onlineUsers.get(user.userId)!;
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        onlineUsers.delete(user.userId);
        io.emit('user_status', { userId: user.userId, status: 'offline' });
      }
    }

    // Remove from matchmaking queue
    const queueIndex = matchmakingQueue.findIndex(p => p.socketId === socket.id);
    if (queueIndex !== -1) {
      matchmakingQueue.splice(queueIndex, 1);
    }

    // Remove from puzzle battle queue
    const puzzleQueueIndex = puzzleBattleQueue.findIndex(p => p.socketId === socket.id);
    if (puzzleQueueIndex !== -1) {
      puzzleBattleQueue.splice(puzzleQueueIndex, 1);
    }

    // Handle puzzle battle disconnections
    for (const [battleId, battle] of activePuzzleBattles.entries()) {
      const isP1 = battle.p1.socketId === socket.id;
      const isP2 = battle.p2.socketId === socket.id;

      if (isP1 || isP2) {
        const disconnectedPlayer = isP1 ? battle.p1 : battle.p2;
        disconnectedPlayer.finished = true;

        io.to(`puzzle_battle:${battleId}`).emit('puzzle_battle_sync', {
          p1: { userId: battle.p1.userId, score: battle.p1.score, strikes: battle.p1.strikes, finished: battle.p1.finished, currentIndex: battle.p1.currentPuzzleIndex },
          p2: { userId: battle.p2.userId, score: battle.p2.score, strikes: battle.p2.strikes, finished: battle.p2.finished, currentIndex: battle.p2.currentPuzzleIndex }
        });

        if (battle.p1.finished && battle.p2.finished) {
          endPuzzleBattle(battleId, "disconnect");
        }
      }
    }

    // Handle game disconnections
    for (const [roomId, room] of activeGames.entries()) {
      if (room.status !== 'active') continue;

      const isWhite = room.white.socketId === socket.id;
      const isBlack = room.black.socketId === socket.id;

      if (isWhite || isBlack) {
        const side = isWhite ? 'white' : 'black';
        const opponentSocket = isWhite ? room.black.socketId : room.white.socketId;
        
        // Notify opponent
        io.to(opponentSocket).emit('player_disconnected', { username: user.username, side });

        // Set abandonment timeout (e.g. 60 seconds)
        room.disconnectTimers[side] = setTimeout(async () => {
          console.log(`Player @${user.username} abandoned the match in room ${roomId}`);
          const winner = isWhite ? 'black' : 'white';
          await handleGameOver(room, winner, 'abandoned');
        }, 60000);
      } else if (room.spectators.has(socket.id)) {
        room.spectators.delete(socket.id);
        io.to(`game:${roomId}`).emit('spectator_count', { count: room.spectators.size });
      }
    }
  });
});

// ─── Server countdown logic ──────────────────────────────────────────────────
function startRoomCountdown(roomId: string) {
  const room = activeGames.get(roomId);
  if (!room || room.status !== 'active') return;

  if (room.activeTimer) {
    clearInterval(room.activeTimer);
  }

  room.activeTimer = setInterval(async () => {
    const isWhiteTurn = room.chess.turn() === 'w';
    
    // Decrement correct clock
    if (isWhiteTurn) {
      room.clocks.white = Math.max(0, room.clocks.white - 1);
      if (room.clocks.white <= 0) {
        await handleGameOver(room, 'black', 'timeout');
      }
    } else {
      room.clocks.black = Math.max(0, room.clocks.black - 1);
      if (room.clocks.black <= 0) {
        await handleGameOver(room, 'white', 'timeout');
      }
    }

    // Sync clock updates to both clients
    io.to(`game:${roomId}`).emit('clock_sync', { clocks: room.clocks });
  }, 1000);
}

// Parse increment from time control
function parseIncrement(timeControl: string): number {
  // e.g. "3 | 2" -> returns 2
  const parts = timeControl.split('|');
  if (parts.length === 2) {
    const inc = parseInt(parts[1].trim());
    return isNaN(inc) ? 0 : inc;
  }
  return 0;
}

// ─── Game End Handler ────────────────────────────────────────────────────────
async function handleGameOver(
  room: GameRoom, 
  winner: 'white' | 'black' | 'draw', 
  termination: 'checkmate' | 'resign' | 'timeout' | 'draw' | 'abandoned' | 'three-check'
) {
  if (room.status === 'completed') return;
  room.status = 'completed';

  if (room.activeTimer) {
    clearInterval(room.activeTimer);
    room.activeTimer = null;
  }

  // Clear disconnect timers
  if (room.disconnectTimers.white) clearTimeout(room.disconnectTimers.white);
  if (room.disconnectTimers.black) clearTimeout(room.disconnectTimers.black);

  try {
    // 1. Calculate Elo adjustments
    const whiteUser = await User.findById(room.white.userId);
    const blackUser = await User.findById(room.black.userId);

    let whiteChange = 0;
    let blackChange = 0;

    if (whiteUser && blackUser) {
      const score = winner === 'white' ? 1 : winner === 'black' ? 0 : 0.5;
      const eloChanges = calculateElo(room.white.rating, room.black.rating, score);

      whiteChange = eloChanges.a.change;
      blackChange = eloChanges.b.change;

      // Update in-db users ratings & stats
      const cat = room.timeControlCategory;
      
      const whiteWins = winner === 'white' ? 1 : 0;
      const whiteLosses = winner === 'black' ? 1 : 0;
      const whiteDraws = winner === 'draw' ? 1 : 0;

      const blackWins = winner === 'black' ? 1 : 0;
      const blackLosses = winner === 'white' ? 1 : 0;
      const blackDraws = winner === 'draw' ? 1 : 0;

      await User.findByIdAndUpdate(room.white.userId, {
        $set: { [`rating.${cat}`]: eloChanges.a.newRating },
        $inc: { 'stats.wins': whiteWins, 'stats.losses': whiteLosses, 'stats.draws': whiteDraws },
      });

      await User.findByIdAndUpdate(room.black.userId, {
        $set: { [`rating.${cat}`]: eloChanges.b.newRating },
        $inc: { 'stats.wins': blackWins, 'stats.losses': blackLosses, 'stats.draws': blackDraws },
      });
    }

    // 2. Save Game to MongoDB
    const gameRecord = await Game.create({
      players: {
        white: {
          userId: new mongoose.Types.ObjectId(room.white.userId),
          username: room.white.username,
          rating: room.white.rating,
          ratingChange: whiteChange,
        },
        black: {
          userId: new mongoose.Types.ObjectId(room.black.userId),
          username: room.black.username,
          rating: room.black.rating,
          ratingChange: blackChange,
        },
      },
      pgn: room.chess.pgn(),
      fen: room.chess.fen(),
      result: winner,
      termination,
      timeControl: room.timeControl,
      timeControlCategory: room.timeControlCategory,
      variant: room.variant,
      checks: room.checks,
      status: 'completed',
      roomId: room.roomId,
      endedAt: new Date(),
    });

    // 3. Add game ID to user histories
    if (whiteUser && blackUser && gameRecord) {
      await User.findByIdAndUpdate(room.white.userId, { $push: { gameHistory: gameRecord._id } });
      await User.findByIdAndUpdate(room.black.userId, { $push: { gameHistory: gameRecord._id } });
    }

    // 4. Emit game over to the room
    io.to(`game:${room.roomId}`).emit('game_over', {
      winner,
      termination,
      whiteRatingChange: whiteChange,
      blackRatingChange: blackChange,
      newRatings: {
        white: (whiteUser?.rating?.[room.timeControlCategory] ?? 800) + whiteChange,
        black: (blackUser?.rating?.[room.timeControlCategory] ?? 800) + blackChange,
      }
    });

    console.log(`Game over in room ${room.roomId}. Result: ${winner} by ${termination}.`);
  } catch (err) {
    console.error('Error handling game over database saving:', err);
  } finally {
    // Delete room from memory after a brief delay
    setTimeout(() => {
      activeGames.delete(room.roomId);
    }, 120000);
  }
}

function generateChess960Fen(): string {
  const squares = Array(8).fill('');
  const blackBishops = [1, 3, 5, 7];
  const whiteBishops = [0, 2, 4, 6];
  const b1 = blackBishops[Math.floor(Math.random() * 4)];
  const b2 = whiteBishops[Math.floor(Math.random() * 4)];
  squares[b1] = 'B';
  squares[b2] = 'B';

  const getFree = () => squares.map((v, i) => v === '' ? i : -1).filter(i => i !== -1);

  let free = getFree();
  const q = free[Math.floor(Math.random() * free.length)];
  squares[q] = 'Q';

  free = getFree();
  const n1 = free[Math.floor(Math.random() * free.length)];
  squares[n1] = 'N';
  free = getFree();
  const n2 = free[Math.floor(Math.random() * free.length)];
  squares[n2] = 'N';

  free = getFree();
  squares[free[0]] = 'R';
  squares[free[1]] = 'K';
  squares[free[2]] = 'R';

  const backRankWhite = squares.join('');
  const backRankBlack = squares.join('').toLowerCase();

  const r1File = String.fromCharCode(97 + free[0]);
  const r2File = String.fromCharCode(97 + free[2]);
  const castlingRights = `${r2File.toUpperCase()}${r1File.toUpperCase()}${r2File}${r1File}`;

  return `${backRankBlack}/pppppppp/8/8/8/8/PPPPPPPP/${backRankWhite} w ${castlingRights} - 0 1`;
}

// ─── TICK: Matchmaking Loop ──────────────────────────────────────────────────
setInterval(async () => {
  if (matchmakingQueue.length < 2) return;

  const matchedIndices = new Set<number>();

  for (let i = 0; i < matchmakingQueue.length; i++) {
    if (matchedIndices.has(i)) continue;

    const p1 = matchmakingQueue[i];

    for (let j = i + 1; j < matchmakingQueue.length; j++) {
      if (matchedIndices.has(j)) continue;

      const p2 = matchmakingQueue[j];

      // Match conditions: same time control and variant
      if (p1.timeControl !== p2.timeControl) continue;
      if ((p1.variant || 'standard') !== (p2.variant || 'standard')) continue;
      // Exclude self-matches
      if (p1.userId === p2.userId) continue;

      // Rating gap calculation based on queue duration
      const p1Duration = (Date.now() - p1.joinedAt) / 1000;
      const p2Duration = (Date.now() - p2.joinedAt) / 1000;
      const maxDuration = Math.max(p1Duration, p2Duration);

      // Elo gap starting at 50, and expanding by 50 Elo per 2 seconds, up to 400 Elo max
      const maxEloGap = Math.min(400, 50 + Math.floor(maxDuration / 2) * 50);
      const eloDifference = Math.abs(p1.rating - p2.rating);

      if (eloDifference <= maxEloGap) {
        // MATCH MADE!
        matchedIndices.add(i);
        matchedIndices.add(j);

        const roomId = new mongoose.Types.ObjectId().toString();
        const rand = Math.random() < 0.5;

        // Assign colors randomly
        const white = rand ? p1 : p2;
        const black = rand ? p2 : p1;

        // Determine starting clocks time in seconds
        let seconds = 600; // default 10min
        const tc = p1.timeControl.toLowerCase();
        if (tc.includes('1 min')) seconds = 60;
        else if (tc.includes('1 | 1')) seconds = 60;
        else if (tc.includes('2 | 1')) seconds = 120;
        else if (tc.includes('3 min')) seconds = 180;
        else if (tc.includes('3 | 2')) seconds = 180;
        else if (tc.includes('5 min')) seconds = 300;
        else if (tc.includes('10 min')) seconds = 600;
        else if (tc.includes('15 | 10')) seconds = 900;
        else if (tc.includes('30 min')) seconds = 1800;

        const variant = p1.variant || 'standard';
        let startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        if (variant === 'chess960') {
          startingFen = generateChess960Fen();
        }

        const gameRoom: GameRoom = {
          roomId,
          white: { userId: white.userId, username: white.username, rating: white.rating, socketId: white.socketId },
          black: { userId: black.userId, username: black.username, rating: black.rating, socketId: black.socketId },
          chess: new Chess(startingFen),
          timeControl: p1.timeControl,
          timeControlCategory: p1.category,
          status: 'active',
          clocks: { white: seconds, black: seconds },
          lastMoveTime: Date.now(),
          activeTimer: null,
          drawOfferedBy: null,
          spectators: new Set(),
          disconnectTimers: {},
          variant,
          checks: { white: 0, black: 0 }
        };

        activeGames.set(roomId, gameRoom);

        // Notify both sockets of match found
        io.to(white.socketId).emit('match_found', {
          roomId,
          color: 'white',
          opponent: { username: black.username, rating: black.rating },
        });

        io.to(black.socketId).emit('match_found', {
          roomId,
          color: 'black',
          opponent: { username: white.username, rating: white.rating },
        });

        console.log(`Match paired: @${white.username} vs @${black.username} in room ${roomId}`);
        
        // Start game clock
        startRoomCountdown(roomId);
        break;
      }
    }
  }

  // Remove matched players from queue (in reverse order to avoid index shift)
  const indicesToRemove = Array.from(matchedIndices).sort((a, b) => b - a);
  for (const idx of indicesToRemove) {
    matchmakingQueue.splice(idx, 1);
  }
}, 2000);

// Helper to end a puzzle battle
async function endPuzzleBattle(battleId: string, reason: string) {
  const battle = activePuzzleBattles.get(battleId);
  if (!battle) return;

  if (battle.timer) {
    clearTimeout(battle.timer);
  }

  let winnerId = null;
  if (battle.p1.score > battle.p2.score) {
    winnerId = battle.p1.userId;
  } else if (battle.p2.score > battle.p1.score) {
    winnerId = battle.p2.userId;
  }

  io.to(`puzzle_battle:${battleId}`).emit('puzzle_battle_over', {
    winnerId,
    reason,
    scores: {
      [battle.p1.userId]: battle.p1.score,
      [battle.p2.userId]: battle.p2.score
    }
  });

  activePuzzleBattles.delete(battleId);
}

// ─── TICK: Puzzle Battle Matchmaking Loop ──────────────────────────────────────
setInterval(async () => {
  if (puzzleBattleQueue.length < 2) return;

  const p1 = puzzleBattleQueue.shift()!;
  const p2 = puzzleBattleQueue.shift()!;

  try {
    const pLimit = 15;
    const avgRating = Math.round((p1.rating + p2.rating) / 2);
    
    // Fetch puzzles
    let queryPuzzles = await Puzzle.find({
      rating: { $gte: avgRating - 350, $lte: avgRating + 350 }
    }).limit(pLimit);

    if (queryPuzzles.length < pLimit) {
      const remaining = pLimit - queryPuzzles.length;
      const fallback = await Puzzle.find({
        puzzleId: { $nin: queryPuzzles.map(q => q.puzzleId) }
      }).limit(remaining);
      queryPuzzles = [...queryPuzzles, ...fallback];
    }

    if (queryPuzzles.length === 0) {
      queryPuzzles = samplePuzzles;
    }

    const clientPuzzles = queryPuzzles.map((p, idx) => ({
      index: idx,
      puzzleId: p.puzzleId,
      fen: p.fen,
      rating: p.rating,
      themes: p.themes,
      blunder: p.moves[0],
      solutionLength: p.moves.length,
      moves: p.moves
    }));

    const battleId = new mongoose.Types.ObjectId().toString();
    const battleRoom: PuzzleBattleRoom = {
      battleId,
      p1: { userId: p1.userId, username: p1.username, socketId: p1.socketId, score: 0, strikes: 0, currentPuzzleIndex: 0, finished: false },
      p2: { userId: p2.userId, username: p2.username, socketId: p2.socketId, score: 0, strikes: 0, currentPuzzleIndex: 0, finished: false },
      puzzles: queryPuzzles,
      startTime: Date.now(),
      duration: 180,
      timer: null
    };

    battleRoom.timer = setTimeout(async () => {
      await endPuzzleBattle(battleId, "time_up");
    }, 180000);

    activePuzzleBattles.set(battleId, battleRoom);

    // Join sockets to battle room
    const s1 = io.sockets.sockets.get(p1.socketId);
    const s2 = io.sockets.sockets.get(p2.socketId);

    if (s1) s1.join(`puzzle_battle:${battleId}`);
    if (s2) s2.join(`puzzle_battle:${battleId}`);

    const startPayload = {
      battleId,
      duration: 180,
      puzzles: clientPuzzles,
      p1: { userId: p1.userId, username: p1.username, rating: p1.rating },
      p2: { userId: p2.userId, username: p2.username, rating: p2.rating }
    };

    io.to(`puzzle_battle:${battleId}`).emit('puzzle_battle_started', startPayload);
    console.log(`Puzzle Battle paired: @${p1.username} vs @${p2.username} in room ${battleId}`);

  } catch (err) {
    console.error('Error starting puzzle battle:', err);
    puzzleBattleQueue.push(p1, p2);
  }
}, 3000);

// Start server listening
server.listen(PORT, () => {
  console.log(`Socket.io Express server running on port ${PORT}`);
});
