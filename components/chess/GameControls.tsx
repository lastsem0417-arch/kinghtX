type Props = {
  onUndo: () => void;
  onReset: () => void;
  onFlip: () => void;
  onCopyPGN: () => void;
};

const UndoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7v6h6" />
    <path d="M3 13C5.4 7.8 11 4 17 5.5a9 9 0 0 1 0 17" />
  </svg>
);

const ResetIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

const FlipIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 16V4m0 0L3 8m4-4l4 4" />
    <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
  </svg>
);

const PGNIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export default function GameControls({
  onUndo,
  onReset,
  onFlip,
  onCopyPGN,
}: Props) {
  const controls = [
    { label: "Undo", action: onUndo, Icon: UndoIcon, title: "Undo last move" },
    { label: "Reset", action: onReset, Icon: ResetIcon, title: "New game" },
    { label: "Flip", action: onFlip, Icon: FlipIcon, title: "Flip board" },
    { label: "PGN", action: onCopyPGN, Icon: PGNIcon, title: "Copy PGN", accent: true },
  ];

  return (
    <div className="flex items-center justify-center gap-1.5 px-3 py-2">
      {controls.map((control) => (
        <button
          key={control.label}
          onClick={control.action}
          title={control.title}
          className={`
            flex items-center gap-1.5 px-4 py-2 rounded-[4px]
            text-[12px] font-bold
            transition-all duration-150 active:scale-95 select-none
            ${
              control.accent
                ? "bg-[#81b64c] text-white hover:brightness-110"
                : "bg-[#272522] text-[#b0aea8] hover:bg-[#302e2b] hover:text-white border border-white/[0.06]"
            }
          `}
        >
          <control.Icon />
          <span>{control.label}</span>
        </button>
      ))}
    </div>
  );
}