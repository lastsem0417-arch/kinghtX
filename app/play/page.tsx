"use client";

import { useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

export default function PlayPage() {
  const [game, setGame] = useState(new Chess());

  const moveSound = typeof Audio !== "undefined"
    ? new Audio("/sounds/move.mp3")
    : null;

  const captureSound = typeof Audio !== "undefined"
    ? new Audio("/sounds/capture.mp3")
    : null;

  function makeMove(move: any) {
    const gameCopy = new Chess(game.fen());

    try {
      const result = gameCopy.move(move);

      if (result) {

        // SOUND SYSTEM 🔥
        if (result.captured) {
          captureSound?.play();
        } else {
          moveSound?.play();
        }

        setGame(gameCopy);
        return true;
      }
    } catch (e) {
      return false;
    }

    return false;
  }

  function onDrop(sourceSquare: any, targetSquare: any) {
    return makeMove({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q",
    });
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center">

      <h1 className="text-5xl font-bold mb-8 mt-10">
        KNIGHT<span className="text-green-400">X</span>
      </h1>

      <div className="w-[600px] rounded-2xl overflow-hidden shadow-2xl border border-white/10">

        <Chessboard
          position={game.fen()}
          onPieceDrop={onDrop}
          boardWidth={600}

          // LEGAL MOVE HIGHLIGHT 🔥
          customBoardStyle={{
            borderRadius: "16px",
          }}

          customDarkSquareStyle={{
            backgroundColor: "#B58863",
          }}

          customLightSquareStyle={{
            backgroundColor: "#F0D9B5",
          }}
        />

      </div>

      <div className="mt-6 text-xl">
        Turn:
        <span className="text-green-400 font-bold ml-2">
          {game.turn() === "w" ? "White" : "Black"}
        </span>
      </div>

    </main>
  );
}