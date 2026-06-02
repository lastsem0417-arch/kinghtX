"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  sendFriendRequest, 
  acceptFriendRequest, 
  rejectFriendRequest,
  searchUserProfile
} from "@/app/actions/social";
import { useGameStore } from "@/store/useGameStore";
import { UserPlus, UserCheck, X, Check, Search, Radio, User as UserIcon, MessageSquare, Send } from "lucide-react";
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
  currentUserId: string;
}

export default function SocialPanel({ friends, friendRequests, currentUserId }: SocialPanelProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"social" | "chat">("social");
  const [usernameInput, setUsernameInput] = useState("");
  const [pendingAdd, setPendingAdd] = useState(false);
  const [searchedUser, setSearchedUser] = useState<any | null>(null);

  // Direct Message States
  const [activeChatFriend, setActiveChatFriend] = useState<Friend | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [directChatInput, setDirectChatInput] = useState("");
  const directChatEndRef = useRef<HTMLDivElement>(null);
  
  // Real-time Global Chat States
  const [globalMessages, setGlobalMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { socket, connectSocket } = useGameStore();

  useEffect(() => {
    connectSocket();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleGlobalMsg = (msg: any) => {
      setGlobalMessages((prev) => [...prev, msg].slice(-50));
    };

    const handleIncomingRequest = (data: any) => {
      toast.success(`New friend request from @${data.senderUsername}`, {
        style: { background: "#1a1917", color: "#81b64c", border: "1px solid rgba(129,182,76,0.15)" }
      });
      router.refresh();
    };

    const handleRequestAccepted = (data: any) => {
      toast.success(`@${data.senderUsername} accepted your friend request!`, {
        style: { background: "#1a1917", color: "#81b64c", border: "1px solid rgba(129,182,76,0.15)" }
      });
      router.refresh();
    };

    socket.on("global_chat_received", handleGlobalMsg);
    socket.on("incoming_friend_request", handleIncomingRequest);
    socket.on("friend_request_accepted_notify", handleRequestAccepted);

    return () => {
      socket.off("global_chat_received", handleGlobalMsg);
      socket.off("incoming_friend_request", handleIncomingRequest);
      socket.off("friend_request_accepted_notify", handleRequestAccepted);
    };
  }, [socket, router]);

  // Load message history when activeChatFriend updates
  useEffect(() => {
    if (!activeChatFriend) return;
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/chats/${activeChatFriend._id}`);
        const data = await res.json();
        if (data.messages) {
          setChatMessages(data.messages);
        }
      } catch (err) {
        console.error("Error fetching chat history:", err);
      }
    };
    fetchHistory();
  }, [activeChatFriend]);

  // Listen for real-time direct messages
  useEffect(() => {
    if (!socket) return;
    const handleDirectMsg = (msg: any) => {
      if (
        activeChatFriend &&
        (msg.senderId === activeChatFriend._id || msg.receiverId === activeChatFriend._id)
      ) {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: msg.senderId,
            text: msg.text,
            createdAt: msg.createdAt,
          },
        ]);
      }
    };
    socket.on("receive_direct_message", handleDirectMsg);
    return () => {
      socket.off("receive_direct_message", handleDirectMsg);
    };
  }, [socket, activeChatFriend]);

  // Auto-scroll global chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [globalMessages, activeTab]);

  // Auto-scroll direct chat
  useEffect(() => {
    if (directChatEndRef.current) {
      directChatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  const handleSendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directChatInput.trim() || !activeChatFriend) return;

    const text = directChatInput.trim();
    setDirectChatInput("");

    // Optimistically update locally
    const localMsg = {
      sender: currentUserId,
      text,
      createdAt: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, localMsg]);

    try {
      // POST to database
      await fetch(`/api/chats/${activeChatFriend._id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      // Emit over WebSocket
      if (socket) {
        socket.emit("send_direct_message", {
          receiverId: activeChatFriend._id,
          text,
          createdAt: localMsg.createdAt,
        });
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;

    setPendingAdd(true);
    const res = await searchUserProfile(usernameInput);
    setPendingAdd(false);

    if (res?.error) {
      toast.error(res.error, {
        style: { background: "#1a1917", color: "#f87171", border: "1px solid rgba(248,113,113,0.15)" }
      });
    } else if (res?.user) {
      setSearchedUser(res.user);
      setUsernameInput("");
    }
  };

  const handleSendRequestInModal = async (username: string) => {
    setPendingAdd(true);
    const res = await sendFriendRequest(username);
    setPendingAdd(false);

    if (res?.error) {
      toast.error(res.error, {
        style: { background: "#1a1917", color: "#f87171", border: "1px solid rgba(248,113,113,0.15)" }
      });
    } else {
      toast.success(`Friend request sent to @${username}`, {
        style: { background: "#1a1917", color: "#81b64c", border: "1px solid rgba(129,182,76,0.15)" }
      });
      
      // Emit socket notification event before modifying component state
      if (socket && searchedUser) {
        socket.emit("friend_request_notification", { targetUserId: searchedUser._id });
      }
      
      setSearchedUser((prev: any) => prev ? { ...prev, relationship: 'outgoing_request' } : null);
    }
  };

  const handleSendGlobalMsg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;
    socket.emit("global_chat_send", { text: chatInput });
    setChatInput("");
  };

  const handleAccept = async (id: string, name: string) => {
    const res = await acceptFriendRequest(id);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success(`You are now friends with @${name}`);
      
      // Emit socket notification event
      if (socket) {
        socket.emit("friend_request_accepted", { targetUserId: id });
      }
      
      router.refresh();
    }
  };

  const handleReject = async (id: string) => {
    const res = await rejectFriendRequest(id);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success("Request rejected");
      router.refresh();
    }
  };

  const isOnline = (lastSeenStr: string) => {
    const lastSeen = new Date(lastSeenStr).getTime();
    return Date.now() - lastSeen < 5 * 60 * 1000;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden justify-between">
      <Toaster position="top-right" />

      {/* ─── TAB SWITCHERS ─── */}
      <div className="flex bg-[#111010] p-1 rounded-xl border border-white/[0.04] shrink-0">
        <button 
          onClick={() => setActiveTab("social")}
          className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "social" ? "bg-[#81b64c] text-[#0f0e0c]" : "text-[#7a7a6e] hover:text-white"
          }`}
        >
          <UserIcon className="h-3.5 w-3.5" />
          Social
        </button>
        <button 
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "chat" ? "bg-[#81b64c] text-[#0f0e0c]" : "text-[#7a7a6e] hover:text-white"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Global Chat
        </button>
      </div>

      {/* ─── TAB CONTENT AREA ─── */}
      <div className="flex-grow flex flex-col min-h-0 pt-3 overflow-hidden justify-between">
        
        {activeTab === "social" ? (
          <div className="flex-grow flex flex-col min-h-0 space-y-4 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#3a3733 transparent" }}>
            {/* Add Friend Input */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#7a7a6e]">
                Search Profile / Add
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
                      text-xs pl-3 pr-8 py-2 text-white placeholder-[#4a4a44]
                      focus:outline-none focus:border-[#81b64c]/40
                    "
                  />
                  <Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[#4a4a44]" />
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
                  Search
                </button>
              </form>
            </div>

            {/* Friend Requests Incoming */}
            {friendRequests.length > 0 && (
              <div className="space-y-2 shrink-0">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#7a7a6e] flex items-center gap-1.5">
                  <Radio className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                  Requests ({friendRequests.length})
                </h3>
                
                <div className="space-y-1.5">
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
                          <button 
                            onClick={async () => {
                              const res = await searchUserProfile(req.username);
                              if (res.user) setSearchedUser(res.user);
                            }}
                            className="text-xs font-bold text-white hover:text-[#81b64c] block truncate transition-colors text-left"
                          >
                            {req.username}
                          </button>
                          <span className="text-[10px] text-[#7a7a6e] block font-mono leading-none mt-0.5">{req.rating.rapid} Elo</span>
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

            {/* Friends List */}
            <div className="flex-1 flex flex-col space-y-2 min-h-0">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#7a7a6e]">
                Friends ({friends.length})
              </h3>

              {friends.length === 0 ? (
                <div className="flex-grow border border-dashed border-white/[0.06] rounded-2xl flex flex-col items-center justify-center text-center p-6 text-[#4a4a44]">
                  <UserIcon className="h-8 w-8 mb-2 stroke-[1.5]" />
                  <p className="text-xs font-semibold">No friends added yet.</p>
                  <p className="text-[10px] mt-0.5">Search above to find players.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map((friend) => {
                    const online = isOnline(friend.lastSeen);
                    return (
                      <div 
                        key={friend._id}
                        className="bg-[#111010]/40 border border-white/[0.04] p-3 rounded-xl flex items-center justify-between hover:bg-[#111010] transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
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
                            <button 
                              onClick={async () => {
                                const res = await searchUserProfile(friend.username);
                                if (res.user) setSearchedUser(res.user);
                              }}
                              className="text-xs font-bold text-white hover:text-[#81b64c] block truncate transition-colors text-left"
                            >
                              {friend.username}
                            </button>
                            <span className="text-[10px] text-[#7a7a6e] block font-mono">
                              {online ? "Online" : "Offline"} • {friend.rating.rapid} Elo
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => setActiveChatFriend(friend)}
                            className="
                              p-1.5 rounded-lg border border-white/[0.08] hover:border-[#81b64c]/30
                              text-[#a0a09a] hover:text-[#81b64c] hover:bg-[#81b64c]/10
                              transition-all active:scale-[0.95]
                            "
                            title="Chat"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </button>
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ─── TAB 2: GLOBAL CHAT WINDOW ─── */
          <div className="flex-grow flex flex-col min-h-0 justify-between h-full">
            {/* Message log viewport */}
            <div 
              className="flex-grow overflow-y-auto space-y-2 pr-1 mb-2 max-h-[250px]" 
              style={{ scrollbarWidth: "thin", scrollbarColor: "#3a3733 transparent" }}
            >
              {globalMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#4a4a44]">
                  <MessageSquare className="h-8 w-8 mb-2 stroke-[1.5]" />
                  <p className="text-xs font-semibold">No messages in Global Chat.</p>
                  <p className="text-[10px] mt-0.5">Send a message below to start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {globalMessages.map((msg, i) => (
                    <div key={i} className="text-xs text-left bg-white/[0.02] border border-white/[0.03] p-2.5 rounded-xl">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-extrabold text-[#81b64c]">@{msg.sender}</span>
                        <span className="text-[8px] text-[#4a4a44] font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-white leading-relaxed font-medium break-all">{msg.text}</p>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            {/* Message input */}
            <form onSubmit={handleSendGlobalMsg} className="flex gap-1.5 shrink-0 border-t border-white/[0.06] pt-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type global message..."
                maxLength={150}
                className="
                  flex-grow bg-[#111010] border border-white/[0.08] rounded-xl
                  text-xs px-3 py-2 text-white placeholder-[#4a4a44]
                  focus:outline-none focus:border-[#81b64c]/40
                "
              />
              <button
                type="submit"
                className="
                  p-2 rounded-xl bg-[#81b64c] hover:bg-[#90c957]
                  text-[#0f0e0c] font-black transition-all shrink-0 active:scale-[0.95]
                "
              >
                <Send className="h-4.5 w-4.5" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ─── SEARCHED USER PROFILE MODAL ─── */}
      {searchedUser && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1917] border border-white/[0.1] rounded-3xl p-6 max-w-sm w-full space-y-6 shadow-2xl relative text-center">
            
            {/* Close Button */}
            <button 
              onClick={() => setSearchedUser(null)} 
              className="absolute right-4 top-4 text-[#7a7a6e] hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header info */}
            <div className="space-y-3 pt-2">
              <div className="relative w-16 h-16 mx-auto">
                <div className="w-full h-full rounded-2xl bg-[#272522] overflow-hidden border border-white/[0.06] flex items-center justify-center text-3xl">
                  {searchedUser.avatar ? (
                    <img src={searchedUser.avatar} alt={searchedUser.username} className="w-full h-full object-cover" />
                  ) : (
                    "👤"
                  )}
                </div>
                <div className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#1a1917] ${
                  isOnline(searchedUser.lastSeen) ? "bg-green-500 animate-pulse" : "bg-neutral-600"
                }`} />
              </div>

              <div>
                <h3 className="text-lg font-black text-white">@{searchedUser.username}</h3>
                <span className="text-[10px] text-[#7a7a6e] font-bold font-mono">
                  {isOnline(searchedUser.lastSeen) ? "Online" : "Offline"}
                </span>
              </div>
            </div>

            {/* Ratings Overview Grid */}
            <div className="bg-[#111010] p-4 rounded-2xl border border-white/[0.04] space-y-3 text-left">
              <span className="text-[9px] text-[#7a7a6e] font-black uppercase tracking-wider block border-b border-white/[0.03] pb-1">Elo Ratings</span>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div><span className="text-[#7a7a6e]">Rapid:</span> <span className="font-extrabold text-white">{searchedUser.rating.rapid}</span></div>
                <div><span className="text-[#7a7a6e]">Blitz:</span> <span className="font-extrabold text-white">{searchedUser.rating.blitz}</span></div>
                <div><span className="text-[#7a7a6e]">Bullet:</span> <span className="font-extrabold text-white">{searchedUser.rating.bullet}</span></div>
                <div><span className="text-[#7a7a6e]">Puzzle:</span> <span className="font-extrabold text-white">{searchedUser.rating.puzzle}</span></div>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="bg-[#111010] p-4 rounded-2xl border border-white/[0.04] space-y-3 text-left">
              <span className="text-[9px] text-[#7a7a6e] font-black uppercase tracking-wider block border-b border-white/[0.03] pb-1">Game Statistics</span>
              
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                <div className="bg-[#1a1917] p-1.5 rounded-lg">
                  <span className="text-[8px] text-[#7a7a6e] block font-black">W</span>
                  <span className="font-extrabold text-green-400 text-xs">{searchedUser.stats.wins}</span>
                </div>
                <div className="bg-[#1a1917] p-1.5 rounded-lg">
                  <span className="text-[8px] text-[#7a7a6e] block font-black">D</span>
                  <span className="font-extrabold text-amber-500 text-xs">{searchedUser.stats.draws}</span>
                </div>
                <div className="bg-[#1a1917] p-1.5 rounded-lg">
                  <span className="text-[8px] text-[#7a7a6e] block font-black">L</span>
                  <span className="font-extrabold text-red-400 text-xs">{searchedUser.stats.losses}</span>
                </div>
              </div>
              
              <div className="flex justify-between items-center text-[10px] pt-1">
                <span className="text-[#7a7a6e] font-bold">Total Games Played</span>
                <span className="text-white font-black font-mono">
                  {searchedUser.stats.wins + searchedUser.stats.draws + searchedUser.stats.losses}
                </span>
              </div>
            </div>

            {/* Actions button */}
            <div className="pt-2">
              {searchedUser.relationship === 'self' && (
                <div className="py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white font-extrabold text-xs">
                  This is you
                </div>
              )}
              
              {searchedUser.relationship === 'friend' && (
                <div className="flex gap-2">
                  <Link
                    href={`/play?challenge=${searchedUser.username}`}
                    onClick={() => setSearchedUser(null)}
                    className="flex-grow py-3 bg-[#81b64c] hover:bg-[#90c957] text-[#0f0e0c] font-black text-xs rounded-xl transition-all"
                  >
                    Challenge Player
                  </Link>
                  <button
                    onClick={() => {
                      const friendObj = friends.find((f) => f._id === searchedUser._id);
                      if (friendObj) {
                        setActiveChatFriend(friendObj);
                      } else {
                        setActiveChatFriend({
                          _id: searchedUser._id,
                          username: searchedUser.username,
                          avatar: searchedUser.avatar,
                          rating: searchedUser.rating,
                          lastSeen: searchedUser.lastSeen || new Date().toISOString(),
                        });
                      }
                      setSearchedUser(null);
                    }}
                    className="px-4 py-3 bg-white/[0.05] hover:bg-[#81b64c]/10 border border-white/[0.08] hover:border-[#81b64c]/30 text-[#a0a09a] hover:text-[#81b64c] font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                  >
                    <MessageSquare className="h-4 w-4" /> Message
                  </button>
                </div>
              )}

              {searchedUser.relationship === 'outgoing_request' && (
                <div className="py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-extrabold text-xs">
                  Friend Request Pending
                </div>
              )}

              {searchedUser.relationship === 'incoming_request' && (
                <div className="space-y-2">
                  <p className="text-[10px] text-amber-400 font-semibold">User has sent you a friend request</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        handleAccept(searchedUser._id, searchedUser.username);
                        setSearchedUser(null);
                      }}
                      className="flex-grow py-2.5 bg-[#81b64c] hover:bg-[#90c957] text-[#0f0e0c] font-black text-xs rounded-xl transition-all"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => {
                        handleReject(searchedUser._id);
                        setSearchedUser(null);
                      }}
                      className="flex-grow py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-extrabold text-xs rounded-xl border border-red-500/20 transition-all"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )}

              {searchedUser.relationship === 'none' && (
                <button
                  onClick={() => handleSendRequestInModal(searchedUser.username)}
                  className="w-full py-3 bg-[#81b64c] hover:bg-[#90c957] text-[#0f0e0c] font-black text-xs rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Send Friend Request
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ─── DIRECT CHAT OVERLAY PANEL ─── */}
      {activeChatFriend && (
        <div className="absolute inset-0 bg-[#151413] z-40 flex flex-col overflow-hidden transition-all duration-300">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-white/[0.06] bg-[#111010]/80 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button 
                onClick={() => setActiveChatFriend(null)}
                className="p-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-[#7a7a6e] hover:text-white transition-all mr-0.5 active:scale-[0.95]"
              >
                <X className="h-4 w-4" />
              </button>
              
              <div className="relative shrink-0">
                <div className="h-7 w-7 rounded-lg bg-[#272522] overflow-hidden border border-white/[0.05] flex items-center justify-center">
                  <img 
                    src={activeChatFriend.avatar || "https://www.chess.com/bundles/web/images/user-image.007dad08.svg"} 
                    alt={activeChatFriend.username}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div 
                  className={`
                    absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#1a1917]
                    ${isOnline(activeChatFriend.lastSeen) ? "bg-green-500 animate-pulse" : "bg-neutral-600"}
                  `}
                />
              </div>

              <div className="min-w-0 text-left">
                <h4 className="text-xs font-black text-white truncate">@{activeChatFriend.username}</h4>
                <span className="text-[9px] text-[#7a7a6e] font-mono leading-none block mt-0.5">
                  {isOnline(activeChatFriend.lastSeen) ? "Online" : "Offline"}
                </span>
              </div>
            </div>

            <Link
              href={`/play?challenge=${activeChatFriend.username}`}
              onClick={() => setActiveChatFriend(null)}
              className="
                px-2.5 py-1 rounded-lg bg-[#81b64c] hover:bg-[#90c957]
                text-[9px] font-black text-[#0f0e0c] transition-all active:scale-[0.95]
              "
            >
              Play
            </Link>
          </div>

          {/* Messages view */}
          <div 
            className="flex-grow overflow-y-auto p-3 space-y-2"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#3a3733 transparent" }}
          >
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#4a4a44]">
                <MessageSquare className="h-7 w-7 mb-2 stroke-[1.5]" />
                <p className="text-xs font-semibold">No messages yet.</p>
                <p className="text-[10px] mt-0.5">Say hello to @{activeChatFriend.username}!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {chatMessages.map((msg, i) => {
                  const isMe = msg.sender === currentUserId;
                  return (
                    <div 
                      key={i} 
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`
                          text-xs p-2.5 rounded-2xl max-w-[85%] text-left
                          ${isMe 
                            ? 'bg-[#81b64c]/20 border border-[#81b64c]/20 text-white rounded-tr-none' 
                            : 'bg-white/[0.04] border border-white/[0.04] text-white rounded-tl-none'}
                        `}
                      >
                        <p className="leading-relaxed font-medium break-all">{msg.text}</p>
                        <span className="text-[8px] text-[#7a7a6e] block text-right font-mono mt-1 leading-none">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={directChatEndRef} />
              </div>
            )}
          </div>

          {/* Send Input */}
          <form onSubmit={handleSendDirectMessage} className="p-2.5 border-t border-white/[0.06] bg-[#111010]/50 flex gap-1.5 shrink-0">
            <input
              type="text"
              value={directChatInput}
              onChange={(e) => setDirectChatInput(e.target.value)}
              placeholder="Type message..."
              maxLength={500}
              className="
                flex-grow bg-[#111010] border border-white/[0.08] rounded-xl
                text-xs px-3 py-2 text-white placeholder-[#4a4a44]
                focus:outline-none focus:border-[#81b64c]/40
              "
            />
            <button
              type="submit"
              className="
                p-2 rounded-xl bg-[#81b64c] hover:bg-[#90c957]
                text-[#0f0e0c] font-black transition-all shrink-0 active:scale-[0.95]
              "
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
