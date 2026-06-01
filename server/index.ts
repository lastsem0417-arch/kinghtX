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
  termination: { type: String, enum: ['checkmate', 'resign', 'timeout', 'draw', 'abandoned'] },
  timeControl: String,
  timeControlCategory: { type: String, enum: ['bullet', 'blitz', 'rapid', 'classical'] },
  opening: { type: String, default: '' },
  status: { type: String, enum: ['waiting', 'active', 'completed'], default: 'waiting' },
  roomId: { type: String, required: true, unique: true },
  endedAt: Date,
}, { timestamps: true });

const Game = mongoose.models.Game || mongoose.model('Game', GameSchema);

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
}

interface QueuePlayer {
  userId: string;
  username: string;
  rating: number;
  timeControl: string;
  category: 'bullet' | 'blitz' | 'rapid' | 'classical';
  socketId: string;
  joinedAt: number;
}

// ─── In-Memory Game State ────────────────────────────────────────────────────
const activeGames = new Map<string, GameRoom>();
const matchmakingQueue: QueuePlayer[] = [];
const onlineUsers = new Map<string, Set<string>>(); // userId -> Set of socketIds

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
  socket.on('join_queue', async (payload: { timeControl: string }) => {
    // Prevent duplicate entries in queue
    const isAlreadyQueued = matchmakingQueue.some(p => p.userId === user.userId);
    if (isAlreadyQueued) return;

    try {
      const category = getCategory(payload.timeControl);
      const userDoc = await User.findById(user.userId);
      const rating = userDoc?.rating?.[category] ?? 800;

      const player: QueuePlayer = {
        userId: user.userId,
        username: user.username,
        rating,
        timeControl: payload.timeControl,
        category,
        socketId: socket.id,
        joinedAt: Date.now(),
      };

      matchmakingQueue.push(player);
      socket.emit('queue_joined', { timeControl: payload.timeControl, rating });
      console.log(`Player @${user.username} joined matchmaking for ${payload.timeControl} (Rating: ${rating})`);
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

        // Broadcast move execution to all participants in the room
        io.to(`game:${roomId}`).emit('move_made', {
          move: moveResult,
          fen: room.chess.fen(),
          pgn: room.chess.pgn(),
          turn: room.chess.turn(),
          clocks: room.clocks,
        });

        // Restart timer countdown for the other player
        startRoomCountdown(roomId);

        // Check if game has ended by chess rules
        if (room.chess.isGameOver()) {
          let winner: 'white' | 'black' | 'draw' = 'draw';
          let termination: 'checkmate' | 'draw' = 'draw';

          if (room.chess.isCheckmate()) {
            winner = isWhiteTurn ? 'white' : 'black';
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
  termination: 'checkmate' | 'resign' | 'timeout' | 'draw' | 'abandoned'
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

      // Match conditions: same time control
      if (p1.timeControl !== p2.timeControl) continue;
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

        const gameRoom: GameRoom = {
          roomId,
          white: { userId: white.userId, username: white.username, rating: white.rating, socketId: white.socketId },
          black: { userId: black.userId, username: black.username, rating: black.rating, socketId: black.socketId },
          chess: new Chess(),
          timeControl: p1.timeControl,
          timeControlCategory: p1.category,
          status: 'active',
          clocks: { white: seconds, black: seconds },
          lastMoveTime: Date.now(),
          activeTimer: null,
          drawOfferedBy: null,
          spectators: new Set(),
          disconnectTimers: {},
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

// Start server listening
server.listen(PORT, () => {
  console.log(`Socket.io Express server running on port ${PORT}`);
});
