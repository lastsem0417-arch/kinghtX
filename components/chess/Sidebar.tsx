"use client";

import { useRef, useEffect } from "react";
import MoveHistory from "./MoveHistory";

type Props = {
  history: string[];
};

const tabItems = [
  { label: "Moves", active: true },
  { label: "Chat", active: false },
  { label: "Info", active: false },
];

const ResignIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 4h3v13H4zM7 6h13v3H10v2h8v2h-8v2h10v2H7z" />
  </svg>
);

const DrawIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12h8M12 8v8" />
  </svg>
);

export default function Sidebar({ history }: Props) {
  const moveListRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new move added
  useEffect(() => {
    if (moveListRef.current) {
      moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
    }
  }, [history]);

  return (
    <aside className="h-full flex flex-col overflow-hidden bg-[#1e1c1a] border-l border-white/[0.07]" style={{ width: "280px", minWidth: "280px", maxWidth: "280px" }}>

      {/* ── Top section tabs: New Game / Games / Players ── */}
      <div className="shrink-0 flex items-stretch border-b border-white/[0.07] bg-[#161412] h-[42px]">
        {[
          { label: "New Game", icon: "+" },
          { label: "Games", icon: "▦" },
          { label: "Players", icon: "👤" },
        ].map((item, i) => (
          <button
            key={i}
            className={`
              flex-1 flex flex-col items-center justify-center gap-0.5
              text-[10px] font-bold tracking-wide
              transition-colors duration-150
              ${i === 0 ? "text-white bg-[#272522]" : "text-[#7a7a6e] hover:text-white hover:bg-[#1e1c1a]"}
              border-r border-white/[0.07] last:border-r-0
            `}
          >
            <span className="text-[13px] leading-none">{item.icon}</span>
            <span className="uppercase tracking-[0.05em]">{item.label}</span>
          </button>
        ))}
      </div>

      {/* ── Moves / Chat / Info sub-tabs ── */}
      <div className="shrink-0 flex items-end border-b border-white/[0.07] bg-[#1e1c1a] px-1 pt-0 h-[36px]">
        {tabItems.map((tab, i) => (
          <button
            key={i}
            className={`
              relative px-3 pb-2 pt-1 text-[12px] font-bold tracking-wide
              transition-colors duration-150
              ${
                tab.active
                  ? "text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#81b64c] after:rounded-t-sm"
                  : "text-[#6e6a66] hover:text-[#a0a09a]"
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Opening Info ── */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-[#1a1815]">
        <div>
          <div className="text-[10px] text-[#5e5b57] font-semibold uppercase tracking-wider mb-0.5">
            Opening
          </div>
          <div className="text-[12px] text-[#b0aea8] font-semibold leading-snug">
            {history.length === 0
              ? "Starting Position"
              : history.length <= 2
              ? "King's Pawn Opening"
              : "Mid-game"}
          </div>
        </div>
        <button className="w-5 h-5 flex items-center justify-center text-[#5e5b57] hover:text-white rounded transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </button>
      </div>

      {/* ── Move History (scrollable) ── */}
      <div
        ref={moveListRef}
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#3a3733 transparent" }}
      >
        <MoveHistory history={history} />
      </div>

      {/* ── Separator with move count ── */}
      {history.length > 0 && (
        <div className="shrink-0 px-3 py-1 border-t border-white/[0.05] flex items-center justify-between">
          <span className="text-[10px] text-[#4e4b47]">{history.length} moves</span>
          <span className="text-[10px] text-[#4e4b47]">
            {Math.ceil(history.length / 2)} full
          </span>
        </div>
      )}

      {/* ── Action buttons: Resign / Draw / Rematch ── */}
      <div className="shrink-0 border-t border-white/[0.07] bg-[#161412] px-3 py-2 flex gap-2">
        <button className="flex-1 flex items-center justify-center gap-1.5 rounded-[4px] bg-[#272522] hover:bg-[#302e2b] border border-white/[0.06] text-[#7a7a6e] hover:text-white text-[11px] font-bold py-2 transition-all">
          <ResignIcon />
          Resign
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 rounded-[4px] bg-[#272522] hover:bg-[#302e2b] border border-white/[0.06] text-[#7a7a6e] hover:text-white text-[11px] font-bold py-2 transition-all">
          <DrawIcon />
          Draw
        </button>
      </div>

    </aside>
  );
}