"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Chess } from "chess.js";
import Link from "next/link";
import axios from "axios";
import { ArrowLeft, Lightbulb, RotateCcw, Volume2, VolumeX, Flag, HelpCircle, Trophy, MessageSquare, Play, Sparkles, AlertTriangle, RefreshCw, GraduationCap } from "lucide-react";
import BoardSection from "@/components/chess/BoardSection";
import PlayerCard from "@/components/chess/PlayerCard";
import LeftNavbar from "@/components/chess/LeftNavbar";
import { CHESS_COACHES, ChessCoach } from "@/lib/coaches";

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

function CoachGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Search parameters
  const coachId = searchParams.get("coachId") || "coach_john";
  const preferredColor = searchParams.get("color") || "white";

  // Selected Coach profile
  const coach = CHESS_COACHES.find((c) => c.id === coachId) || CHESS_COACHES[0];

  // Game States
  const [game, setGame] = useState(new Chess());
  const [history, setHistory] = useState<string[]>([]);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [playerColor, setPlayerColor] = useState<"w" | "b">("w");
  const [gameStatus, setGameStatus] = useState<"idle" | "playing" | "won" | "lost" | "draw">("idle");
  const [isBlunderState, setIsBlunderState] = useState(false);
  const [lastMoveUci, setLastMoveUci] = useState<{ from: string; to: string } | null>(null);

  // User details
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [savedGameId, setSavedGameId] = useState<string | null>(null);
  const [isEvaluatingPlayerMove, setIsEvaluatingPlayerMove] = useState(false);
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

  // Engine Eval tracking
  const [evalBeforeMove, setEvalBeforeMove] = useState<number>(0.35); // Initial evaluation
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [chatLog, setChatLog] = useState<{ sender: string; text: string; time: string }[]>([]);

  // Stockfish worker references
  const workerRef = useRef<Worker | null>(null);
  const isAnalyzingRef = useRef(false);

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
  const evalBeforeMoveRef = useRef(evalBeforeMove);
  const isBlunderStateRef = useRef(isBlunderState);
  const lastMoveUciRef = useRef(lastMoveUci);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    playerColorRef.current = playerColor;
  }, [playerColor]);

  useEffect(() => {
    gameStatusRef.current = gameStatus;
  }, [gameStatus]);

  useEffect(() => {
    evalBeforeMoveRef.current = evalBeforeMove;
  }, [evalBeforeMove]);

  useEffect(() => {
    isBlunderStateRef.current = isBlunderState;
  }, [isBlunderState]);

  useEffect(() => {
    lastMoveUciRef.current = lastMoveUci;
  }, [lastMoveUci]);

  // Compute captured pieces stats
  const stats = getCapturedStats(game);

  // Initialize training session
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
      console.error("Failed to load user info:", err);
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

    // Greeting phrase
    const greeting = coach.greetings[Math.floor(Math.random() * coach.greetings.length)];
    addChatMessage(coach.name, greeting);
    speakVocal(greeting);

    // Initialize Stockfish worker
    try {
      const worker = new Worker("/stockfish-worker.js");
      workerRef.current = worker;
      worker.postMessage("uci");
      worker.postMessage("isready");

      worker.onmessage = (e) => {
        const line = e.data;

        // Parse search evaluations to capture best score
        if (line.startsWith("info") && line.includes("score")) {
          let parsedScore = 0;
          if (line.includes("score cp")) {
            const cpMatch = line.match(/score cp (-?\d+)/);
            if (cpMatch) {
              parsedScore = parseInt(cpMatch[1]) / 100;
            }
          } else if (line.includes("score mate")) {
            const mateMatch = line.match(/score mate (-?\d+)/);
            if (mateMatch) {
              parsedScore = parseInt(mateMatch[1]) > 0 ? 10.0 : -10.0;
            }
          }
          const turn = gameRef.current.turn();
          const scoreFromWhite = turn === "b" ? -parsedScore : parsedScore;
          setEvalBeforeMove(scoreFromWhite);
        }

        if (line.startsWith("bestmove")) {
          const parts = line.split(" ");
          const uciMove = parts[1];
          isAnalyzingRef.current = false;
          
          const isBotTurn = gameRef.current.turn() !== playerColorRef.current;
          if (isBotTurn && uciMove && uciMove !== "(none)" && !isBlunderStateRef.current) {
            handleBotUciMove(uciMove);
          }
        }
      };

      runEvaluation(newGame.fen());
    } catch (err) {
      console.error("Failed to load Stockfish worker:", err);
      addChatMessage("System", "Engine failed to initialize.");
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Opponent bot triggers moves when it is their turn and not paused on blunder
  useEffect(() => {
    if (gameStatus !== "playing" || isBlunderState || isEvaluatingPlayerMove) return;

    const isBotTurn = game.turn() !== playerColor;
    if (isBotTurn) {
      if (premove) {
        setTimeout(() => {
          executePremove();
        }, 150);
      } else {
        isAnalyzingRef.current = true;
        workerRef.current?.postMessage("stop");
        workerRef.current?.postMessage(`position fen ${game.fen()}`);
        workerRef.current?.postMessage("go depth 10");
      }
    } else {
      runEvaluation(game.fen());
    }
  }, [game, playerColor, gameStatus, isBlunderState, isEvaluatingPlayerMove]);

  const runEvaluation = (fenString: string) => {
    if (!workerRef.current) return;
    workerRef.current.postMessage("stop");
    workerRef.current.postMessage(`position fen ${fenString}`);
    workerRef.current.postMessage("go depth 8");
  };

  const speakVocal = (text: string) => {
    if (!voiceEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Google"))
    ) || voices.find((v) => v.lang.startsWith("en"));
    
    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }
    window.speechSynthesis.speak(utterance);
  };

  const addChatMessage = (sender: string, text: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatLog((prev) => [...prev, { sender, text, time }]);
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
        : { username: coach.name, rating: 1800 };

      const blackPlayer = userColorStr === "black" 
        ? { username: userUsername, rating: userRating }
        : { username: coach.name, rating: 1800 };

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
      console.error("Failed to save coach training session:", err);
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

        if (!isBot) {
          lastMoveUciRef.current = { from: moveResult.from, to: moveResult.to };
          setLastMoveUci({ from: moveResult.from, to: moveResult.to });
          setIsEvaluatingPlayerMove(true);
          evaluatePlayerMove(gameCopy, moveResult.san);
        } else {
          if (gameCopy.isGameOver()) {
            handleGameOverState(gameCopy);
          }
        }
        return true;
      }
    } catch (err) {
      console.warn("Invalid move attempted:", moveData);
    }
    return false;
  };

  const evaluatePlayerMove = (newGame: Chess, sanMove: string) => {
    if (!workerRef.current) {
      setIsEvaluatingPlayerMove(false);
      return;
    }

    workerRef.current.postMessage("stop");
    workerRef.current.postMessage(`position fen ${newGame.fen()}`);
    workerRef.current.postMessage("go depth 10");

    const prevOnMessage = workerRef.current.onmessage;
    workerRef.current.onmessage = (e) => {
      const line = e.data;
      if (line.startsWith("info") && line.includes("score")) {
        let parsedScore = 0;
        if (line.includes("score cp")) {
          const cpMatch = line.match(/score cp (-?\d+)/);
          if (cpMatch) parsedScore = parseInt(cpMatch[1]) / 100;
        } else if (line.includes("score mate")) {
          const mateMatch = line.match(/score mate (-?\d+)/);
          if (mateMatch) parsedScore = parseInt(mateMatch[1]) > 0 ? 10.0 : -10.0;
        }

        const turn = newGame.turn();
        const scoreFromWhite = turn === "b" ? -parsedScore : parsedScore;

        let evalDrop = 0;
        if (playerColorRef.current === "w") {
          evalDrop = evalBeforeMoveRef.current - scoreFromWhite;
        } else {
          evalDrop = scoreFromWhite - evalBeforeMoveRef.current;
        }

        if (evalDrop > 1.50) {
          setIsBlunderState(true);
          
          const coachComment = coach.blunderComments[Math.floor(Math.random() * coach.blunderComments.length)];
          addChatMessage(coach.name, coachComment);
          speakVocal(coachComment);

          setLastMoveSquares({
            [lastMoveUciRef.current?.from || ""]: { boxShadow: "inset 0 0 0 6px #ef4444", backgroundColor: "rgba(239, 68, 68, 0.15)" },
            [lastMoveUciRef.current?.to || ""]: { boxShadow: "inset 0 0 0 6px #ef4444", backgroundColor: "rgba(239, 68, 68, 0.15)" },
          });
        } else {
          if (Math.random() < 0.35) {
            const positiveComment = coach.goodMoveComments[Math.floor(Math.random() * coach.goodMoveComments.length)];
            addChatMessage(coach.name, positiveComment);
            speakVocal(positiveComment);
          }
        }

        setIsEvaluatingPlayerMove(false);

        if (newGame.isGameOver()) {
          handleGameOverState(newGame);
        }
      }

      if (line.startsWith("bestmove")) {
        if (workerRef.current) {
          workerRef.current.onmessage = prevOnMessage;
        }
      }
    };
  };

  const handleUndoMove = () => {
    if (history.length === 0) return;

    const newGame = new Chess();
    const movesToReplay = history.slice(0, -1);
    movesToReplay.forEach((m) => {
      try {
        newGame.move(m);
      } catch (e) {
        console.error("Error replaying move in coach handleUndo:", m, e);
      }
    });

    setGame(newGame);
    setHistory(movesToReplay);
    setIsBlunderState(false);
    setLastMoveSquares({});
    setMoveSquares({});
    setHintSquare(null);
    setPremove(null);
    setPremoveSquares({});
    setCustomArrows([]);

    addChatMessage(coach.name, "Let's try that again. Focus on finding a safer continuation.");
    speakVocal("Let's try that again.");
  };

  const handleProceedMove = () => {
    setIsBlunderState(false);
    addChatMessage("You", "Decided to proceed anyway.");
  };

  const handleGameOverState = async (endedGame: Chess) => {
    let resultStatus: "won" | "lost" | "draw" = "draw";
    let term: "checkmate" | "draw" = "checkmate";

    if (endedGame.isCheckmate()) {
      const winnerColor = endedGame.turn() === "w" ? "b" : "w";
      if (winnerColor === playerColorRef.current) {
        resultStatus = "won";
        winSound.current?.play().catch(() => {});
        const winPhrase = coach.winPhrases[Math.floor(Math.random() * coach.winPhrases.length)];
        addChatMessage(coach.name, winPhrase);
        speakVocal(winPhrase);
      } else {
        resultStatus = "lost";
        loseSound.current?.play().catch(() => {});
        const losePhrase = coach.losePhrases[Math.floor(Math.random() * coach.losePhrases.length)];
        addChatMessage(coach.name, losePhrase);
        speakVocal(losePhrase);
      }
    } else if (endedGame.isDraw() || endedGame.isStalemate() || endedGame.isThreefoldRepetition()) {
      resultStatus = "draw";
      term = "draw";
      const drawPhrase = "The match ended in a draw. Let's analyze details in the next session.";
      addChatMessage(coach.name, drawPhrase);
      speakVocal(drawPhrase);
    }

    setGameStatus(resultStatus);
    await saveGameToDatabase(endedGame, resultStatus, term);
  };

  const handleResign = async () => {
    if (gameStatusRef.current !== "playing") return;
    
    const endedGame = new Chess();
    endedGame.loadPgn(gameRef.current.pgn());

    setGameStatus("lost");
    loseSound.current?.play().catch(() => {});
    addChatMessage(coach.name, "You resign. Every match is a learning opportunity. Let's start fresh!");
    speakVocal("You resign. Let's start fresh!");

    await saveGameToDatabase(endedGame, "lost", "resign");
  };

  const handleRematch = () => {
    const newGame = new Chess();
    setGame(newGame);
    setHistory([]);
    setGameStatus("playing");
    setIsBlunderState(false);
    setPremove(null);
    setPremoveSquares({});
    setCustomArrows([]);
    setLastMoveSquares({});
    setMoveSquares({});
    setHintSquare(null);
    setSavedGameId(null);
    setRatingDiff(null);
    setNewRatingVal(null);

    const greeting = coach.greetings[Math.floor(Math.random() * coach.greetings.length)];
    addChatMessage(coach.name, greeting);
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
    if (gameStatusRef.current !== "playing" || isBlunderStateRef.current) return false;

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
    if (gameStatusRef.current !== "playing" || isBlunderStateRef.current) return;

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
    if (gameStatusRef.current !== "playing" || isBlunderStateRef.current) return;
    if (!workerRef.current) return;

    workerRef.current.postMessage("stop");
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
          addChatMessage("Coach Advice", `Focus on the piece on ${from.toUpperCase()}.`);
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
            onClick={() => router.push("/coaches")} 
            className="
              flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:bg-[#81b64c]/10 hover:border-[#81b64c]/30
              text-[#a0a09a] hover:text-[#81b64c] font-black text-xs transition-all duration-200 shadow-sm active:scale-[0.98]
            "
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Exit to Voice Coaches</span>
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

        {/* Top Player Card (Coach Opponent) */}
        <div className="shrink-0 mb-1">
          <PlayerCard
            name={coach.name}
            rating={1800}
            time="Tutor"
            active={game.turn() !== playerColor && gameStatus === "playing" && !isBlunderState}
            side="top"
            avatar={coach.avatar}
            username="coaches"
            capturedPieces={playerColor === "w" ? stats.capturedWhite : stats.capturedBlack}
            capturedColor={playerColor === "w" ? "w" : "b"}
            materialAdvantage={playerColor === "w" ? stats.blackAdvantage : stats.whiteAdvantage}
          />
        </div>

        {/* Board Section */}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden py-1 relative">
          <BoardSection
            position={game.fen()}
            onDrop={onDrop}
            onSquareClick={onSquareClick}
            customSquareStyles={getCustomSquareStyles()}
            boardOrientation={boardOrientation}
            customArrows={customArrows}
          />

          {/* Coach Blunder Alert Banner */}
          {isBlunderState && (
            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 bg-[#1a1917]/95 border-2 border-red-500/50 rounded-3xl p-6 shadow-2xl backdrop-blur-md z-30 flex flex-col items-center text-center space-y-4 max-w-sm mx-auto">
              <AlertTriangle className="h-10 w-10 text-red-500 animate-bounce" />
              <div>
                <h4 className="text-base font-black text-white">Wait, that's a blunder!</h4>
                <p className="text-xs text-[#a0a09a] mt-1">
                  Coach {coach.name} noticed that your move gave away a significant tactical or structural advantage.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={handleUndoMove}
                  className="
                    py-3 rounded-xl bg-green-500 hover:bg-green-600 text-black font-black text-xs transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)]
                  "
                >
                  <RotateCcw className="h-3.5 w-3.5 inline mr-1" /> Undo Move
                </button>
                <button
                  onClick={handleProceedMove}
                  className="
                    py-3 rounded-xl bg-[#272522] border border-white/[0.08] hover:bg-white/[0.03] text-[#a0a09a] hover:text-white font-extrabold text-xs transition-all
                  "
                >
                  Proceed
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Player Card (User) */}
        <div className="shrink-0 mt-1">
          <PlayerCard
            name={currentUser?.username || "You"}
            rating={currentUser?.rating?.rapid || 1200}
            time="Training"
            active={game.turn() === playerColor && gameStatus === "playing" && !isBlunderState}
            side="bottom"
            username={currentUser?.username}
            capturedPieces={playerColor === "w" ? stats.capturedBlack : stats.capturedWhite}
            capturedColor={playerColor === "w" ? "b" : "w"}
            materialAdvantage={playerColor === "w" ? stats.whiteAdvantage : stats.blackAdvantage}
          />
        </div>

        {/* Arena Controls */}
        <div className="flex justify-center items-center gap-2 mt-4 shrink-0 bg-[#1a1917]/50 border border-white/[0.04] py-2 px-4 rounded-2xl max-w-md mx-auto w-full">
          <button
            onClick={handleGetHint}
            disabled={gameStatus !== "playing" || isBlunderState}
            className="
              flex-1 py-2 rounded-xl bg-[#272522] border border-white/[0.08] hover:bg-yellow-500/10 hover:border-yellow-500/20 text-[#a0a09a] hover:text-yellow-400 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-30 disabled:hover:bg-[#272522]
            "
          >
            <Lightbulb className="h-4 w-4" /> Hint
          </button>

          <button
            onClick={handleResign}
            disabled={gameStatus !== "playing" || isBlunderState}
            className="
              flex-1 py-2 rounded-xl bg-[#272522] border border-white/[0.08] hover:bg-red-500/10 hover:border-red-500/20 text-[#a0a09a] hover:text-red-400 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-30
            "
          >
            <Flag className="h-4 w-4" /> Resign
          </button>
        </div>

      </div>

      {/* ─── SIDEBAR PANEL (Move list & coach chat feed) ─── */}
      <aside className="h-full flex flex-col overflow-hidden bg-[#1a1917] border-l border-white/[0.07]" style={{ width: "320px", minWidth: "320px", maxWidth: "320px" }}>
        
        {/* Game End Alert */}
        {gameStatus !== "playing" && gameStatus !== "idle" && (
          <div className="shrink-0 p-5 bg-[#161412] border-b border-white/[0.06] text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-yellow-400">
              <Trophy className="h-5 w-5" />
              <span className="text-xs font-black uppercase tracking-wider">Session Concluded</span>
            </div>

            <div className="bg-[#111010] p-4 rounded-2xl border border-white/[0.04] space-y-3 flex flex-col items-center">
              <span className="text-sm font-black capitalize text-white block">
                {gameStatus === "won" ? "🏆 You Won!" : "❌ Coach Won!"}
              </span>

              {ratingDiff !== null && (
                <div className="text-xs font-mono font-bold text-center bg-[#161412] px-3 py-1.5 rounded-xl border border-white/[0.03]">
                  Rapid: <span className="text-white">{newRatingVal}</span>{" "}
                  <span className={ratingDiff >= 0 ? "text-green-400" : "text-red-400"}>
                    ({ratingDiff >= 0 ? `+${ratingDiff}` : ratingDiff})
                  </span>
                </div>
              )}

              <p className="text-[10px] text-[#7a7a6e] font-semibold text-center leading-snug">
                Every training match helps build stronger tactical muscles. Play another match to test new ideas!
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

        {/* Coach Chat Panel */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#1e1c1a]">
          <div className="shrink-0 p-4 border-b border-white/[0.06] bg-[#161412] flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-[#81b64c]" />
            <span className="text-xs font-black uppercase tracking-wider text-white">Coach Feedback Feed</span>
          </div>

          {/* Chat log messages */}
          <div className="flex-grow min-h-0 p-4 overflow-y-auto space-y-3.5 flex flex-col justify-end">
            <div className="space-y-3.5">
              {chatLog.map((chat, idx) => (
                <div key={idx} className="space-y-0.5 animate-fadeIn">
                  <div className="flex items-baseline justify-between">
                    <span className={`text-[10px] font-black tracking-wide ${chat.sender === coach.name ? "text-[#81b64c]" : chat.sender === "Coach Advice" ? "text-yellow-400" : "text-white"}`}>
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

export default function CoachPlayArenaPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen bg-[#161412] text-white flex flex-col items-center justify-center gap-4">
        <RefreshCw className="h-8 w-8 text-[#81b64c] animate-spin" />
        <span className="text-xs text-[#7a7a6e] font-black tracking-wider uppercase animate-pulse">Loading Arena...</span>
      </div>
    }>
      <CoachGameContent />
    </Suspense>
  );
}
