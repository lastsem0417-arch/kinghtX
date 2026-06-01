"use client";

import { useState } from "react";
import { 
  sendFriendRequest, 
  acceptFriendRequest, 
  rejectFriendRequest 
} from "@/app/actions/social";
import { UserPlus, UserCheck, X, Check, Search, Radio, User } from "lucide-react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

interface Friend {
  _id: string;
  username: string;
  avatar?: string;
  rating: {
    rapid: number;
    blitz: number;
  };
  lastSeen: string;
}

interface FriendRequest {
  _id: string;
  username: string;
  avatar?: string;
  rating: {
    rapid: number;
  };
}

interface SocialPanelProps {
  friends: Friend[];
  friendRequests: FriendRequest[];
}

export default function SocialPanel({ friends, friendRequests }: SocialPanelProps) {
  const [usernameInput, setUsernameInput] = useState("");
  const [pendingAdd, setPendingAdd] = useState(false);

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;

    setPendingAdd(true);
    const res = await sendFriendRequest(usernameInput);
    setPendingAdd(false);

    if (res?.error) {
      toast.error(res.error, {
        style: { background: "#1a1917", color: "#f87171", border: "1px solid rgba(248,113,113,0.15)" }
      });
    } else {
      toast.success(`Friend request sent to @${usernameInput}`, {
        style: { background: "#1a1917", color: "#81b64c", border: "1px solid rgba(129,182,76,0.15)" }
      });
      setUsernameInput("");
    }
  };

  const handleAccept = async (id: string, name: string) => {
    const res = await acceptFriendRequest(id);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success(`You are now friends with @${name}`);
    }
  };

  const handleReject = async (id: string) => {
    const res = await rejectFriendRequest(id);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success("Request rejected");
    }
  };

  // Helper to check if user is online (within last 5 minutes)
  const isOnline = (lastSeenStr: string) => {
    const lastSeen = new Date(lastSeenStr).getTime();
    return Date.now() - lastSeen < 5 * 60 * 1000;
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <Toaster position="top-right" />

      {/* ─── ADD FRIEND FORM ─── */}
      <div className="space-y-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#7a7a6e]">
          Add Friend
        </h3>
        <form onSubmit={handleAddFriend} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Enter username..."
              className="
                w-full bg-[#111010] border border-white/[0.08] rounded-xl
                text-xs pl-3 pr-8 py-2.5 text-white placeholder-[#4a4a44]
                focus:outline-none focus:border-[#81b64c]/40
              "
            />
            <Search className="absolute right-2.5 top-3 h-3.5 w-3.5 text-[#4a4a44]" />
          </div>
          <button
            type="submit"
            disabled={pendingAdd}
            className="
              px-3 rounded-xl bg-[#81b64c] hover:bg-[#90c957]
              text-[#0f0e0c] font-bold text-xs transition-all shrink-0
              disabled:opacity-50
            "
          >
            {pendingAdd ? "..." : <UserPlus className="h-4 w-4" />}
          </button>
        </form>
      </div>

      {/* ─── INCOMING REQUESTS ─── */}
      {friendRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#7a7a6e] flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
            Requests ({friendRequests.length})
          </h3>
          
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {friendRequests.map((req) => (
              <div 
                key={req._id}
                className="bg-[#111010] border border-white/[0.05] p-2.5 rounded-xl flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-[#272522] overflow-hidden flex items-center justify-center shrink-0">
                    <img 
                      src={req.avatar || "https://www.chess.com/bundles/web/images/user-image.007dad08.svg"} 
                      alt={req.username}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <Link 
                      href={`/profile/${req.username}`}
                      className="text-xs font-bold text-white hover:text-[#81b64c] block truncate transition-colors"
                    >
                      {req.username}
                    </Link>
                    <span className="text-[10px] text-[#7a7a6e] block font-mono">{req.rating.rapid} Elo</span>
                  </div>
                </div>

                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleAccept(req._id, req.username)}
                    className="p-1 rounded-lg bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-[#0f0e0c] transition-all"
                    title="Accept"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleReject(req._id)}
                    className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-[#0f0e0c] transition-all"
                    title="Decline"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── FRIENDS LIST ─── */}
      <div className="flex-1 flex flex-col space-y-2 min-h-0">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#7a7a6e]">
          Friends ({friends.length})
        </h3>

        {friends.length === 0 ? (
          <div className="flex-1 border border-dashed border-white/[0.06] rounded-2xl flex flex-col items-center justify-center text-center p-6 text-[#4a4a44]">
            <User className="h-8 w-8 mb-2 stroke-[1.5]" />
            <p className="text-xs font-semibold">No friends added yet.</p>
            <p className="text-[10px] mt-0.5">Use the search box above to send requests.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#3a3733 transparent" }}>
            {friends.map((friend) => {
              const online = isOnline(friend.lastSeen);
              return (
                <div 
                  key={friend._id}
                  className="bg-[#111010]/40 border border-white/[0.04] p-3 rounded-xl flex items-center justify-between hover:bg-[#111010] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Avatar with online indicator */}
                    <div className="relative shrink-0">
                      <div className="h-8 w-8 rounded-lg bg-[#272522] overflow-hidden flex items-center justify-center border border-white/[0.05]">
                        <img 
                          src={friend.avatar || "https://www.chess.com/bundles/web/images/user-image.007dad08.svg"} 
                          alt={friend.username}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div 
                        className={`
                          absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-[#1a1917]
                          ${online ? "bg-green-500 animate-pulse" : "bg-neutral-600"}
                        `}
                      />
                    </div>

                    <div className="min-w-0 text-left">
                      <Link 
                        href={`/profile/${friend.username}`}
                        className="text-xs font-bold text-white hover:text-[#81b64c] block truncate transition-colors"
                      >
                        {friend.username}
                      </Link>
                      <span className="text-[10px] text-[#7a7a6e] block font-mono">
                        {online ? "Online" : "Offline"} • {friend.rating.rapid} Elo
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/play?challenge=${friend.username}`}
                    className="
                      px-2.5 py-1 rounded-lg border border-white/[0.08] hover:border-[#81b64c]/30
                      text-[10px] font-bold text-[#a0a09a] hover:text-[#81b64c] hover:bg-[#81b64c]/10
                      transition-all shrink-0
                    "
                  >
                    Challenge
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
