export default function NewGamePanel() {

  const sections = [
    {
      title: "Bullet",
      modes: ["1 min", "1 | 1", "2 | 1"],
    },

    {
      title: "Blitz",
      modes: ["3 min", "3 | 2", "5 min"],
    },

    {
      title: "Rapid",
      modes: ["10 min", "15 | 10", "30 min"],
    },
  ];

  return (

    <div className="space-y-6">

      {sections.map((section) => (

        <div key={section.title}>

          <h2 className="text-xl font-bold mb-3 text-green-400">
            {section.title}
          </h2>

          <div className="grid grid-cols-3 gap-3">

            {section.modes.map((mode) => (

              <button
                key={mode}
                className="py-4 rounded-2xl bg-[#1E1D1A] hover:bg-[#312E2B] border border-white/10 transition-all font-semibold"
              >

                {mode}

              </button>

            ))}

          </div>

        </div>

      ))}

      <button className="w-full py-5 rounded-2xl bg-green-500 hover:bg-green-400 transition-all text-2xl font-bold text-black mt-6">

        Start Game

      </button>

    </div>

  );

}