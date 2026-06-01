type Props = {
  opening: string;
  mode: string;
};

export default function MatchInfo({
  opening,
  mode,
}: Props) {

  return (

    <div className="p-5 border-b border-white/10 space-y-2">

      <div className="flex items-center justify-between">

        <span className="text-gray-400">
          Opening
        </span>

        <span className="text-white font-semibold">
          {opening}
        </span>

      </div>

      <div className="flex items-center justify-between">

        <span className="text-gray-400">
          Mode
        </span>

        <span className="text-green-400 font-semibold">
          {mode}
        </span>

      </div>

    </div>

  );

}