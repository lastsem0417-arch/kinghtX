"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Chess } from "chess.js";
import axios from "axios";
import { ArrowLeft, Lightbulb, RotateCcw, Volume2, VolumeX, Flag, HelpCircle, Trophy, MessageSquare, RefreshCw, Star, Sparkles } from "lucide-react";
import BoardSection from "@/components/chess/BoardSection";
import PlayerCard from "@/components/chess/PlayerCard";
import LeftNavbar from "@/components/chess/LeftNavbar";
import { CHESS_BOTS, ChessBot } from "@/lib/bots";

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

function BotGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Search parameters
  const botId = searchParams.get("botId") || "bot_beg_1";
  const preferredColor = searchParams.get("color") || "white";
  const hintsAllowed = searchParams.get("hints") !== "false";

  // Selected Bot profile
  const bot = CHESS_BOTS.find((b) => b.id === botId) || CHESS_BOTS[0];

  // Game States
  const [game, setGame] = useState(new Chess());
  const [history, setHistory] = useState<string[]>([]);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [playerColor, setPlayerColor] = useState<"w" | "b">("w");
  const [gameStatus, setGameStatus] = useState<"idle" | "playing" | "won" | "lost" | "draw">("idle");
  const [starsAwarded, setStarsAwarded] = useState<number | null>(null);
  
  // User Profile from DB
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [savedGameId, setSavedGameId] = useState<string | null>(null);
  const [ratingDiff, setRatingDiff] = useState<number | null>(null);
  const [newRatingVal, setNewRatingVal] = useState<number | null>(null);

  // Highlighting & Markings
  const [moveSquares, setMoveSquares] = useState<any>({});
  const [lastMoveSquares, setLastMoveSquares] = useState<any>({});
  const [premoveSquares, setPremoveSquares] = useState<any>({});
  const [hintSquare, setHintSquare] = useState<string | null>(null);
  const [customArrows, setCustomArrows] = useState<[string, string, string?][]>([]);

  // Premove Queue
  const [premove, setPremove] = useState<{ from: string; to: string } | null>(null);

  // Stats & Features
  const [usedHint, setUsedHint] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [chatLog, setChatLog] = useState<{ sender: string; text: string; time: string }[]>([]);
  
  // Stockfish worker reference
  const workerRef = useRef<Worker | null>(null);

  // Audio references
  const moveSound = useRef<HTMLAudioElement | null>(null);
  const captureSound = useRef<HTMLAudioElement | null>(null);
  const checkSound = useRef<HTMLAudioElement | null>(null);
  const winSound = useRef<HTMLAudioElement | null>(null);
  const loseSound = useRef<HTMLAudioElement | null>(null);

  // Refs to avoid stale closures in worker callbacks
  const gameRef = useRef(game);
  const playerColorRef = useRef(playerColor);
  const gameStatusRef = useRef(gameStatus);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    playerColorRef.current = playerColor;
  }, [playerColor]);

  useEffect(() => {
    gameStatusRef.current = gameStatus;
  }, [gameStatus]);

  // Compute captured pieces stats for rendering
  const stats = getCapturedStats(game);

  // Initialize game parameters
  useEffect(() => {
    // Load sounds
    moveSound.current = new Audio("/sounds/move.mp3");
    captureSound.current = new Audio("/sounds/capture.mp3");
    checkSound.current = new Audio("/sounds/move-check.mp3");
    winSound.current = new Audio("/sounds/game-start.mp3");
    loseSound.current = new Audio("/sounds/game-end.mp3");

    // Fetch user details
    axios.get("/api/users/me").then((res) => {
      if (res.data?.user) {
        setCurrentUser(res.data.user);
      }
    }).catch((err) => {
      console.error("Failed to load user session info:", err);
    });

    // Assign playing color
    let assignedColor: "w" | "b" = "w";
    if (preferredColor === "black") {
      assignedColor = "b";
    } else if (preferredColor === "random") {
      assignedColor = Math.random() < 0.5 ? "w" : "b";
    }
    setPlayerColor(assignedColor);
    setBoardOrientation(assignedColor === "w" ? "white" : "black");

    // Setup game
    const newGame = new Chess();
    setGame(newGame);
    setGameStatus("playing");

    // Add greeting chat message
    const greeting = bot.greetings[Math.floor(Math.random() * bot.greetings.length)];
    addChatMessage(bot.name, greeting);
    speakVocal(greeting);

    // Initialize Stockfish WASM worker
    try {
      const worker = new Worker("/stockfish-worker.js");
      workerRef.current = worker;
      worker.postMessage("uci");
      worker.postMessage("isready");

      worker.onmessage = (e) => {
        const line = e.data;
        if (line.startsWith("bestmove")) {
          const parts = line.split(" ");
          const uciMove = parts[1];
          if (uciMove && uciMove !== "(none)") {
            handleBotUciMove(uciMove);
          }
        }
      };
    } catch (err) {
      console.error("Failed to load Stockfish worker:", err);
      addChatMessage("System", "Engine failed to initialize. Bot cannot make moves.");
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Make Bot moves when it is bot's turn
  useEffect(() => {
    if (gameStatus !== "playing") return;
    
    const isBotTurn = game.turn() !== playerColor;
    if (isBotTurn) {
      if (premove) {
        setTimeout(() => {
          executePremove();
        }, 150);
      } else {
        triggerBotCalculation();
      }
    }
  }, [game, playerColor, gameStatus]);

  // Voice synthesis speaker
  const speakVocal = (text: string) => {
    if (!voiceEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(
      (v) => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Google"))
    ) || voices.find((v) => v.lang.startsWith("en"));
    
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    window.speechSynthesis.speak(utterance);
  };

  const addChatMessage = (sender: string, text: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatLog((prev) => [...prev, { sender, text, time }]);
  };

  const triggerBotCalculation = () => {
    if (!workerRef.current) return;

    const isBlunder = Math.random() < bot.blunderRate;
    
    if (isBlunder && bot.category === "beginner") {
      const legalMoves = gameRef.current.moves({ verbose: true });
      if (legalMoves.length > 0) {
        const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        setTimeout(() => {
          applyMove({
            from: randomMove.from,
            to: randomMove.to,
            promotion: "q"
          }, true);
        }, 800);
        return;
      }
    }

    workerRef.current.postMessage("stop");
    workerRef.current.postMessage(`position fen ${gameRef.current.fen()}`);
    workerRef.current.postMessage(`go depth ${bot.depth}`);
  };

  const handleBotUciMove = (uciMove: string) => {
    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    const promotion = uciMove.length > 4 ? uciMove.charAt(4) : undefined;

    applyMove({ from, to, promotion: promotion || "q" }, true);
  };

  const saveGameToDatabase = async (finalGame: Chess, finalStatus: "won" | "lost" | "draw", finalTermination: "checkmate" | "resign" | "draw") => {
    try {
      const userColorStr = playerColorRef.current === "w" ? "white" : "black";
      const userRating = currentUser?.rating?.rapid || 1200;
      const userUsername = currentUser?.username || "You";

      const whitePlayer = userColorStr === "white" 
        ? { username: userUsername, rating: userRating }
        : { username: bot.name, rating: bot.rating };

      const blackPlayer = userColorStr === "black" 
        ? { username: userUsername, rating: userRating }
        : { username: bot.name, rating: bot.rating };

      let resultVal: "white" | "black" | "draw" = "draw";
      if (finalStatus === "won") {
        resultVal = userColorStr;
      } else if (finalStatus === "lost") {
        resultVal = userColorStr === "white" ? "black" : "white";
      }

      const res = await axios.post("/api/games/save", {
        white: whitePlayer,
        black: blackPlayer,
        pgn: finalGame.pgn(),
        fen: finalGame.fen(),
        result: resultVal,
        termination: finalTermination,
        timeControl: "Unlimited",
        timeControlCategory: "classical",
        userColor: userColorStr
      });

      if (res.data?.success) {
        setSavedGameId(res.data.gameId);
        setRatingDiff(res.data.ratingChange);
        setNewRatingVal(res.data.newRating);
      }
    } catch (err) {
      console.error("Failed to save local bot match:", err);
    }
  };

  const applyMove = (moveData: { from: string; to: string; promotion?: string }, isBot: boolean) => {
    const gameCopy = new Chess();
    try {
      gameCopy.loadPgn(gameRef.current.pgn());
      const moveResult = gameCopy.move(moveData);

      if (moveResult) {
        if (gameCopy.isCheck()) {
          checkSound.current?.play().catch(() => {});
        } else if (moveResult.captured) {
          captureSound.current?.play().catch(() => {});
        } else {
          moveSound.current?.play().catch(() => {});
        }

        setLastMoveSquares({
          [moveResult.from]: { backgroundColor: "rgba(255, 255, 0, 0.2)" },
          [moveResult.to]: { backgroundColor: "rgba(255, 255, 0, 0.2)" },
        });

        setMoveSquares({});
        setHintSquare(null);

        setGame(gameCopy);
        setHistory((prev) => [...prev, moveResult.san]);

        handleGameMoveDialogue(moveResult, isBot, gameCopy);

        if (gameCopy.isGameOver()) {
          handleGameOverState(gameCopy);
        }
        return true;
      }
    } catch (err) {
      console.warn("Invalid move attempted:", moveData);
    }
    return false;
  };

  const handleGameMoveDialogue = (move: any, isBot: boolean, gameCopy: Chess) => {
    if (gameCopy.isGameOver()) return;

    if (isBot) {
      if (move.captured && Math.random() < 0.3) {
        const comment = bot.onUserBlunder[Math.floor(Math.random() * bot.onUserBlunder.length)];
        addChatMessage(bot.name, comment);
        speakVocal(comment);
      }
    } else {
      if (move.captured && Math.random() < 0.2) {
        const comment = bot.onBotBlunder[Math.floor(Math.random() * bot.onBotBlunder.length)];
        addChatMessage(bot.name, comment);
        speakVocal(comment);
      }
    }
  };

  const handleGameOverState = async (endedGame: Chess) => {
    let resultStatus: "won" | "lost" | "draw" = "draw";
    let stars = 0;
    let term: "checkmate" | "draw" = "checkmate";

    if (endedGame.isCheckmate()) {
      const winnerColor = endedGame.turn() === "w" ? "b" : "w";
      if (winnerColor === playerColorRef.current) {
        resultStatus = "won";
        stars = usedHint ? 2 : 3;
        winSound.current?.play().catch(() => {});
        const winPhrase = bot.onLose[Math.floor(Math.random() * bot.onLose.length)];
        addChatMessage(bot.name, winPhrase);
        speakVocal(winPhrase);
      } else {
        resultStatus = "lost";
        stars = 0;
        loseSound.current?.play().catch(() => {});
        const losePhrase = bot.onWin[Math.floor(Math.random() * bot.onWin.length)];
        addChatMessage(bot.name, losePhrase);
        speakVocal(losePhrase);
      }
    } else if (endedGame.isDraw() || endedGame.isStalemate() || endedGame.isThreefoldRepetition()) {
      resultStatus = "draw";
      stars = 1;
      term = "draw";
      const drawPhrase = "A hard-fought draw. Good game!";
      addChatMessage(bot.name, drawPhrase);
      speakVocal(drawPhrase);
    }

    setGameStatus(resultStatus);
    setStarsAwarded(stars);

    try {
      await axios.post("/api/users/bot-progress", {
        botId: bot.id,
        stars
      });
    } catch (err) {
      console.error("Failed to save bot stars progress:", err);
    }

    await saveGameToDatabase(endedGame, resultStatus, term);
  };

  const handleResign = async () => {
    if (gameStatusRef.current !== "playing") return;
    
    const endedGame = new Chess();
    endedGame.loadPgn(gameRef.current.pgn());
    
    setGameStatus("lost");
    setStarsAwarded(0);
    loseSound.current?.play().catch(() => {});
    
    const resignPhrase = "You resign! Better luck next time.";
    addChatMessage(bot.name, resignPhrase);
    speakVocal(resignPhrase);

    try {
      await axios.post("/api/users/bot-progress", {
        botId: bot.id,
        stars: 0
      });
    } catch (err) {
      console.error("Failed to save resign progress:", err);
    }

    await saveGameToDatabase(endedGame, "lost", "resign");
  };

  const handleRematch = () => {
    const newGame = new Chess();
    setGame(newGame);
    setHistory([]);
    setGameStatus("playing");
    setStarsAwarded(null);
    setUsedHint(false);
    setPremove(null);
    setPremoveSquares({});
    setCustomArrows([]);
    setLastMoveSquares({});
    setMoveSquares({});
    setHintSquare(null);
    setSavedGameId(null);
    setRatingDiff(null);
    setNewRatingVal(null);

    const greeting = bot.greetings[Math.floor(Math.random() * bot.greetings.length)];
    addChatMessage(bot.name, greeting);
    speakVocal(greeting);
  };

  const executePremove = () => {
    if (!premove) return;
    
    const fromSquare = premove.from;
    const toSquare = premove.to;

    setPremove(null);
    setPremoveSquares({});
    setCustomArrows([]);

    const legalMoves = gameRef.current.moves({ verbose: true });
    const isLegal = legalMoves.some((m) => m.from === fromSquare && m.to === toSquare);

    if (isLegal) {
      applyMove({ from: fromSquare, to: toSquare, promotion: "q" }, false);
    }
  };

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (gameStatusRef.current !== "playing") return false;

    const isMyTurn = gameRef.current.turn() === playerColorRef.current;

    if (!isMyTurn) {
      const piece = gameRef.current.get(sourceSquare as any);
      if (piece && piece.color === playerColorRef.current) {
        setPremove({ from: sourceSquare, to: targetSquare });
        setPremoveSquares({
          [sourceSquare]: { backgroundColor: "rgba(239, 68, 68, 0.3)" },
          [targetSquare]: { backgroundColor: "rgba(239, 68, 68, 0.3)" },
        });
        setCustomArrows([[sourceSquare, targetSquare, "red"]]);
      }
      return false;
    }

    const success = applyMove({ from: sourceSquare, to: targetSquare, promotion: "q" }, false);
    return success;
  };

  const onSquareClick = (square: string) => {
    if (gameStatusRef.current !== "playing") return;

    if (premove) {
      setPremove(null);
      setPremoveSquares({});
      setCustomArrows([]);
      return;
    }

    const isMyTurn = gameRef.current.turn() === playerColorRef.current;
    if (!isMyTurn) return;

    const moves = gameRef.current.moves({
      square: square as any,
      verbose: true,
    });

    if (moves.length === 0) {
      setMoveSquares({});
      return;
    }

    const squares: any = {};
    squares[square] = {
      background: "rgba(0, 255, 100, 0.2)",
    };

    moves.forEach((m: any) => {
      squares[m.to] = {
        background: "radial-gradient(circle, rgba(0, 255, 100, 0.35) 22%, transparent 25%)",
        borderRadius: "50%",
      };
    });

    setMoveSquares(squares);
  };

  const handleGetHint = () => {
    if (gameStatusRef.current !== "playing" || !hintsAllowed) return;
    if (!workerRef.current) return;

    setUsedHint(true);
    workerRef.current.postMessage(`position fen ${gameRef.current.fen()}`);
    workerRef.current.postMessage("go movetime 300");

    const prevOnMessage = workerRef.current.onmessage;
    workerRef.current.onmessage = (e) => {
      const line = e.data;
      if (line.startsWith("bestmove")) {
        const parts = line.split(" ");
        const uciMove = parts[1];
        if (uciMove && uciMove !== "(none)") {
          const from = uciMove.substring(0, 2);
          setHintSquare(from);
          addChatMessage("Coach Help", `Hint: Focus on the piece on ${from.toUpperCase()}.`);
        }
        if (workerRef.current) {
          workerRef.current.onmessage = prevOnMessage;
        }
      }
    };
  };

  const getCustomSquareStyles = () => {
    const styles = { ...lastMoveSquares, ...moveSquares, ...premoveSquares };
    if (hintSquare) {
      styles[hintSquare] = {
        boxShadow: "inset 0 0 0 6px #eab308",
        backgroundColor: "rgba(234, 179, 8, 0.15)"
      };
    }
    return styles;
  };

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#161412] text-white flex flex-col md:flex-row relative">
      
      {/* ─── SIDE NAVIGATION BAR ─── */}
      <LeftNavbar activeUser={currentUser} />

      {/* ─── ARENA PANEL (Board + Cards) ─── */}
      <div className="flex-grow min-w-0 flex flex-col min-h-0 py-4 px-4 bg-[#161412] justify-between">
        
        {/* Header toolbar */}
        <div className="flex items-center justify-between shrink-0 mb-3 bg-[#111010]/60 border border-white/[0.04] px-4 py-2.5 rounded-2xl backdrop-blur-md">
          <button 
            onClick={() => router.push("/bots")} 
            className="
              flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-[#81b64c]/10 hover:border-[#81b64c]/30
              text-[#a0a09a] hover:text-[#81b64c] font-black text-xs transition-all duration-200 shadow-sm active:scale-[0.98]
            "
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Exit to Computer Bots</span>
          </button>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              title={voiceEnabled ? "Mute Voices" : "Unmute Voices"}
              className="text-[#7a7a6e] hover:text-white transition-all"
            >
              {voiceEnabled ? <Volume2 className="h-4.5 w-4.5 text-[#81b64c]" /> : <VolumeX className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>

        {/* Top Player Card (Bot) */}
        <div className="shrink-0 mb-1">
          <PlayerCard
            name={bot.name}
            rating={bot.rating}
            time="Computer"
            active={game.turn() !== playerColor && gameStatus === "playing"}
            side="top"
            avatar={bot.avatar}
            username="bots"
            capturedPieces={playerColor === "w" ? stats.capturedWhite : stats.capturedBlack}
            capturedColor={playerColor === "w" ? "w" : "b"}
            materialAdvantage={playerColor === "w" ? stats.blackAdvantage : stats.whiteAdvantage}
          />
        </div>

        {/* Board Section */}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden py-1">
          <BoardSection
            position={game.fen()}
            onDrop={onDrop}
            onSquareClick={onSquareClick}
            customSquareStyles={getCustomSquareStyles()}
            boardOrientation={boardOrientation}
            customArrows={customArrows}
          />
        </div>

        {/* Bottom Player Card (User) */}
        <div className="shrink-0 mt-1">
          <PlayerCard
            name={currentUser?.username || "You"}
            rating={currentUser?.rating?.rapid || 1200}
            time="Unlimited"
            active={game.turn() === playerColor && gameStatus === "playing"}
            side="bottom"
            username={currentUser?.username}
            capturedPieces={playerColor === "w" ? stats.capturedBlack : stats.capturedWhite}
            capturedColor={playerColor === "w" ? "b" : "w"}
            materialAdvantage={playerColor === "w" ? stats.whiteAdvantage : stats.blackAdvantage}
          />
        </div>

        {/* Arena Controls */}
        <div className="flex justify-center items-center gap-2 mt-4 shrink-0 bg-[#1a1917]/50 border border-white/[0.04] py-2 px-4 rounded-2xl max-w-md mx-auto w-full">
          {hintsAllowed && (
            <button
              onClick={handleGetHint}
              disabled={gameStatus !== "playing"}
              className="
                flex-1 py-2 rounded-xl bg-[#272522] border border-white/[0.08] hover:bg-yellow-500/10 hover:border-yellow-500/20 text-[#a0a09a] hover:text-yellow-400 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-30 disabled:hover:bg-[#272522]
              "
            >
              <Lightbulb className="h-4 w-4" /> Hint
            </button>
          )}

          <button
            onClick={handleResign}
            disabled={gameStatus !== "playing"}
            className="
              flex-1 py-2 rounded-xl bg-[#272522] border border-white/[0.08] hover:bg-red-500/10 hover:border-red-500/20 text-[#a0a09a] hover:text-red-400 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-30
            "
          >
            <Flag className="h-4 w-4" /> Resign
          </button>
        </div>

      </div>

      {/* ─── SIDEBAR PANEL (Move list & bot chat feedback) ─── */}
      <aside className="h-full flex flex-col overflow-hidden bg-[#1a1917] border-l border-white/[0.07]" style={{ width: "320px", minWidth: "320px", maxWidth: "320px" }}>
        
        {/* Game End Stars Alert */}
        {gameStatus !== "playing" && gameStatus !== "idle" && (
          <div className="shrink-0 p-5 bg-[#161412] border-b border-white/[0.06] text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-yellow-400">
              <Trophy className="h-5 w-5" />
              <span className="text-xs font-black uppercase tracking-wider">Match Concluded</span>
            </div>

            <div className="bg-[#111010] p-4 rounded-2xl border border-white/[0.04] space-y-3 flex flex-col items-center">
              <span className="text-sm font-black capitalize text-white block">
                {gameStatus === "won" ? "🏆 You Won!" : gameStatus === "lost" ? "❌ Bot Won!" : "🤝 Draw Match"}
              </span>

              {ratingDiff !== null && (
                <div className="text-xs font-mono font-bold text-center bg-[#161412] px-3 py-1.5 rounded-xl border border-white/[0.03]">
                  Rapid: <span className="text-white">{newRatingVal}</span>{" "}
                  <span className={ratingDiff >= 0 ? "text-green-400" : "text-red-400"}>
                    ({ratingDiff >= 0 ? `+${ratingDiff}` : ratingDiff})
                  </span>
                </div>
              )}

              {/* Star displays */}
              {starsAwarded !== null && (
                <div className="flex items-center gap-1">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <Star 
                      key={idx} 
                      className={`h-6 w-6 ${
                        idx < (starsAwarded || 0) 
                          ? "fill-yellow-400 text-yellow-400" 
                          : "text-white/[0.08]"
                      }`} 
                    />
                  ))}
                </div>
              )}

              <p className="text-[10px] text-[#7a7a6e] font-semibold text-center leading-snug">
                {gameStatus === "won"
                  ? usedHint 
                    ? "Well done! Won with hints. Earned 2 stars."
                    : "Fantastic! Flawless victory without hints. Earned 3 stars!"
                  : gameStatus === "draw"
                    ? "Draw match. Earned 1 star."
                    : "No stars awarded. Retry to beat this bot!"
                }
              </p>

              {savedGameId && (
                <button
                  onClick={() => router.push(`/game/review/${savedGameId}`)}
                  className="
                    w-full py-2.5 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white font-black text-xs transition-all flex items-center justify-center gap-1.5 mb-1
                  "
                >
                  <Sparkles className="h-3.5 w-3.5" /> ✨ Analyze Game
                </button>
              )}

              <button
                onClick={handleRematch}
                className="
                  w-full py-2.5 rounded-xl bg-[#81b64c] hover:bg-[#90c957] text-[#0f0e0c] font-black text-xs transition-all flex items-center justify-center gap-1.5
                "
              >
                <RotateCcw className="h-3.5 w-3.5" /> Play Rematch
              </button>
            </div>
          </div>
        )}

        {/* Interactive Chat Tab */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#1e1c1a]">
          <div className="shrink-0 p-4 border-b border-white/[0.06] bg-[#161412] flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#81b64c]" />
            <span className="text-xs font-black uppercase tracking-wider text-white">Bot Match Chat</span>
          </div>

          {/* Chat scrolling block */}
          <div className="flex-grow min-h-0 p-4 overflow-y-auto space-y-3.5 flex flex-col justify-end">
            <div className="space-y-3.5">
              {chatLog.map((chat, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex items-baseline justify-between">
                    <span className={`text-[10px] font-black tracking-wide ${chat.sender === bot.name ? "text-[#81b64c]" : chat.sender === "Coach Help" ? "text-yellow-400" : "text-white"}`}>
                      {chat.sender}
                    </span>
                    <span className="text-[8px] text-[#4a4a44] font-mono">{chat.time}</span>
                  </div>
                  <div className="bg-[#161412] border border-white/[0.03] p-3 rounded-2xl text-xs leading-relaxed text-[#a0a09a]">
                    {chat.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Move History summary table */}
          {history.length > 0 && (
            <div className="shrink-0 h-[150px] border-t border-white/[0.06] bg-[#161412] p-4 overflow-y-auto">
              <span className="text-[9px] text-[#7a7a6e] font-black uppercase tracking-wider block mb-2">Move History</span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-[#a0a09a] font-mono">
                {Array.from({ length: Math.ceil(history.length / 2) }).map((_, idx) => (
                  <div key={idx} className="flex justify-between border-b border-white/[0.02] pb-0.5">
                    <span className="text-[#4a4a44]">{idx + 1}.</span>
                    <span className="text-white font-extrabold">{history[idx * 2]}</span>
                    <span>{history[idx * 2 + 1] || "..."}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </aside>

    </main>
  );
}

export default function BotPlayArenaPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen bg-[#161412] text-white flex flex-col items-center justify-center gap-4">
        <RefreshCw className="h-8 w-8 text-[#81b64c] animate-spin" />
        <span className="text-xs text-[#7a7a6e] font-black tracking-wider uppercase animate-pulse">Loading Arena...</span>
      </div>
    }>
      <BotGameContent />
    </Suspense>
  );
}
