export interface ChessCoach {
  id: string;
  name: string;
  title: string;
  avatar: string;
  avatarColor: string;
  description: string;
  style: string;
  greetings: string[];
  goodMoveComments: string[];
  blunderComments: string[];
  winPhrases: string[];
  losePhrases: string[];
}

export const CHESS_COACHES: ChessCoach[] = [
  {
    id: "coach_john",
    name: "John",
    title: "Grandmaster Coach",
    avatar: "👴",
    avatarColor: "from-blue-600/20 to-indigo-600/20 text-indigo-400 border-indigo-500/30",
    description: "Serious and deeply positional. John will teach you pawn structures, king safety, and long-term positional coordination.",
    style: "Positional & Classical",
    greetings: [
      "Hello. I am John. Let us focus on building a solid pawn structure and maintaining absolute safety today.",
      "Greetings! Ready to train? Remember: no rush, focus on coordinate control."
    ],
    goodMoveComments: [
      "Excellent. That is a highly mature positional move.",
      "Good. You are controlling the key squares.",
      "Very neat. Solid pawn protection."
    ],
    blunderComments: [
      "Wait! That move compromises your king safety. Can you find a more secure retreat?",
      "Hold on! You left a pawn undefended. Look at your structure again.",
      "Ah, that creates an unnecessary weakness. Try to undo and strengthen your coordinate."
    ],
    winPhrases: [
      "A well-played match. Positional discipline was the key to this victory.",
      "Congratulations. Your control of the center was exemplary."
    ],
    losePhrases: [
      "An interesting struggle. We must look closely at where your coordinate structure failed.",
      "Good effort, but you overextended. Let's try again."
    ]
  },
  {
    id: "coach_sofia",
    name: "Sofia",
    title: "Tactics Coach",
    avatar: "👩‍🚀",
    avatarColor: "from-rose-600/20 to-red-600/20 text-red-400 border-red-500/30",
    description: "Aggressive and highly energetic. Sofia will train your tactical eyes for pins, forks, sacrifices, and double attacks.",
    style: "Tactical & Sharp",
    greetings: [
      "Hi! Sofia here. Let's set some tactical fireworks on the board!",
      "Hey! Let's train your eyes to spot winning combinations!"
    ],
    goodMoveComments: [
      "BOOM! Excellent double-attack!",
      "Beautifully spotted! That is a very sharp move.",
      "Nice! You are putting great pressure on their defense."
    ],
    blunderComments: [
      "Whoa, stop! You walked right into a fork. Can you spot the double-attack threat?",
      "Watch out! That move allows a dangerous pin. Undo and find a safer square.",
      "Wait, that bishop is hanging! Don't give away free pieces. Undo and protect it!"
    ],
    winPhrases: [
      "Superb! Your tactics were absolutely unstoppable!",
      "Yes! That checkmate combination was gorgeous!"
    ],
    losePhrases: [
      "Ah, you missed a critical pin in the middlegame. Let's review the tactics."
    ]
  },
  {
    id: "coach_marcus",
    name: "Marcus",
    title: "Classicist Coach",
    avatar: "👨‍💼",
    avatarColor: "from-teal-600/20 to-emerald-600/20 text-emerald-400 border-emerald-500/30",
    description: "Quiet and logical. Marcus teaches traditional classical opening principles, space advantage, and piece activity.",
    style: "Classical Opening & Space",
    greetings: [
      "Hello my student. Let us practice classical chess principles today.",
      "Welcome. Remember: develop minor pieces, castle early, and control the center."
    ],
    goodMoveComments: [
      "A classic. Perfectly consistent with opening theory.",
      "Very logical. You are activating your pieces correctly.",
      "Splendid. Excellent space advantage."
    ],
    blunderComments: [
      "Wait. That piece is blocking your own development. Let's undo and activate another piece.",
      "Hold on. You are moving the same piece twice in the opening. Develop others instead.",
      "Ah, that allows them to take control of the center. Let's undo and play more actively."
    ],
    winPhrases: [
      "A beautiful textbook game. Your development was superior.",
      "Logic prevails. Well played."
    ],
    losePhrases: [
      "You fell behind in development. Remember: castle early! Let's retry."
    ]
  },
  {
    id: "coach_viktor",
    name: "Viktor",
    title: "Gambit Coach",
    avatar: "👨‍🎤",
    avatarColor: "from-purple-600/20 to-pink-600/20 text-pink-400 border-pink-500/30",
    description: "Wild and aggressive. Viktor loves double-edged positions, sacrifices, and king hunts. He teaches how to attack under pressure.",
    style: "Gambits & Attacking",
    greetings: [
      "Let's play some rock & roll chess! Ready to sacrifice a pawn for a huge attack?",
      "Yeah! Let's make this game fast and aggressive. Don't be afraid to attack!"
    ],
    goodMoveComments: [
      "Rock on! That is an awesome attacking move!",
      "Nice sacrifice! The attack is hitting home.",
      "Exactly! Keep the initiative at all costs."
    ],
    blunderComments: [
      "Wait, no! That was too passive. You gave up the initiative. Undo and keep the attack alive!",
      "Whoops! You left your king completely exposed there. Protect him first!",
      "Ah, that sacrifice was unsound! You're just down material now. Undo and try a better line."
    ],
    winPhrases: [
      "Awesome attack! You crushed their king! Rock on!",
      "What a game! Absolute fire on the board!"
    ],
    losePhrases: [
      "Ah! The attack fizzled out and we got squeezed. Let's try another gambit!"
    ]
  },
  {
    id: "coach_emily",
    name: "Emily",
    title: "Encouraging Tutor",
    avatar: "🧚",
    avatarColor: "from-amber-600/20 to-orange-600/20 text-amber-400 border-amber-500/30",
    description: "Friendly and highly encouraging. Emily gives clear, gentle advice, making chess easy and approachable for everyone.",
    style: "Friendly & Educational",
    greetings: [
      "Hello! I'm so excited to play chess with you today. Don't worry about mistakes, we're here to learn!",
      "Hi there! Let's have a fun match and learn some neat chess tips together."
    ],
    goodMoveComments: [
      "Yay! That is a super smart move!",
      "Perfect! You protected your pieces beautifully.",
      "I love that move! You're doing great."
    ],
    blunderComments: [
      "Oh, sweetie, watch out! Your queen can be captured there. Let's undo and keep her safe!",
      "Wait a moment! You left your rook undefended. Can you find a way to protect it?",
      "Ah, that move leaves a check open. Let's undo and block the check first!"
    ],
    winPhrases: [
      "Hooray! You won! I'm so proud of your progress!",
      "Wonderful job! You played so carefully."
    ],
    losePhrases: [
      "A great try! Every game makes you a better player. Let's play again!"
    ]
  }
];
