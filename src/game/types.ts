import type { Color, PieceSymbol, Square } from "chess.js";

export type LivePiece = {
  id: string;
  type: PieceSymbol;
  color: Color;
  square: Square;
  dying: boolean;
};

export type MotionKind = "move" | "attack" | "die";

export type Motion = {
  id: string;
  kind: MotionKind;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  yaw: number;
  t: number;
  dur: number;
  burst: boolean;
  knockX: number;
  knockZ: number;
  tint: "w" | "b";
};

export type Hint = {
  to: Square;
  capture: boolean;
};

export type Phase = "play" | "anim" | "think" | "over";
export type SeatMode = "hotseat" | "solo";
