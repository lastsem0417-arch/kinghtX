"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import BoardSection from "@/components/chess/BoardSection";
import axios from "axios";
import { 
  Trophy, 
  Lightbulb, 
  RotateCcw, 
  ChevronRight, 
  Flame, 
  ArrowLeft,
  CheckCircle,
  XCircle,
  HelpCircle
} from "lucide-react";
import LeftNavbar from "@/components/chess/LeftNavbar";

interface PuzzleData {
  puzzleId: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
}

export default function PuzzlesPage() {
  const router = useRouter();

  // Puzzle State
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
  const [userRating, setUserRating] = useState(800);
  const [streak, setStreak] = useState(0);
  const [puzzleStatus, setPuzzleStatus] = useState<"idle" | "playing" | "success" | "failed">("idle");
  const [ratingChange, setRatingChange] = useState<number | null>(null);
  
  // Chess logic
  const [game, setGame] = useState(new Chess());
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [moveSquares, setMoveSquares] = useState<any>({});
  const [lastMoveSquares, setLastMoveSquares] = useState<any>({});
  const [hintSquare, setHintSquare] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Track puzzle progress
  // moves[0] is opponent blunder, moves[1] is user refutation, moves[2] is opponent reply...
  const movesIndexRef = useRef(1);
  const movesRef = useRef<string[]>([]);

  // Sounds
  const moveSound = useRef<HTMLAudioElement | null>(null);
  const captureSound = useRef<HTMLAudioElement | null>(null);
  const checkSound = useRef<HTMLAudioElement | null>(null);
  const winSound = useRef<HTMLAudioElement | null>(null);
  const loseSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    moveSound.current = new Audio("/sounds/move.mp3");
    captureSound.current = new Audio("/sounds/capture.mp3");
    checkSound.current = new Audio("/sounds/move-check.mp3");
    winSound.current = new Audio("/sounds/game-start.mp3");
    loseSound.current = new Audio("/sounds/game-end.mp3");
    
    fetchPuzzle();

    axios.get("/api/users/me").then((res) => {
      if (res.data?.user) {
        setCurrentUser(res.data.user);
      }
    }).catch((err) => console.error("Failed to load user in puzzles:", err));
  }, []);

  const fetchPuzzle = async () => {
    try {
      setPuzzleStatus("idle");
      setRatingChange(null);
      setHintSquare(null);
      setLastMoveSquares({});
      setMoveSquares({});

      const res = await axios.get("/api/puzzles/random");
      const data = res.data.puzzle as PuzzleData;
      setUserRating(res.data.userRating);

      if (!data) return;

      setPuzzle(data);
      movesRef.current = data.moves;
      movesIndexRef.current = 1;

      // 1. Initialise Chess
      const tempChess = new Chess(data.fen);
      
      // 2. Play first move (opponent blunder)
      const blunder = data.moves[0];
      const from = blunder.substring(0, 2);
      const to = blunder.substring(2, 4);
      const promo = blunder.length > 4 ? blunder.charAt(4) : undefined;
      
      const moveResult = tempChess.move({ from, to, promotion: promo });
      
      if (moveResult) {
        if (moveResult.captured) captureSound.current?.play().catch(() => {});
        else moveSound.current?.play().catch(() => {});
      }

      setGame(tempChess);
      setPuzzleStatus("playing");

      // 3. Set orientation to who is to play next (the user)
      setBoardOrientation(tempChess.turn() === "w" ? "white" : "black");
      
      // Highlight the blunder move squares
      setLastMoveSquares({
        [from]: { backgroundColor: "rgba(255, 255, 0, 0.2)" },
        [to]: { backgroundColor: "rgba(255, 255, 0, 0.2)" },
      });

    } catch (err) {
      console.error("Error loading puzzle:", err);
    }
  };

  // Process User Move Drop
  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (puzzleStatus !== "playing" || !puzzle) return false;

    const expectedMove = movesRef.current[movesIndexRef.current]; // e.g. "e2e4"
    const playedMove = sourceSquare + targetSquare;

    // Check if played move matches the expected solution move
    if (playedMove !== expectedMove && playedMove !== expectedMove + "q") {
      // WRONG MOVE!
      handlePuzzleFailed();
      return false;
    }

    try {
      const tempChess = new Chess(game.fen());
      const moveResult = tempChess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (moveResult) {
        // Correct Move! Play sound
        if (tempChess.isCheck()) checkSound.current?.play().catch(() => {});
        else if (moveResult.captured) captureSound.current?.play().catch(() => {});
        else moveSound.current?.play().catch(() => {});

        // Set last move squares
        setLastMoveSquares({
          [sourceSquare]: { backgroundColor: "rgba(34, 197, 94, 0.25)" },
          [targetSquare]: { backgroundColor: "rgba(34, 197, 94, 0.25)" },
        });
        setHintSquare(null);
        setMoveSquares({});

        // Increment moves index
        movesIndexRef.current += 1;
        setGame(tempChess);

        // Check if puzzle is fully solved
        if (movesIndexRef.current >= movesRef.current.length) {
          handlePuzzleSuccess();
        } else {
          // Play opponent response after a brief delay
          setTimeout(() => {
            const nextOpponentMove = movesRef.current[movesIndexRef.current];
            const opFrom = nextOpponentMove.substring(0, 2);
            const opTo = nextOpponentMove.substring(2, 4);
            const opPromo = nextOpponentMove.length > 4 ? nextOpponentMove.charAt(4) : undefined;
            
            const opChess = new Chess(tempChess.fen());
            const opResult = opChess.move({ from: opFrom, to: opTo, promotion: opPromo });

            if (opResult) {
              if (opChess.isCheck()) checkSound.current?.play().catch(() => {});
              else if (opResult.captured) captureSound.current?.play().catch(() => {});
              else moveSound.current?.play().catch(() => {});
            }

            setLastMoveSquares({
              [opFrom]: { backgroundColor: "rgba(255, 255, 0, 0.2)" },
              [opTo]: { backgroundColor: "rgba(255, 255, 0, 0.2)" },
            });
            movesIndexRef.current += 1;
            setGame(opChess);
          }, 600);
        }
        return true;
      }
    } catch {
      return false;
    }
    return false;
  };

  const handlePuzzleSuccess = async () => {
    setPuzzleStatus("success");
    winSound.current?.play().catch(() => {});
    setStreak(prev => prev + 1);

    try {
      const res = await axios.post("/api/puzzles/submit", {
        puzzleId: puzzle?.puzzleId,
        success: true,
      });
      setUserRating(res.data.newRating);
      setRatingChange(res.data.ratingChange);
    } catch (err) {
      console.error("Error submitting success:", err);
    }
  };

  const handlePuzzleFailed = async () => {
    setPuzzleStatus("failed");
    loseSound.current?.play().catch(() => {});
    setStreak(0);

    try {
      const res = await axios.post("/api/puzzles/submit", {
        puzzleId: puzzle?.puzzleId,
        success: false,
      });
      setUserRating(res.data.newRating);
      setRatingChange(res.data.ratingChange);
    } catch (err) {
      console.error("Error submitting failure:", err);
    }
  };

  // Hint Button (highlights the correct starting square)
  const handleShowHint = () => {
    if (puzzleStatus !== "playing" || !puzzle) return;
    const nextMove = movesRef.current[movesIndexRef.current];
    if (nextMove && nextMove.length >= 2) {
      const fromSquare = nextMove.substring(0, 2);
      setHintSquare(fromSquare);
    }
  };

  // Get dots on click locally
  const onSquareClick = (square: string) => {
    if (puzzleStatus !== "playing") return;

    const moves = game.moves({
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

    moves.forEach((move: any) => {
      squares[move.to] = {
        background: "radial-gradient(circle, rgba(0, 255, 100, 0.35) 22%, transparent 25%)",
        borderRadius: "50%",
      };
    });

    setMoveSquares(squares);
  };

  // Custom square styles combining blunder highlights and hint highlights
  const getCustomSquareStyles = () => {
    const styles = { ...lastMoveSquares, ...moveSquares };
    if (hintSquare) {
      styles[hintSquare] = {
        boxShadow: "inset 0 0 0 6px #81b64c",
        backgroundColor: "rgba(129, 182, 76, 0.15)"
      };
    }
    return styles;
  };

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#161412] text-white flex flex-col md:flex-row relative">
      
      {/* ─── LEFT SIDEBAR NAVIGATION ─── */}
      <LeftNavbar activeUser={currentUser} />

      {/* ─── CENTER ARENA (Timer + Board + Timer) ─── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden bg-[#161412] py-4">
        
        {/* Mobile Back Header */}
        <div className="md:hidden px-4 mb-2">
          <button onClick={() => router.push("/dashboard")} className="flex items-center gap-1 text-sm text-[#7a7a6e]">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>

        {/* Puzzle Target Instruction */}
        <div className="shrink-0 px-4 text-center pb-2">
          <h2 className="text-base font-black tracking-tight text-white flex items-center justify-center gap-2">
            <HelpCircle className="h-4 w-4 text-[#81b64c]" />
            {boardOrientation === "white" 
              ? "Find the best move for White!" 
              : "Find the best move for Black!"}
          </h2>
        </div>

        {/* Board Section */}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden px-4 py-1.5">
          <BoardSection
            position={game.fen()}
            onDrop={onDrop}
            onSquareClick={onSquareClick}
            customSquareStyles={getCustomSquareStyles()}
            boardOrientation={boardOrientation}
          />
        </div>

        {/* Dummy spacer card bottom */}
        <div className="shrink-0 h-4" />

      </div>

      {/* ─── RIGHT PANEL: Puzzle dashboard ─── */}
      <aside className="h-full flex flex-col overflow-hidden bg-[#1a1917] border-l border-white/[0.07]" style={{ width: "300px", minWidth: "300px", maxWidth: "300px" }}>
        
        {/* Rating dashboard info */}
        <div className="shrink-0 p-5 bg-[#161412] border-b border-white/[0.06] text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-yellow-400">
            <Trophy className="h-5 w-5" />
            <span className="text-xs font-black uppercase tracking-wider">Tactical Puzzles</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#111010] p-3 rounded-xl border border-white/[0.03] text-center">
              <span className="text-[10px] text-[#7a7a6e] font-bold block mb-1">RATING</span>
              <span className="font-mono text-white text-xl font-black">{userRating}</span>
            </div>
            <div className="bg-[#111010] p-3 rounded-xl border border-white/[0.03] text-center flex flex-col items-center justify-center">
              <span className="text-[10px] text-[#7a7a6e] font-bold block mb-0.5">STREAK</span>
              <span className="font-mono text-amber-500 text-lg font-black flex items-center gap-1.5">
                <Flame className="h-4 w-4 fill-amber-500 stroke-none" />
                {streak}
              </span>
            </div>
          </div>
        </div>

        {/* Instructions / Outcome Panel */}
        <div className="flex-1 p-5 flex flex-col justify-between">
          <div className="space-y-6">
            
            {/* Status updates */}
            {puzzleStatus === "playing" && (
              <div className="bg-[#272522]/30 border border-white/[0.04] p-4 rounded-2xl text-xs leading-snug text-[#a0a09a]">
                <span className="font-bold text-white block mb-1">Instructions</span>
                Identify the winning moves. If your move is correct, the puzzle progresses. Make one mistake, and you fail.
              </div>
            )}

            {puzzleStatus === "success" && (
              <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl flex flex-col items-center text-center space-y-2">
                <CheckCircle className="h-8 w-8 text-green-400" />
                <div>
                  <span className="font-black text-green-400 text-base block">Success!</span>
                  <p className="text-xs text-[#a0a09a] mt-0.5">You found the correct refutation.</p>
                </div>
                {ratingChange && (
                  <span className="text-[#81b64c] font-black text-sm bg-[#81b64c]/10 px-3 py-1 rounded-lg">
                    +{ratingChange} Rating points
                  </span>
                )}
              </div>
            )}

            {puzzleStatus === "failed" && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex flex-col items-center text-center space-y-2">
                <XCircle className="h-8 w-8 text-red-400" />
                <div>
                  <span className="font-black text-red-400 text-base block">Incorrect Move</span>
                  <p className="text-xs text-[#a0a09a] mt-0.5">That was not the best line of play.</p>
                </div>
                {ratingChange && (
                  <span className="text-red-400 font-black text-sm bg-red-400/10 px-3 py-1 rounded-lg">
                    {ratingChange} Rating points
                  </span>
                )}
              </div>
            )}

            {/* Puzzle Metadata */}
            {puzzle && (
              <div className="space-y-2">
                <span className="text-[10px] text-[#5e5b57] font-bold uppercase tracking-wider block">Puzzle Details</span>
                <div className="flex flex-wrap gap-1.5">
                  <span className="bg-[#272522] border border-white/[0.04] text-[10px] text-[#a0a09a] px-2 py-1 rounded-lg">
                    Difficulty: {puzzle.rating}
                  </span>
                  {puzzle.themes.slice(0, 3).map((theme) => (
                    <span key={theme} className="bg-[#272522] border border-white/[0.04] text-[10px] text-[#a0a09a] px-2 py-1 rounded-lg capitalize">
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Action Row buttons */}
          <div className="space-y-2">
            {puzzleStatus === "playing" && (
              <button
                onClick={handleShowHint}
                className="
                  w-full py-3.5 rounded-xl
                  bg-[#272522] hover:bg-yellow-500/10
                  border border-white/[0.08] hover:border-yellow-500/20
                  text-[#a0a09a] hover:text-yellow-400
                  font-bold text-xs flex items-center justify-center gap-1.5
                  transition-all
                "
              >
                <Lightbulb className="h-4 w-4" />
                Reveal Hint
              </button>
            )}

            {puzzleStatus !== "playing" && (
              <button
                onClick={fetchPuzzle}
                className="
                  w-full py-4 rounded-xl
                  bg-[#81b64c] hover:bg-[#90c957]
                  text-[#0f0e0c] font-black text-sm
                  flex items-center justify-center gap-1.5
                  transition-all shadow-[0_0_15px_rgba(129,182,76,0.2)]
                "
              >
                Next Puzzle
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            {puzzleStatus === "failed" && (
              <button
                onClick={fetchPuzzle}
                className="
                  w-full py-3.5 rounded-xl
                  bg-[#272522] hover:bg-white/[0.02]
                  border border-white/[0.08]
                  text-[#a0a09a] hover:text-white
                  font-bold text-xs flex items-center justify-center gap-1.5
                  transition-all
                "
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Retry Puzzle
              </button>
            )}
          </div>
        </div>

      </aside>

    </main>
  );
}
