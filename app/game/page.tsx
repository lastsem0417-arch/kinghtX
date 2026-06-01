"use client";

import {
  useState,
  useEffect,
  useRef,
} from "react";

import { Chess } from "chess.js";

import PlayerCard from "@/components/chess/PlayerCard";
import BoardSection from "@/components/chess/BoardSection";
import Sidebar from "@/components/chess/Sidebar";
import GameControls from "@/components/chess/GameControls";

export default function PlayPage() {

  const [game, setGame] =
    useState(new Chess());

  const [history, setHistory] =
    useState<string[]>([]);

  const [moveSquares, setMoveSquares] =
    useState<any>({});

  const [lastMoveSquares, setLastMoveSquares] =
    useState<any>({});

  const [boardOrientation, setBoardOrientation] =
    useState<"white" | "black">(
      "white"
    );

  // TIMER
  const [whiteTime, setWhiteTime] =
    useState(600);

  const [blackTime, setBlackTime] =
    useState(600);

  const [gameStarted, setGameStarted] =
    useState(false);

  const [gameEnded, setGameEnded] =
    useState(false);

  // CURRENT TURN
  const turn = game.turn();

  // SOUNDS
  const moveSound = useRef<any>(null);
  const captureSound = useRef<any>(null);
  const castleSound = useRef<any>(null);
  const checkSound = useRef<any>(null);
  const gameStartSound = useRef<any>(null);
  const gameEndSound = useRef<any>(null);

  // LOAD SOUNDS
  useEffect(() => {

    moveSound.current =
      new Audio("/sounds/move.mp3");

    captureSound.current =
      new Audio("/sounds/capture.mp3");

    castleSound.current =
      new Audio("/sounds/castle.mp3");

    checkSound.current =
      new Audio("/sounds/move-check.mp3");

    gameStartSound.current =
      new Audio("/sounds/game-start.mp3");

    gameEndSound.current =
      new Audio("/sounds/game-end.mp3");

  }, []);

  // LOAD TIME
  useEffect(() => {

    const selectedMode =
      localStorage.getItem(
        "selectedMode"
      );

    if (!selectedMode) return;

    let seconds = 600;

    switch (selectedMode) {

      case "1 min":
        seconds = 60;
        break;

      case "1 | 1":
        seconds = 60;
        break;

      case "2 | 1":
        seconds = 120;
        break;

      case "3 min":
        seconds = 180;
        break;

      case "3 | 2":
        seconds = 180;
        break;

      case "5 min":
        seconds = 300;
        break;

      case "10 min":
        seconds = 600;
        break;

      case "15 | 10":
        seconds = 900;
        break;

      case "30 min":
        seconds = 1800;
        break;

    }

    setWhiteTime(seconds);
    setBlackTime(seconds);

  }, []);

  // TIMER
  useEffect(() => {

    if (!gameStarted) return;

    const interval =
      setInterval(() => {

        if (game.turn() === "w") {

          setWhiteTime((prev) =>
            prev > 0
              ? prev - 1
              : 0
          );

        } else {

          setBlackTime((prev) =>
            prev > 0
              ? prev - 1
              : 0
          );

        }

      }, 1000);

    return () =>
      clearInterval(interval);

  }, [game, gameStarted]);

  // FORMAT TIME
  function formatTime(
    time: number
  ) {

    const minutes =
      Math.floor(time / 60);

    const seconds =
      time % 60;

    return `${minutes}:${
      seconds < 10 ? "0" : ""
    }${seconds}`;

  }

  // MAKE MOVE
  function makeMove(move: any) {

    const gameCopy =
      new Chess(game.fen());

    try {

      const result =
        gameCopy.move(move);

      if (result) {

        if (!gameStarted) {

          gameStartSound.current?.play();

        }

        setGameStarted(true);

        if (result.captured) {

          captureSound.current?.play();

        } else if (
          result.flags.includes("k") ||
          result.flags.includes("q")
        ) {

          castleSound.current?.play();

        } else {

          moveSound.current?.play();

        }

        if (gameCopy.isCheck()) {

          checkSound.current?.play();

        }

        if (
          gameCopy.isCheckmate() ||
          gameCopy.isDraw()
        ) {

          gameEndSound.current?.play();

          setGameEnded(true);

        }

        setGame(gameCopy);

        setHistory((prev) => [
          ...prev,
          result.san,
        ]);

        setLastMoveSquares({

          [result.from]: {
            backgroundColor:
              "rgba(255,255,0,0.35)",
          },

          [result.to]: {
            backgroundColor:
              "rgba(255,255,0,0.35)",
          },

        });

        setMoveSquares({});

        return true;

      }

    } catch (e) {

      return false;

    }

    return false;

  }

  // DRAG DROP
  function onDrop(
    sourceSquare: any,
    targetSquare: any
  ) {

    return makeMove({

      from: sourceSquare,

      to: targetSquare,

      promotion: "q",

    });

  }

  // CLICK MOVES
  function onSquareClick(
    square: any
  ) {

    const moves = game.moves({

      square,

      verbose: true,

    });

    if (moves.length === 0) {

      setMoveSquares({});
      return;

    }

    const squares: any = {};

    squares[square] = {

      background:
        "rgba(0,255,100,0.35)",

    };

    moves.forEach((move: any) => {

      squares[move.to] = {

        background:
          "radial-gradient(circle, rgba(0,255,100,0.45) 25%, transparent 25%)",

        borderRadius: "50%",

      };

    });

    setMoveSquares(squares);

  }

  // UNDO
  function handleUndo() {

    const newGame =
      new Chess();

    history
      .slice(0, -1)
      .forEach((move) => {

        newGame.move(move);

      });

    setGame(newGame);

    setHistory((prev) =>
      prev.slice(0, -1)
    );

  }

  // RESET
  function handleReset() {

    setGame(new Chess());

    setHistory([]);

    setMoveSquares({});

    setLastMoveSquares({});

    setGameStarted(false);

    setGameEnded(false);

  }

  // FLIP
  function handleFlip() {

    setBoardOrientation(
      (prev) =>
        prev === "white"
          ? "black"
          : "white"
    );

  }

  // COPY PGN
  function handleCopyPGN() {

    navigator.clipboard.writeText(
      game.pgn()
    );

    alert("PGN copied!");

  }

  // Active player: who is currently "on move"
  const isWhiteTurn = turn === "w";

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#161412] text-white flex">

      {/* ══════════════════════════════════════════
          LEFT SIDEBAR NAV (Chess.com style)
      ══════════════════════════════════════════ */}
      <aside
        className="flex-shrink-0 flex flex-col overflow-hidden bg-[#161412] border-r border-white/[0.06]"
        style={{ width: "60px" }}
      >
        {/* Logo */}
        <div className="flex items-center justify-center h-[52px] border-b border-white/[0.06] shrink-0">
          <span className="text-[#81b64c] text-[22px]">♞</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col items-center gap-0.5 py-2 overflow-hidden">
          {[
            { label: "Play", icon: "♟" },
            { label: "Puzzles", icon: "🧩" },
            { label: "Learn", icon: "📖" },
            { label: "Train", icon: "🎯" },
            { label: "Watch", icon: "📺" },
            { label: "Stats", icon: "📊" },
          ].map((item) => (
            <button
              key={item.label}
              title={item.label}
              className="
                w-11 h-11 flex flex-col items-center justify-center gap-0.5
                rounded-lg text-[#7a7a6e] hover:text-white hover:bg-[#272522]
                transition-all duration-150 group
              "
            >
              <span className="text-[18px] leading-none">{item.icon}</span>
              <span className="text-[8px] font-bold tracking-wide opacity-0 group-hover:opacity-100 transition-opacity leading-none">
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        {/* User avatar at bottom */}
        <div className="shrink-0 flex flex-col items-center pb-3 border-t border-white/[0.06] pt-2">
          <div className="h-9 w-9 rounded-full bg-[#4a4a4a] ring-2 ring-[#81b64c]/30 overflow-hidden">
            <img
              src="https://www.chess.com/bundles/web/images/user-image.007dad08.svg"
              alt="me"
              className="h-full w-full object-cover opacity-60"
            />
          </div>
        </div>
      </aside>

      {/* ══════════════════════════════════════════
          CENTER: Board + Player Cards Column
      ══════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden bg-[#161412]">

        {/* Top padding/spacer */}
        <div className="shrink-0 h-2" />

        {/* ── BLACK PLAYER CARD (opponent = top) ── */}
        <div className="shrink-0 px-4">
          <PlayerCard
            name="Guest_Black"
            rating={1200}
            time={formatTime(blackTime)}
            active={!isWhiteTurn && gameStarted && !gameEnded}
            side="top"
          />
        </div>

        {/* ── BOARD (fills remaining vertical space) ── */}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden px-4 py-1">
          <BoardSection
            position={game.fen()}
            onDrop={onDrop}
            onSquareClick={onSquareClick}
            customSquareStyles={{
              ...moveSquares,
              ...lastMoveSquares,
            }}
            boardOrientation={boardOrientation}
          />
        </div>

        {/* ── WHITE PLAYER CARD (you = bottom) ── */}
        <div className="shrink-0 px-4">
          <PlayerCard
            name="Aaryansingh_17"
            rating={253}
            time={formatTime(whiteTime)}
            active={isWhiteTurn && gameStarted && !gameEnded}
            side="bottom"
          />
        </div>

        {/* ── GAME CONTROLS ── */}
        <div className="shrink-0">
          <GameControls
            onUndo={handleUndo}
            onReset={handleReset}
            onFlip={handleFlip}
            onCopyPGN={handleCopyPGN}
          />
        </div>

        {/* Bottom spacer */}
        <div className="shrink-0 h-2" />
      </div>

      {/* ══════════════════════════════════════════
          RIGHT: Sidebar
      ══════════════════════════════════════════ */}
      <Sidebar history={history} />

    </main>
  );

}