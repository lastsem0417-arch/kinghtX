import { Chess, Square } from 'chess.js';

interface PieceInfo {
  type: string;
  color: 'w' | 'b';
  square: Square;
  x: number;
  y: number;
}

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 100
};

const PIECE_NAMES: Record<string, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King'
};

// Convert algebraic coordinate to 0-7 grid (x = file, y = rank)
// e.g. "a1" -> x = 0, y = 0; "h8" -> x = 7, y = 7
function squareToCoords(square: Square): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97; // 'a' is 97
  const rank = parseInt(square.charAt(1)) - 1; // '1' is 1
  return { x: file, y: rank };
}

// Convert coords back to algebraic square
function coordsToSquare(x: number, y: number): Square {
  const fileStr = String.fromCharCode(97 + x);
  const rankStr = String(y + 1);
  return (fileStr + rankStr) as Square;
}

export function scanTactics(fen: string): string[] {
  const tactics: string[] = [];
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch (err) {
    return [];
  }

  const board = chess.board();
  const pieces: PieceInfo[] = [];

  // Parse all pieces on the board
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        // board row 0 is rank 8 in chess coordinate, row 7 is rank 1
        const x = c;
        const y = 7 - r;
        const square = coordsToSquare(x, y);
        pieces.push({
          type: piece.type,
          color: piece.color,
          square,
          x,
          y
        });
      }
    }
  }

  // Helper to check if coords are within board
  const onBoard = (x: number, y: number) => x >= 0 && x < 8 && y >= 0 && y < 8;

  // Helper to get piece at coords
  const getPieceAt = (x: number, y: number): PieceInfo | null => {
    if (!onBoard(x, y)) return null;
    const sq = coordsToSquare(x, y);
    return pieces.find((p) => p.square === sq) || null;
  };

  // Helper to find attacked squares for a piece
  const getAttackedSquares = (p: PieceInfo): Square[] => {
    const attacked: Square[] = [];
    const { x, y, type, color } = p;

    if (type === 'p') {
      const dy = color === 'w' ? 1 : -1;
      const targets = [
        { x: x - 1, y: y + dy },
        { x: x + 1, y: y + dy }
      ];
      targets.forEach((t) => {
        if (onBoard(t.x, t.y)) {
          attacked.push(coordsToSquare(t.x, t.y));
        }
      });
    } else if (type === 'n') {
      const moves = [
        { dx: 1, dy: 2 }, { dx: 2, dy: 1 },
        { dx: -1, dy: 2 }, { dx: -2, dy: 1 },
        { dx: 1, dy: -2 }, { dx: 2, dy: -1 },
        { dx: -1, dy: -2 }, { dx: -2, dy: -1 }
      ];
      moves.forEach((m) => {
        const tx = x + m.dx;
        const ty = y + m.dy;
        if (onBoard(tx, ty)) {
          attacked.push(coordsToSquare(tx, ty));
        }
      });
    } else if (type === 'k') {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const tx = x + dx;
          const ty = y + dy;
          if (onBoard(tx, ty)) {
            attacked.push(coordsToSquare(tx, ty));
          }
        }
      }
    } else {
      // Sliders (b, r, q)
      const dirs: { dx: number; dy: number }[] = [];
      if (type === 'b' || type === 'q') {
        dirs.push({ dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 });
      }
      if (type === 'r' || type === 'q') {
        dirs.push({ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 });
      }

      dirs.forEach((d) => {
        let tx = x + d.dx;
        let ty = y + d.dy;
        while (onBoard(tx, ty)) {
          attacked.push(coordsToSquare(tx, ty));
          const hit = getPieceAt(tx, ty);
          if (hit) {
            // Stop after hitting first piece (sliders block)
            break;
          }
          tx += d.dx;
          ty += d.dy;
        }
      });
    }

    return attacked;
  };

  // Run over all pieces to find Forks, Pins, Skewers
  pieces.forEach((p) => {
    const oppColor = p.color === 'w' ? 'b' : 'w';
    const activeColorName = p.color === 'w' ? 'White' : 'Black';

    // ─── 1. FORK DETECTION ───
    if (p.type !== 'k') {
      const attackedSquares = getAttackedSquares(p);
      const attackedOpponents: PieceInfo[] = [];

      attackedSquares.forEach((sq) => {
        const hit = pieces.find((opp) => opp.square === sq && opp.color === oppColor);
        if (hit) {
          attackedOpponents.push(hit);
        }
      });

      // Filter targets: Fork should target higher-value pieces or King
      // A pawn can fork two minor pieces. A knight can fork King + Queen.
      // Criteria: We target multiple pieces where at least two are of equal or higher value than the attacker, or one is the King.
      const forkTargets = attackedOpponents.filter((opp) => {
        const attackerVal = PIECE_VALUES[p.type] || 0;
        const targetVal = PIECE_VALUES[opp.type] || 0;
        return targetVal > attackerVal || opp.type === 'k' || opp.type === 'q';
      });

      if (forkTargets.length >= 2) {
        const targetNames = forkTargets.map(t => `${PIECE_NAMES[t.type]} on ${t.square}`).join(' and ');
        tactics.push(
          `${activeColorName} ${PIECE_NAMES[p.type]} on ${p.square} is forking the opponent's ${targetNames}.`
        );
      }
    }

    // ─── 2. PIN & SKEWER DETECTION (Sliders only: b, r, q) ───
    if (p.type === 'b' || p.type === 'r' || p.type === 'q') {
      const dirs: { dx: number; dy: number }[] = [];
      if (p.type === 'b' || p.type === 'q') {
        dirs.push({ dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 });
      }
      if (p.type === 'r' || p.type === 'q') {
        dirs.push({ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 });
      }

      dirs.forEach((d) => {
        let tx = p.x + d.dx;
        let ty = p.y + d.dy;
        
        let firstOpponent: PieceInfo | null = null;
        let secondOpponent: PieceInfo | null = null;
        let blockDetected = false;

        while (onBoard(tx, ty)) {
          const hit = getPieceAt(tx, ty);
          if (hit) {
            if (hit.color === p.color) {
              // Blocked by friendly piece
              blockDetected = true;
              break;
            } else {
              // Encountered opponent piece
              if (!firstOpponent) {
                firstOpponent = hit;
              } else {
                secondOpponent = hit;
                break; // Stop after second opponent
              }
            }
          }
          tx += d.dx;
          ty += d.dy;
        }

        if (!blockDetected && firstOpponent && secondOpponent) {
          const val1 = PIECE_VALUES[firstOpponent.type] || 0;
          const val2 = PIECE_VALUES[secondOpponent.type] || 0;

          // Pin: Front piece is lower value than back piece (or back piece is King)
          if (val1 < val2 || secondOpponent.type === 'k') {
            const pinType = secondOpponent.type === 'k' ? 'absolute pin' : 'relative pin';
            tactics.push(
              `${activeColorName} ${PIECE_NAMES[p.type]} on ${p.square} is pinning the opponent's ${PIECE_NAMES[firstOpponent.type]} on ${firstOpponent.square} to the ${PIECE_NAMES[secondOpponent.type]} on ${secondOpponent.square} (${pinType}).`
            );
          }
          // Skewer: Front piece is higher value than back piece (and front is not pawn/knight skewering king)
          else if (val1 > val2 && firstOpponent.type !== 'p') {
            tactics.push(
              `${activeColorName} ${PIECE_NAMES[p.type]} on ${p.square} is skewering the opponent's ${PIECE_NAMES[firstOpponent.type]} on ${firstOpponent.square}, exposing the ${PIECE_NAMES[secondOpponent.type]} on ${secondOpponent.square}.`
            );
          }
        }
      });
    }
  });

  return tactics;
}
