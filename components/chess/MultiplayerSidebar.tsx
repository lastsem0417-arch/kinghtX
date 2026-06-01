"use client";

import { useRef, useEffect, useState } from "react";
import { useGameStore } from "@/store/useGameStore";
import MoveHistory from "./MoveHistory";
import { MessageSquare, List, Info, Send, Flag, Check, X, ShieldAlert } from "lucide-react";

export default function MultiplayerSidebar() {
  const {
    pgn,
    chatMessages,
    spectatorCount,
    drawOffered,
    isOpponentDisconnected,
    resign,
    offerDraw,
    acceptDraw,
    declineDraw,
    sendChatMessage,
    roomId,
    color,
    opponent,
    timeControl,
  } = useGameStore();

  const [activeTab, setActiveTab] = useState<"moves" | "chat" | "info">("moves");
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const moveListRef = useRef<HTMLDivElement>(null);

  // Parse moves from PGN
  const getMovesArray = (): string[] => {
    if (!pgn) return [];
    // Basic PGN parser to extract moves (e.g., "1. e4 e5 2. Nf3 Nc6" -> ["e4", "e5", "Nf3", "Nc6"])
    const cleanPgn = pgn.replace(/\[.*?\]/g, "").replace(/\n/g, " ").trim();
    const tokens = cleanPgn.split(/\s+/);
    const moves: string[] = [];
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token) continue;
      // Skip move numbers (e.g. "1.", "12...")
      if (token.match(/^\d+\.?\.?\.?$/)) continue;
      moves.push(token);
    }
    return moves;
  };

  const movesList = getMovesArray();

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeTab]);

  // Auto-scroll moves to bottom
  useEffect(() => {
    if (moveListRef.current) {
      moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
    }
  }, [pgn]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput);
    setChatInput("");
  };

  return (
    <aside className="h-full flex flex-col overflow-hidden bg-[#1a1917] border-l border-white/[0.07]" style={{ width: "300px", minWidth: "300px", maxWidth: "300px" }}>
      
      {/* ─── Opponent Disconnection Warning ─── */}
      {isOpponentDisconnected && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-3 py-2 flex items-start gap-2 text-xs text-red-400">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 animate-pulse" />
          <div>
            <span className="font-bold">Opponent Disconnected!</span>
            <p className="opacity-80">Claiming victory if they do not reconnect in 60s.</p>
          </div>
        </div>
      )}

      {/* ─── TAB NAVIGATION ─── */}
      <div className="shrink-0 flex border-b border-white/[0.07] bg-[#161412] h-[48px]">
        {[
          { id: "moves", label: "Moves", icon: <List className="h-4 w-4" /> },
          { id: "chat", label: "Chat", icon: <MessageSquare className="h-4 w-4" /> },
          { id: "info", label: "Info", icon: <Info className="h-4 w-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`
              flex-1 flex items-center justify-center gap-1.5
              text-xs font-bold uppercase tracking-wider
              transition-all duration-150
              ${
                activeTab === tab.id
                  ? "text-[#81b64c] bg-[#1a1917] border-b-2 border-[#81b64c]"
                  : "text-[#7a7a6e] hover:text-white hover:bg-white/[0.01]"
              }
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB CONTENT AREA ─── */}
      <div className="flex-1 min-h-0 flex flex-col bg-[#1a1917]">
        
        {/* MOVES TAB */}
        {activeTab === "moves" && (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Opening Tag Header */}
            <div className="shrink-0 px-3 py-2 border-b border-white/[0.05] bg-[#211f1d] text-[11px] text-[#a0a09a] font-semibold flex justify-between">
              <span>Game Log</span>
              <span>{movesList.length} Moves</span>
            </div>
            
            <div
              ref={moveListRef}
              className="flex-1 overflow-y-auto"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#3a3733 transparent" }}
            >
              <MoveHistory history={movesList} />
            </div>
          </div>
        )}

        {/* CHAT TAB */}
        {activeTab === "chat" && (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Chat messages viewport */}
            <div 
              className="flex-1 overflow-y-auto p-3 space-y-2.5"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#3a3733 transparent" }}
            >
              {chatMessages.length === 0 ? (
                <div className="text-center text-xs text-[#5e5b57] py-6">
                  No chat messages yet. Say hello!
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} className="text-xs break-words">
                    <span className="font-extrabold text-[#81b64c] mr-1.5">
                      {msg.sender}:
                    </span>
                    <span className="text-[#e8e6d9]">{msg.text}</span>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Form */}
            <form onSubmit={handleSendChat} className="p-2 border-t border-white/[0.06] bg-[#161412] flex gap-1.5">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                maxLength={150}
                className="
                  flex-1 bg-[#111010] border border-white/[0.08] rounded-lg 
                  text-xs px-3 py-2 text-white placeholder-[#4a4a44]
                  focus:outline-none focus:border-[#81b64c]/40
                "
              />
              <button 
                type="submit"
                className="p-2 rounded-lg bg-[#81b64c] text-[#0f0e0c] hover:bg-[#90c957] transition-colors shrink-0"
              >
                <Send className="h-3 w-3" />
              </button>
            </form>
          </div>
        )}

        {/* INFO TAB */}
        {activeTab === "info" && (
          <div className="flex-grow p-4 space-y-4 text-xs text-[#a0a09a]">
            <div>
              <span className="text-[#5e5b57] font-bold block mb-1">ROOM ID</span>
              <span className="font-mono text-white select-all bg-[#111010] border border-white/[0.05] p-2 rounded-lg block">
                {roomId}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[#5e5b57] font-bold block mb-1">Time Control</span>
                <span className="text-white font-semibold">{timeControl}</span>
              </div>
              <div>
                <span className="text-[#5e5b57] font-bold block mb-1">Spectators</span>
                <span className="text-white font-semibold">{spectatorCount} watching</span>
              </div>
            </div>

            <div>
              <span className="text-[#5e5b57] font-bold block mb-1">Your Role</span>
              <span className="text-white font-semibold uppercase tracking-wider">
                {color === "spectator" ? "📺 Spectating" : `🎮 Playing as ${color}`}
              </span>
            </div>
            
            {opponent && (
              <div>
                <span className="text-[#5e5b57] font-bold block mb-1">Opponent Details</span>
                <div className="bg-[#111010] p-2 rounded-lg border border-white/[0.04] text-white">
                  <span className="font-bold">{opponent.username}</span>
                  <span className="text-xs text-[#7a7a6e] block">{opponent.rating} Elo</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── ACTION BUTTONS AT BOTTOM ─── */}
      {color !== "spectator" && (
        <div className="shrink-0 border-t border-white/[0.07] bg-[#161412] p-3 flex flex-col gap-2">
          {drawOffered ? (
            <div className="space-y-1.5">
              <span className="text-[10px] text-amber-500 font-bold block text-center uppercase tracking-wider animate-pulse">
                Draw Offered!
              </span>
              <div className="flex gap-2">
                <button
                  onClick={acceptDraw}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-green-500 hover:bg-green-400 text-[#0f0e0c] text-xs font-black py-2.5 transition-all shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                >
                  <Check className="h-3.5 w-3.5" />
                  Accept Draw
                </button>
                <button
                  onClick={declineDraw}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#272522] hover:bg-red-500/10 border border-white/[0.06] text-[#7a7a6e] hover:text-red-400 text-xs font-bold py-2.5 transition-all"
                >
                  <X className="h-3.5 w-3.5" />
                  Decline
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={offerDraw}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#272522] hover:bg-[#302e2b] border border-white/[0.06] text-[#a0a09a] hover:text-white text-xs font-bold py-2.5 transition-all"
              >
                Offer Draw
              </button>
              <button
                onClick={resign}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#272522] hover:bg-red-500/15 border border-red-500/10 text-[#7a7a6e] hover:text-red-400 text-xs font-bold py-2.5 transition-all"
              >
                <Flag className="h-3.5 w-3.5 shrink-0" />
                Resign
              </button>
            </div>
          )}
        </div>
      )}

    </aside>
  );
}
