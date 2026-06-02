import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';

interface Opponent {
  username: string;
  rating: number;
}

interface Clocks {
  white: number;
  black: number;
}

interface ChatMessage {
  sender: string;
  text: string;
  timestamp: number;
}

interface GameOverResult {
  winner: 'white' | 'black' | 'draw';
  termination: 'checkmate' | 'resign' | 'timeout' | 'draw' | 'abandoned';
  whiteRatingChange: number;
  blackRatingChange: number;
  newRatings: {
    white: number;
    black: number;
  };
}

interface GameState {
  // Socket Connection
  socket: Socket | null;
  isConnected: boolean;
  
  // Matchmaking Queue
  matchmakingStatus: 'idle' | 'searching' | 'matched';
  timeControl: string | null;
  queueDuration: number;
  
  // Game Arena State
  roomId: string | null;
  color: 'white' | 'black' | 'spectator' | null;
  opponent: Opponent | null;
  gameStatus: 'active' | 'completed' | null;
  fen: string;
  pgn: string;
  turn: 'w' | 'b';
  clocks: Clocks;
  spectatorCount: number;
  chatMessages: ChatMessage[];
  drawOffered: boolean; // Draw offered by opponent to us
  isOpponentDisconnected: boolean;
  gameOverResult: GameOverResult | null;
  variant: 'standard' | '3check' | 'chess960' | null;
  checks: {
    white: number;
    black: number;
  };

  // Actions
  connectSocket: () => Promise<void>;
  disconnectSocket: () => void;
  joinQueue: (timeControl: string, variant?: 'standard' | '3check' | 'chess960') => void;
  leaveQueue: () => void;
  joinGame: (roomId: string) => void;
  makeMove: (move: any) => void;
  resign: () => void;
  offerDraw: () => void;
  acceptDraw: () => void;
  declineDraw: () => void;
  sendChatMessage: (text: string) => void;
  resetGameState: () => void;
  incrementQueueDuration: () => void;
}

