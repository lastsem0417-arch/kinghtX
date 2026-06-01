"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Gamepad2, 
  Cpu, 
  GraduationCap, 
  Trophy, 
  Activity, 
  Award, 
  User, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Settings
} from "lucide-react";
import { logout } from "@/app/actions/auth";

interface LeftNavbarProps {
  activeUser?: {
    username: string;
    avatar?: string;
    rating?: {
      rapid: number;
    };
  } | null;
}

export default function LeftNavbar({ activeUser }: LeftNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  const navItems = [
    { label: "Play Online", icon: Gamepad2, link: "/play" },
    { label: "Vs Computer", icon: Cpu, link: "/bots" },
    { label: "Coaching", icon: GraduationCap, link: "/coaches" },
    { label: "Puzzles", icon: Trophy, link: "/puzzles" },
    { label: "Analysis Board", icon: Activity, link: "/analysis" },
    { label: "Leaderboards", icon: Award, link: "/leaderboards" },
  ];

  return (
    <aside 
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={`
        bg-[#111010] border-r border-white/[0.04] shrink-0
        flex md:flex-col items-stretch justify-between py-4 px-3
        transition-all duration-300 ease-in-out z-40
        w-full md:h-screen
        ${isExpanded ? "md:w-[220px]" : "md:w-[68px]"}
      `}
    >
      <div className="flex md:flex-col items-stretch gap-6 w-full">
        {/* Brand Logo / Knight */}
        <Link href="/dashboard" className="flex items-center gap-3 px-1 md:mb-2 justify-center md:justify-start">
          <span className="text-[#81b64c] text-3xl font-black shrink-0 leading-none">♞</span>
          {isExpanded && (
            <span className="text-lg font-black tracking-wider text-white select-none animate-fadeIn">
              KNIGHT<span className="text-[#81b64c]">X</span>
            </span>
          )}
        </Link>

        {/* Primary Navigation Links */}
        <nav className="flex flex-row md:flex-col gap-1 w-full justify-center md:justify-start">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.link);
            const Icon = item.icon;

            return (
              <Link
                key={item.label}
                href={item.link}
                title={!isExpanded ? item.label : undefined}
                className={`
                  h-11 flex items-center gap-3 px-3 rounded-xl transition-all duration-150 select-none
                  ${isActive 
                    ? "bg-[#272522] text-[#81b64c] font-black" 
                    : "text-[#7a7a6e] hover:text-white hover:bg-[#1a1917]"}
                  justify-center md:justify-start
                `}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {isExpanded && (
                  <span className="text-xs font-bold tracking-wide truncate animate-fadeIn">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      
      {/* Bottom Profile and Settings Block */}
      <div className="flex md:flex-col gap-2 items-stretch mt-auto">
        {activeUser && (
          <Link 
            href={`/profile/${activeUser.username}`} 
            title={!isExpanded ? `Profile (${activeUser.username})` : undefined}
            className={`
              h-11 flex items-center gap-3 px-2 rounded-xl transition-all duration-150 hover:bg-[#1a1917]
              justify-center md:justify-start
            `}
          >
            <div className="h-8 w-8 rounded-full bg-[#81b64c]/20 ring-1 ring-[#81b64c]/40 overflow-hidden flex items-center justify-center border border-[#81b64c]/30 shrink-0">
              <img
                src={activeUser.avatar || "https://www.chess.com/bundles/web/images/user-image.007dad08.svg"}
                alt="Profile avatar"
                className="h-full w-full object-cover"
              />
            </div>
            {isExpanded && (
              <div className="flex flex-col min-w-0 text-left animate-fadeIn">
                <span className="text-[11px] font-extrabold text-white truncate">@{activeUser.username}</span>
                <span className="text-[9px] text-[#7a7a6e] font-bold">Profile Card</span>
              </div>
            )}
          </Link>
        )}

        {/* Logout Form Action */}
        <form action={logout} className="w-full">
          <button 
            type="submit" 
            title={!isExpanded ? "Log out" : undefined}
            className={`
              w-full h-11 flex items-center gap-3 px-3 rounded-xl transition-all duration-150 text-[#7a7a6e] hover:text-red-400 hover:bg-[#272522]/50
              justify-center md:justify-start
            `}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {isExpanded && (
              <span className="text-xs font-bold tracking-wide animate-fadeIn">
                Log Out
              </span>
            )}
          </button>
        </form>
      </div>

    </aside>
  );
}
