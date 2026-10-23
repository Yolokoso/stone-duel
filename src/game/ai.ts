import { Chess, type Move, type PieceSymbol, type Square } from "chess.js";

const VALUE: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

function evaluate(chess: Chess): number {
  let score = 0;
  const board = chess.board();
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank]?.[file];
      if (!piece) continue;
      let value = VALUE[piece.type];
      if (piece.type === "n" || piece.type === "b") {
        const df = Math.abs(file - 3.5);
        const dr = Math.abs(rank - 3.5);
        value += (7 - df - dr) * 6;
        if (file === 0 || file === 7) value -= 28;
      } else if (piece.type === "p") {
        const df = Math.abs(file - 3.5);
        const dr = Math.abs(rank - 3.5);
        value += (7 - df - dr) * 3;
      }
      score += piece.color === "w" ? value : -value;
    }
  }
  return score;
}

function minimax(chess: Chess, depth: number, alpha: number, beta: number): number {
  if (chess.isCheckmate()) {
    const magnitude = 100000 + depth;
    return chess.turn() === "w" ? -magnitude : magnitude;
  }
  if (chess.isDraw()) return 0;
  if (depth === 0) return evaluate(chess);

  const moves = chess.moves({ verbose: true });
  moves.sort((a, b) => Number(b.isCapture()) - Number(a.isCapture()));
  const maximizing = chess.turn() === "w";

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      chess.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" });
      const value = minimax(chess, depth - 1, alpha, beta);
      chess.undo();
      best = Math.max(best, value);
      alpha = Math.max(alpha, value);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    chess.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" });
    const value = minimax(chess, depth - 1, alpha, beta);
    chess.undo();
    best = Math.min(best, value);
    beta = Math.min(beta, value);
    if (beta <= alpha) break;
  }
  return best;
}

export function pickAiMove(chess: Chess): { from: Square; to: Square; promotion?: string } | null {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;
  const maximizing = chess.turn() === "w";
  let bestScore = maximizing ? -Infinity : Infinity;
  const scored: { move: Move; score: number }[] = [];

  for (const move of moves) {
    chess.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" });
    const score = minimax(chess, 1, -1_000_000_000, 1_000_000_000);
    chess.undo();
    scored.push({ move, score });
    bestScore = maximizing ? Math.max(bestScore, score) : Math.min(bestScore, score);
  }

  const close = scored.filter((entry) => Math.abs(entry.score - bestScore) <= 6);
  const pool = close.length > 0 ? close : scored;
  const choice = pool[Math.floor(Math.random() * pool.length)];
  if (!choice) return null;
  return {
    from: choice.move.from,
    to: choice.move.to,
    promotion: choice.move.promotion,
  };
}
