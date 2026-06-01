type Props = {
  onUndo: () => void;
  onReset: () => void;
  onFlip: () => void;
  onCopyPGN: () => void;
};

export default function GameControls({
  onUndo,
  onReset,
  onFlip,
  onCopyPGN,
}: Props) {

  const controls = [
    {
      label: "Undo",
      action: onUndo,
    },

    {
      label: "Reset",
      action: onReset,
    },

    {
      label: "Flip",
      action: onFlip,
    },

    {
      label: "Copy PGN",
      action: onCopyPGN,
    },
  ];

  return (

    <div className="grid grid-cols-2 gap-4 mt-8">

      {controls.map((control) => (

        <button
          key={control.label}
          onClick={control.action}
          className="py-4 rounded-2xl bg-[#262421] hover:bg-[#312E2B] border border-white/10 transition-all duration-300 font-semibold text-lg"
        >

          {control.label}

        </button>

      ))}

    </div>

  );

}