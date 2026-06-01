type Props = {
  history: string[];
};

export default function MoveHistory({ history }: Props) {
  const times = [
    "0.1s","2.2s","0.5s","1.6s","2.7s","3.7s","2.1s","2.8s","1.5s","5.0s",
    "0.3s","1.1s","0.8s","2.0s","1.2s","3.1s","0.9s","2.4s","1.7s","4.2s",
  ];

  return (
    <div className="w-full">
      {history.length === 0 ? (
        <div className="text-[#6e6a66] text-[12px] px-3 py-4 text-center">
          No moves yet
        </div>
      ) : (
        <table className="w-full border-collapse">
          <tbody>
            {Array.from({
              length: Math.ceil(history.length / 2),
            }).map((_, index) => {
              const whiteMove = history[index * 2];
              const blackMove = history[index * 2 + 1];
              const isLastPair = index === Math.ceil(history.length / 2) - 1;

              return (
                <tr
                  key={index}
                  className={`
                    group border-b border-white/[0.04] transition-colors
                    ${isLastPair ? "bg-[#2c2a27]" : "hover:bg-[#272522]"}
                  `}
                >
                  {/* Move number */}
                  <td className="w-[32px] text-right pr-2 py-[5px] pl-3 text-[12px] font-semibold text-[#5e5b57] select-none">
                    {index + 1}
                  </td>

                  {/* White move */}
                  <td className="py-[5px] px-2 w-1/2">
                    <div className="flex items-center gap-1">
                      <span className="text-[13px] font-semibold text-[#e8e6d9] hover:text-white cursor-pointer transition-colors">
                        {whiteMove || ""}
                      </span>
                      {whiteMove && (
                        <span className="text-[10px] text-[#4e4b47] ml-auto">
                          {times[index * 2] || "0.1s"}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Black move */}
                  <td className="py-[5px] px-2 w-1/2">
                    {blackMove && (
                      <div className="flex items-center gap-1">
                        <span className="text-[13px] font-semibold text-[#b0aea8] hover:text-white cursor-pointer transition-colors">
                          {blackMove}
                        </span>
                        <span className="text-[10px] text-[#4e4b47] ml-auto">
                          {times[index * 2 + 1] || "0.1s"}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}