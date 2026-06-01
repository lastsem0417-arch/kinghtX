import Link from "next/link";

type PlayerCardProps = {
  name: string;
  rating: number;
  avatar?: string;
  time: string;
  active?: boolean;
  side?: "top" | "bottom";
  username?: string; // Optional username for clickable profile links
  capturedPieces?: string[]; // E.g. ['p', 'p', 'n']
  capturedColor?: "w" | "b"; // Color of the captured pieces (the opponent's pieces)
  materialAdvantage?: number; // Material score difference, e.g. 3 (stands for +3)
};

const pieceSymbols: Record<string, string> = {
  black_p: "♟",
  black_n: "♞",
  black_b: "♝",
  black_r: "♜",
  black_q: "♛",
  white_p: "♙",
  white_n: "♘",
  white_b: "♗",
  white_r: "♖",
  white_q: "♕",
};

export default function PlayerCard({
  name,
  rating,
  avatar,
  time,
  active,
  side = "bottom",
  username,
  capturedPieces,
  capturedColor = "b",
  materialAdvantage,
}: PlayerCardProps) {
  // Sort pieces by standard order: Pawns, Knights, Bishops, Rooks, Queens
  const order = { p: 1, n: 2, b: 3, r: 4, q: 5 };
  const sortedCaptured = capturedPieces 
    ? [...capturedPieces].sort((a, b) => (order[a as keyof typeof order] || 0) - (order[b as keyof typeof order] || 0))
    : [];

  return (
    <div
      className={`
        w-full flex items-center justify-between gap-2
        px-3 py-[7px]
        transition-all duration-200
        ${active ? "bg-[#272522]" : "bg-[#1e1c1a]"}
      `}
    >
      {/* Left: avatar + info */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="relative flex-shrink-0">
          {username ? (
            <Link href={`/profile/${username}`} className="block hover:opacity-85 transition-opacity">
              <div
                className={`
                  h-9 w-9 overflow-hidden rounded-sm
                  ring-1
                  ${active ? "ring-green-500/50" : "ring-white/10"}
                  bg-[#161412]
                `}
              >
                <img
                  src={
                    avatar ||
                    "https://www.chess.com/bundles/web/images/user-image.007dad08.svg"
                  }
                  alt={name}
                  className="h-full w-full object-cover"
                />
              </div>
            </Link>
          ) : (
            <div
              className={`
                h-9 w-9 overflow-hidden rounded-sm
                ring-1
                ${active ? "ring-green-500/50" : "ring-white/10"}
                bg-[#161412]
              `}
            >
              <img
                src={
                  avatar ||
                  "https://www.chess.com/bundles/web/images/user-image.007dad08.svg"
                }
                alt={name}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          {/* Online indicator */}
          <span
            className={`
              absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[#1e1c1a]
              ${active ? "bg-green-400" : "bg-gray-600"}
            `}
          />
        </div>

        <div className="min-w-0">
          {username ? (
            <Link
              href={`/profile/${username}`}
              className="text-[13px] font-bold text-white hover:text-[#81b64c] transition-colors leading-tight truncate max-w-[130px] block"
            >
              {name}
            </Link>
          ) : (
            <div className="text-[13px] font-bold text-white leading-tight truncate max-w-[130px]">
              {name}
            </div>
          )}
          
          <div className="text-[11px] text-[#7a7a6e] font-medium leading-tight flex items-center gap-1.5 mt-0.5 select-none">
            <span>{rating}</span>
            {sortedCaptured.length > 0 && (
              <div className="flex items-center gap-0.5 ml-1">
                {sortedCaptured.map((p, idx) => {
                  const symbol = pieceSymbols[`${capturedColor === "w" ? "white" : "black"}_${p.toLowerCase()}`];
                  return (
                    <span 
                      key={idx} 
                      className={`text-xs leading-none ${capturedColor === "w" ? "text-white/60" : "text-[#7a7a6e]/90"}`}
                    >
                      {symbol}
                    </span>
                  );
                })}
                {materialAdvantage && materialAdvantage > 0 ? (
                  <span className="text-[9px] font-black text-green-400 ml-1">
                    +{materialAdvantage}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Timer */}
      <div
        className={`
          shrink-0 rounded-[4px] min-w-[88px] text-center
          tabular-nums font-black text-[22px] tracking-tight leading-none
          px-3 py-[5px]
          transition-all duration-300
          ${
            active
              ? "bg-[#e8e6d9] text-[#181614] shadow-[0_0_12px_rgba(232,230,217,0.15)]"
              : "bg-[#302e2b] text-[#8a8880]"
          }
        `}
      >
        {time}
      </div>
    </div>
  );
}