export const useGameStore = create<GameState>((set, get) => {
  let queueInterval: NodeJS.Timeout | null = null;

  return {
    socket: null,
    isConnected: false,
    
    matchmakingStatus: 'idle',
    timeControl: null,
    queueDuration: 0,
    
    roomId: null,
    color: null,
    opponent: null,
    gameStatus: null,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    pgn: '',
    turn: 'w',
    clocks: { white: 600, black: 600 },
    spectatorCount: 0,
    chatMessages: [],
    drawOffered: false,
    isOpponentDisconnected: false,
    gameOverResult: null,
    variant: 'standard',
    checks: { white: 0, black: 0 },

    connectSocket: async () => {
      // Avoid duplicate socket connection
      if (get().socket?.connected) return;

      try {
        // Fetch session token
        const response = await axios.get('/api/auth/socket-token');
        const token = response.data.token;

        if (!token) {
          console.error('No auth token found, cannot connect to Socket.io');
          return;
        }

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
        const socket = io(socketUrl, {
          auth: { token },
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: 5,
        });

        socket.on('connect', () => {
          set({ isConnected: true });
          console.log('Connected to KnightX socket server');
        });

        socket.on('disconnect', () => {
          set({ isConnected: false });
          console.log('Disconnected from KnightX socket server');
        });

        // ─── Matchmaking Listeners ───
        socket.on('queue_joined', (payload: { timeControl: string }) => {
          set({ matchmakingStatus: 'searching', timeControl: payload.timeControl, queueDuration: 0 });
          
          if (queueInterval) clearInterval(queueInterval);
          queueInterval = setInterval(() => {
            get().incrementQueueDuration();
          }, 1000);
        });

        socket.on('queue_left', () => {
          if (queueInterval) {
            clearInterval(queueInterval);
            queueInterval = null;
          }
          set({ matchmakingStatus: 'idle', timeControl: null, queueDuration: 0 });
        });

        socket.on('match_found', (payload: { roomId: string; color: 'white' | 'black'; opponent: Opponent }) => {
          if (queueInterval) {
            clearInterval(queueInterval);
            queueInterval = null;
          }
          set({
            matchmakingStatus: 'matched',
            roomId: payload.roomId,
            color: payload.color,
            opponent: payload.opponent,
            gameStatus: 'active',
          });
        });

        // ─── Game Play Arena Listeners ───
        socket.on('game_state', (payload: any) => {
          set({
            roomId: payload.roomId,
            fen: payload.fen,
            pgn: payload.pgn,
            turn: payload.turn,
            clocks: payload.clocks,
            color: payload.yourColor,
            opponent: payload.yourColor === 'white' 
              ? { username: payload.black.username, rating: payload.black.rating }
              : { username: payload.white.username, rating: payload.white.rating },
            gameStatus: payload.status,
            gameOverResult: null,
            variant: payload.variant || 'standard',
            checks: payload.checks || { white: 0, black: 0 },
          });
        });

        socket.on('move_made', (payload: { move: any; fen: string; pgn: string; turn: 'w' | 'b'; clocks: Clocks; checks?: { white: number; black: number } }) => {
          set({
            fen: payload.fen,
            pgn: payload.pgn,
            turn: payload.turn,
            clocks: payload.clocks,
            drawOffered: false, // Reset draw offers on move
            checks: payload.checks || get().checks,
          });
        });

        socket.on('clock_sync', (payload: { clocks: Clocks }) => {
          set({ clocks: payload.clocks });
        });

        socket.on('draw_offered', () => {
          set({ drawOffered: true });
        });

        socket.on('draw_declined', () => {
          set({ drawOffered: false });
          // Optionally trigger a toast notifications locally
        });

        socket.on('player_disconnected', (payload: { username: string; side: 'white' | 'black' }) => {
          set({ isOpponentDisconnected: true });
        });

        socket.on('player_reconnected', (payload: { username: string; side: 'white' | 'black' }) => {
          set({ isOpponentDisconnected: false });
        });

        socket.on('game_over', (payload: GameOverResult) => {
          set({
            gameStatus: 'completed',
            gameOverResult: payload,
            drawOffered: false,
          });
        });

        socket.on('chat_received', (message: ChatMessage) => {
          set((state) => ({
            chatMessages: [...state.chatMessages, message],
          }));
        });

        socket.on('spectator_count', (payload: { count: number }) => {
          set({ spectatorCount: payload.count });
        });

        set({ socket });
      } catch (err) {
        console.error('Failed to connect to Socket.io server:', err);
      }
    },

    disconnectSocket: () => {
      const { socket } = get();
      if (socket) {
        socket.disconnect();
      }
      if (queueInterval) {
        clearInterval(queueInterval);
        queueInterval = null;
      }
      set({
        socket: null,
        isConnected: false,
        matchmakingStatus: 'idle',
        roomId: null,
        color: null,
        opponent: null,
        gameStatus: null,
        chatMessages: [],
        gameOverResult: null,
      });
    },

    joinQueue: (timeControl: string, variant?: 'standard' | '3check' | 'chess960') => {
      const { socket } = get();
      if (socket) {
        socket.emit('join_queue', { timeControl, variant: variant || 'standard' });
      }
    },

    leaveQueue: () => {
      const { socket } = get();
      if (socket) {
        socket.emit('leave_queue');
      }
    },

    joinGame: (roomId: string) => {
      const { socket } = get();
      if (socket) {
        socket.emit('join_game', { roomId });
      }
    },

    makeMove: (move: any) => {
      const { socket, roomId } = get();
      if (socket && roomId) {
        socket.emit('make_move', { roomId, move });
      }
    },

    resign: () => {
      const { socket, roomId } = get();
      if (socket && roomId) {
        socket.emit('resign', { roomId });
      }
    },

    offerDraw: () => {
      const { socket, roomId } = get();
      if (socket && roomId) {
        socket.emit('offer_draw', { roomId });
      }
    },

    acceptDraw: () => {
      const { socket, roomId } = get();
      if (socket && roomId) {
        socket.emit('accept_draw', { roomId });
      }
    },

    declineDraw: () => {
      const { socket, roomId } = get();
      if (socket && roomId) {
        socket.emit('decline_draw', { roomId });
      }
    },

    sendChatMessage: (text: string) => {
      const { socket, roomId } = get();
      if (socket && roomId && text.trim()) {
        socket.emit('chat_message', { roomId, text });
      }
    },

    resetGameState: () => {
      set({
        roomId: null,
        color: null,
        opponent: null,
        gameStatus: null,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        pgn: '',
        turn: 'w',
        clocks: { white: 600, black: 600 },
        spectatorCount: 0,
        chatMessages: [],
        drawOffered: false,
        isOpponentDisconnected: false,
        gameOverResult: null,
        variant: 'standard',
        checks: { white: 0, black: 0 },
      });
    },

    incrementQueueDuration: () => {
      set((state) => ({ queueDuration: state.queueDuration + 1 }));
    },
  };
});
