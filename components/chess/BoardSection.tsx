"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const ChessboardComponent = dynamic(
  async () => {
    const mod = await import("react-chessboard");
    return mod.Chessboard;
  },
  {
    ssr: false,
  }
);

type Props = {
  position: string;
  onDrop: any;
  onSquareClick: any;
  customSquareStyles: any;
  boardOrientation: "white" | "black";
  customArrows?: any;
};

export default function BoardSection({
  position,
  onDrop,
  onSquareClick,
  customSquareStyles,
  boardOrientation,
  customArrows,
}: Props) {
  const [boardSize, setBoardSize] = useState(560);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateBoardSize = () => {
      const bounds = element.getBoundingClientRect();
      const width = element.clientWidth || bounds.width;
      const height = element.clientHeight || bounds.height;
      // Use the smaller dimension so the board always fits in both directions.
      const size = Math.floor(Math.min(width, height));
      // @ts-ignore
      window.__boardResizeCount = (window.__boardResizeCount || 0) + 1;
      // @ts-ignore
      window.__boardMeasured = { width, height, size };
      setBoardSize(size);
    };

    updateBoardSize();
    const rafId = window.requestAnimationFrame(updateBoardSize);
    const timeoutId = window.setTimeout(updateBoardSize, 80);

    const observer = new ResizeObserver(updateBoardSize);
    observer.observe(element);

    window.addEventListener("resize", updateBoardSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateBoardSize);
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-board-size={boardSize}
      className="h-full w-full flex items-center justify-center"
    >
      <ChessboardComponent
        id="KnightXBoard"
        position={position}
        onPieceDrop={onDrop}
        onSquareClick={onSquareClick}
        customSquareStyles={customSquareStyles}
        boardOrientation={boardOrientation}
        boardWidth={boardSize}
        animationDuration={160}
        customArrows={customArrows}
        customDarkSquareStyle={{
          backgroundColor: "#739552",
        }}
        customLightSquareStyle={{
          backgroundColor: "#ebecd0",
        }}
        customBoardStyle={{
          borderRadius: "3px",
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)",
        }}
      />
    </div>
  );
}
