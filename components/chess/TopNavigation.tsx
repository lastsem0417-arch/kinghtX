export default function TopNavigation() {

  const items = [
    "Play",
    "New Game",
    "Games",
    "Players",
  ];

  return (

    <div className="grid grid-cols-4 border-b border-white/10">

      {items.map((item, index) => (

        <button
          key={index}
          className={`py-5 text-lg font-semibold transition-all ${
            index === 0
              ? "bg-[#312E2B] text-white"
              : "text-gray-400 hover:bg-[#312E2B]"
          }`}
        >

          {item}

        </button>

      ))}

    </div>

  );

}