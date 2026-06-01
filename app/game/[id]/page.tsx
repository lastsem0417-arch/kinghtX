"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { useGameStore } from "@/store/useGameStore";
import PlayerCard from "@/components/chess/PlayerCard";
import BoardSection from "@/components/chess/BoardSection";
import MultiplayerSidebar from "@/components/chess/MultiplayerSidebar";
import LeftNavbar from "@/components/chess/LeftNavbar";
import { Chess } from "chess.js";
import { Sparkles } from "lucide-react";

// Helper to calculate captured pieces and material delta
function getCapturedStats(game: Chess) {
  const currentCounts = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };

  const board = game.board();
  for (const row of board) {
    for (const piece of row) {
      if (piece) {
        const color = piece.color as "w" | "b";
        const type = piece.type as keyof typeof currentCounts.w;
        currentCounts[color][type]++;
      }
    }
  }

  const starting = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  
  const capturedBlack: string[] = [];
  for (const key in starting) {
    const type = key as keyof typeof starting;
    const diff = starting[type] - currentCounts.b[type];
    for (let i = 0; i < diff; i++) {
      capturedBlack.push(type);
    }
  }

  const capturedWhite: string[] = [];
  for (const key in starting) {
    const type = key as keyof typeof starting;
    const diff = starting[type] - currentCounts.w[type];
    for (let i = 0; i < diff; i++) {
      capturedWhite.push(type);
    }
  }

  const values = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const whiteScore = Object.entries(currentCounts.w).reduce((acc, [type, count]) => acc + count * (values[type as keyof typeof values] || 0), 0);
  const blackScore = Object.entries(currentCounts.b).reduce((acc, [type, count]) => acc + count * (values[type as keyof typeof values] || 0), 0);

  const whiteAdvantage = whiteScore > blackScore ? whiteScore - blackScore : 0;
  const blackAdvantage = blackScore > whiteScore ? blackScore - whiteScore : 0;

  return {
    capturedWhite,
    capturedBlack,
    whiteAdvantage,
    blackAdvantage,
  };
}

