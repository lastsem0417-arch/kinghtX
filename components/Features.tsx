import {
  FaChessKnight,
  FaRobot,
  FaBolt,
  FaTrophy,
} from "react-icons/fa";

const features = [
  {
    icon: <FaChessKnight size={30} />,
    title: "Real Multiplayer",
    desc: "Battle players worldwide in real-time.",
  },
  {
    icon: <FaRobot size={30} />,
    title: "AI Coach",
    desc: "Get personalized chess improvement plans.",
  },
  {
    icon: <FaBolt size={30} />,
    title: "Unlimited Analysis",
    desc: "Analyze games with powerful chess engines.",
  },
  {
    icon: <FaTrophy size={30} />,
    title: "Competitive Rankings",
    desc: "Climb leaderboards and improve your Elo.",
  },
];

export default function Features() {
  return (
    <section className="px-8 py-24">
      <h2 className="text-5xl font-bold text-center mb-16">
        Why KnightX?
      </h2>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
        {features.map((feature, index) => (
          <div
            key={index}
            className="bg-white/5 border border-white/10 rounded-3xl p-8 hover:border-green-400 transition-all duration-300"
          >
            <div className="text-green-400 mb-4">
              {feature.icon}
            </div>

            <h3 className="text-2xl font-bold mb-3">
              {feature.title}
            </h3>

            <p className="text-gray-400">
              {feature.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}