export default function GameRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: roomIdParam } = use(params);
  const router = useRouter();

  const { user } = useUserStore();
  const {
    socket,
    connectSocket,
    joinGame,
    resetGameState,
    roomId,
    color,
    opponent,
    gameStatus,
    fen,
    pgn,
    turn,
    clocks,
    makeMove,
    gameOverResult,
  } = useGameStore();

  const [moveSquares, setMoveSquares] = useState<any>({});
  const [lastMoveSquares, setLastMoveSquares] = useState<any>({});
  const [premove, setPremove] = useState<{ from: string; to: string } | null>(null);
  const [premoveSquares, setPremoveSquares] = useState<any>({});
  const [customArrows, setCustomArrows] = useState<[string, string, string?][]>([]);

  // Sounds references
  const moveSound = useRef<HTMLAudioElement | null>(null);
  const captureSound = useRef<HTMLAudioElement | null>(null);
  const castleSound = useRef<HTMLAudioElement | null>(null);
  const checkSound = useRef<HTMLAudioElement | null>(null);
  const gameStartSound = useRef<HTMLAudioElement | null>(null);
  const gameEndSound = useRef<HTMLAudioElement | null>(null);

  // Initialize sounds on client
  useEffect(() => {
    moveSound.current = new Audio("/sounds/move.mp3");
    captureSound.current = new Audio("/sounds/capture.mp3");
    castleSound.current = new Audio("/sounds/castle.mp3");
    checkSound.current = new Audio("/sounds/move-check.mp3");
    gameStartSound.current = new Audio("/sounds/game-start.mp3");
    gameEndSound.current = new Audio("/sounds/game-end.mp3");
    
    // Play start sound when mounting
    gameStartSound.current?.play().catch(() => {});
  }, []);

  // Connect socket and join game room
  useEffect(() => {
    const init = async () => {
      await connectSocket();
      joinGame(roomIdParam);
    };
    init();

    return () => {
      resetGameState();
    };
  }, [roomIdParam, connectSocket, joinGame, resetGameState]);

  // Handle sounds and last move highlights on socket moves
  useEffect(() => {
    if (!socket) return;

    const handleMoveMade = (payload: any) => {
      const move = payload.move;
      
      if (payload.fen.includes("+")) {
        checkSound.current?.play().catch(() => {});
      } else if (move.captured) {
        captureSound.current?.play().catch(() => {});
      } else if (move.flags.includes("k") || move.flags.includes("q")) {
        castleSound.current?.play().catch(() => {});
      } else {
        moveSound.current?.play().catch(() => {});
      }

      setLastMoveSquares({
        [move.from]: { backgroundColor: "rgba(255, 255, 0, 0.25)" },
        [move.to]: { backgroundColor: "rgba(255, 255, 0, 0.25)" },
      });
      setMoveSquares({});
    };

    const handleGameOver = () => {
      gameEndSound.current?.play().catch(() => {});
    };

    socket.on("move_made", handleMoveMade);
    socket.on("game_over", handleGameOver);

    return () => {
      socket.off("move_made", handleMoveMade);
      socket.off("game_over", handleGameOver);
    };
  }, [socket]);

  // Helpers
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // Execute queued premove when it becomes our turn
  useEffect(() => {
    if (gameStatus !== "active" || !premove) return;

    const isMyTurn = (color === "white" && turn === "w") || (color === "black" && turn === "b");
    if (isMyTurn) {
      const clientChess = new Chess(fen);
      const legal = clientChess.moves({ verbose: true }).some(
        (m) => m.from === premove.from && m.to === premove.to
      );

      if (legal) {
        makeMove({
          from: premove.from,
          to: premove.to,
          promotion: "q",
        });
      }
      setPremove(null);
      setPremoveSquares({});
      setCustomArrows([]);
    }
  }, [fen, turn, color, gameStatus, premove, makeMove]);

  // Drag and Drop handler
  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (color === "spectator" || gameStatus !== "active") return false;

    const isMyTurn = (color === "white" && turn === "w") || (color === "black" && turn === "b");
    
    if (!isMyTurn) {
      try {
        const clientChess = new Chess(fen);
        const piece = clientChess.get(sourceSquare as any);
        const playerColorChar = color === "white" ? "w" : "b";
        if (piece && piece.color === playerColorChar) {
          setPremove({ from: sourceSquare, to: targetSquare });
          setPremoveSquares({
            [sourceSquare]: { backgroundColor: "rgba(239, 68, 68, 0.3)" },
            [targetSquare]: { backgroundColor: "rgba(239, 68, 68, 0.3)" },
          });
          setCustomArrows([[sourceSquare, targetSquare, "red"]]);
        }
      } catch (err) {
        console.error("Error setting premove:", err);
      }
      return false;
    }

    try {
      const clientChess = new Chess(fen);
      const moveResult = clientChess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (moveResult) {
        makeMove({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q",
        });
        return true;
      }
    } catch {
      return false;
    }
    return false;
  };

  const onSquareClick = (square: string) => {
    if (color === "spectator" || gameStatus !== "active") return;

    if (premove) {
      setPremove(null);
      setPremoveSquares({});
      setCustomArrows([]);
      return;
    }

    const isMyTurn = (color === "white" && turn === "w") || (color === "black" && turn === "b");
    if (!isMyTurn) {
      setMoveSquares({});
      return;
    }

    const clientChess = new Chess(fen);
    const moves = clientChess.moves({
      square: square as any,
      verbose: true,
    });

    if (moves.length === 0) {
      setMoveSquares({});
      return;
    }

    const squares: any = {};
    squares[square] = {
      background: "rgba(0, 255, 100, 0.25)",
    };

    moves.forEach((move: any) => {
      squares[move.to] = {
        background: "radial-gradient(circle, rgba(0, 255, 100, 0.35) 22%, transparent 25%)",
        borderRadius: "50%",
      };
    });

    setMoveSquares(squares);
  };

  // Game over variables
  const isWhite = color === "white";
  const isSpectator = color === "spectator";
  const myTurn = (color === "white" && turn === "w") || (color === "black" && turn === "b");
  
  const getRatingForCategory = () => {
    if (!user) return 800;
    const tc = (useGameStore.getState().timeControl || "10 min").toLowerCase();
    if (tc.includes("1 min") || tc.includes("1 | 1") || tc.includes("2 | 1")) {
      return user.rating.bullet;
    }
    if (tc.includes("3 min") || tc.includes("3 | 2") || tc.includes("5 min")) {
      return user.rating.blitz;
    }
    return user.rating.rapid;
  };

  const bottomName = isSpectator ? "White Player" : user?.username || "You";
  const bottomRating = isSpectator ? 800 : getRatingForCategory();
  const bottomTime = formatTime(isSpectator || isWhite ? clocks.white : clocks.black);
  const bottomActive = gameStatus === "active" && (isSpectator || isWhite ? turn === "w" : turn === "b");

  const topName = opponent?.username || (isSpectator ? "Black Player" : "Opponent");
  const topRating = opponent?.rating || 800;
  const topTime = formatTime(isSpectator || isWhite ? clocks.black : clocks.white);
  const topActive = gameStatus === "active" && (isSpectator || isWhite ? turn === "b" : turn === "w");

  const handleBackToLobby = () => {
    router.push("/play");
  };

  // Calculate captured pieces statistics from active FEN
  const activeChess = new Chess(fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const stats = getCapturedStats(activeChess);

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#161412] text-white flex flex-col md:flex-row relative">
      
      {/* ─── LEFT SIDEBAR NAVIGATION (Chess.com style) ─── */}
      <LeftNavbar activeUser={user} />

      {/* ─── CENTER ARENA (Timer + Board + Timer) ─── */}
      <div className="flex-grow min-w-0 flex flex-col min-h-0 overflow-hidden bg-[#161412] py-2">
        
        {/* Opponent Card (Top) */}
        <div className="shrink-0 px-4">
          <PlayerCard
            name={topName}
            rating={topRating}
            time={topTime}
            active={topActive}
            side="top"
            username={opponent ? opponent.username : undefined}
            capturedPieces={isWhite ? stats.capturedWhite : stats.capturedBlack}
            capturedColor={isWhite ? "w" : "b"}
            materialAdvantage={isWhite ? stats.blackAdvantage : stats.whiteAdvantage}
          />
        </div>

        {/* Board Section */}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden px-4 py-1.5">
          <BoardSection
            position={fen}
            onDrop={onDrop}
            onSquareClick={onSquareClick}
            customSquareStyles={{
              ...moveSquares,
              ...lastMoveSquares,
              ...premoveSquares,
            }}
            boardOrientation={isWhite || isSpectator ? "white" : "black"}
            customArrows={customArrows}
          />
        </div>

        {/* Self Card (Bottom) */}
        <div className="shrink-0 px-4">
          <PlayerCard
            name={bottomName}
            rating={bottomRating}
            time={bottomTime}
            active={bottomActive}
            side="bottom"
            username={isSpectator ? undefined : user?.username}
            capturedPieces={isWhite ? stats.capturedBlack : stats.capturedWhite}
            capturedColor={isWhite ? "b" : "w"}
            materialAdvantage={isWhite ? stats.whiteAdvantage : stats.blackAdvantage}
          />
        </div>

      </div>

      {/* ─── RIGHT INTERACTIVE SIDEBAR ─── */}
      <MultiplayerSidebar />

      {/* ─── GAME OVER MODAL OVERLAY ─── */}
      {gameOverResult && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#1a1917] border border-white/[0.1] rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">
            {/* Background design knight */}
            <div className="absolute -left-4 -bottom-6 text-[140px] text-white/[0.02] pointer-events-none select-none">
              ♞
            </div>

            <span className="text-5xl mb-4 block">🏆</span>
            
            <h2 className="text-2xl font-black tracking-tight text-white mb-1">
              {gameOverResult.winner === "draw"
                ? "Match Drawn"
                : (gameOverResult.winner === "white" && isWhite) || (gameOverResult.winner === "black" && !isWhite)
                ? "Victory!"
                : "Defeat"}
            </h2>
            <p className="text-xs text-[#7a7a6e] font-semibold uppercase tracking-wider mb-6">
              by {gameOverResult.termination}
            </p>

            {/* Elo rating summaries */}
            {!isSpectator && (
              <div className="bg-[#111010] border border-white/[0.04] rounded-2xl p-4 mb-6 space-y-3.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-white">{user?.username}</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-[#a0a09a]">{gameOverResult.newRatings[isWhite ? "white" : "black"] - (isWhite ? gameOverResult.whiteRatingChange : gameOverResult.blackRatingChange)}</span>
                    <span className="text-[#7a7a6e]">➔</span>
                    <span className="text-[#81b64c] font-bold">{gameOverResult.newRatings[isWhite ? "white" : "black"]}</span>
                    <span className={`text-xs font-bold ${isWhite ? (gameOverResult.whiteRatingChange >= 0 ? "text-green-400" : "text-red-400") : (gameOverResult.blackRatingChange >= 0 ? "text-green-400" : "text-red-400")}`}>
                      ({isWhite ? (gameOverResult.whiteRatingChange >= 0 ? `+${gameOverResult.whiteRatingChange}` : gameOverResult.whiteRatingChange) : (gameOverResult.blackRatingChange >= 0 ? `+${gameOverResult.blackRatingChange}` : gameOverResult.blackRatingChange)})
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-white">{opponent?.username}</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-[#a0a09a]">{gameOverResult.newRatings[isWhite ? "black" : "white"] - (isWhite ? gameOverResult.blackRatingChange : gameOverResult.whiteRatingChange)}</span>
                    <span className="text-[#7a7a6e]">➔</span>
                    <span className="text-[#81b64c] font-bold">{gameOverResult.newRatings[isWhite ? "black" : "white"]}</span>
                    <span className={`text-xs font-bold ${isWhite ? (gameOverResult.blackRatingChange >= 0 ? "text-green-400" : "text-red-400") : (gameOverResult.whiteRatingChange >= 0 ? "text-green-400" : "text-red-400")}`}>
                      ({isWhite ? (gameOverResult.blackRatingChange >= 0 ? `+${gameOverResult.blackRatingChange}` : gameOverResult.blackRatingChange) : (gameOverResult.whiteRatingChange >= 0 ? `+${gameOverResult.whiteRatingChange}` : gameOverResult.whiteRatingChange)})
                    </span>
                  </div>
                </div>
              </div>
            )}

            {isSpectator && opponent && (
              <div className="bg-[#111010] border border-white/[0.04] rounded-2xl p-4 mb-6 text-sm text-[#7a7a6e]">
                Spectating complete. Winner: <span className="text-white font-bold">{gameOverResult.winner === "draw" ? "None (Draw)" : gameOverResult.winner}</span>
              </div>
            )}

            <button
              onClick={() => router.push(`/game/review/${roomIdParam}`)}
              className="
                w-full py-3.5 rounded-xl
                bg-[#3b82f6] hover:bg-[#2563eb]
                text-white font-bold text-sm
                transition-all duration-200 shadow-md mb-2
                flex items-center justify-center gap-1.5
              "
            >
              ⏪ Analyze Game
            </button>

            <button
              onClick={handleBackToLobby}
              className="
                w-full py-3.5 rounded-xl
                bg-[#272522] border border-white/[0.08] hover:bg-white/[0.03]
                text-white font-bold text-sm
                transition-all duration-200 shadow-md
              "
            >
              Back to Lobby
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
