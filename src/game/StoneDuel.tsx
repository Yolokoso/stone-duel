import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Chess, type Move, type Square } from "chess.js";
import { BoxGeometry, CanvasTexture, Color, MeshStandardMaterial, Object3D, PCFShadowMap, type Group, type InstancedMesh, type Points, type PointsMaterial } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { pickAiMove } from "@/game/ai";
import { PieceModel } from "@/game/meshes";
import type { Hint, LivePiece, Motion, Phase, SeatMode } from "@/game/types";

let pieceSeq = 1;

type Pending = {
  id: string;
  square?: Square;
  type?: LivePiece["type"];
  remove?: boolean;
};

function squareXZ(square: Square): [number, number] {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return [file - 3.5, 3.5 - rank];
}

function yawFor(color: LivePiece["color"]): number {
  return color === "w" ? 0 : Math.PI;
}

function spawnPieces(chess: Chess): LivePiece[] {
  const pieces: LivePiece[] = [];
  const board = chess.board();
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank]?.[file];
      if (!piece) continue;
      const square = `${String.fromCharCode(97 + file)}${8 - rank}` as Square;
      pieces.push({
        id: `${square}-${piece.color}${piece.type}-${pieceSeq++}`,
        type: piece.type,
        color: piece.color,
        square,
        dying: false,
      });
    }
  }
  return pieces;
}

function castleRook(move: Move): { from: Square; to: Square } | null {
  const rank = move.from[1] ?? "1";
  if (move.isKingsideCastle()) return { from: `h${rank}` as Square, to: `f${rank}` as Square };
  if (move.isQueensideCastle()) return { from: `a${rank}` as Square, to: `d${rank}` as Square };
  return null;
}

function enPassantSquare(move: Move): Square {
  const file = move.to[0] ?? "a";
  const rank = Number(move.to[1]);
  const victimRank = move.color === "w" ? rank - 1 : rank + 1;
  return `${file}${victimRank}` as Square;
}

let audioCtx: AudioContext | null = null;

function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") void audioCtx.resume();
}

function playClash() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(196, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.22);
  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.3);
}

function labelTexture(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new CanvasTexture(canvas);
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "600 64px Outfit, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 68);
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function describe(chess: Chess, phase: Phase, mode: SeatMode) {
  if (chess.isCheckmate()) {
    const winner = chess.turn() === "w" ? "Obsidian" : "Ivory";
    return { title: `${winner} wins`, detail: "Checkmate." };
  }
  if (chess.isStalemate()) return { title: "Stalemate", detail: "Drawn. The king is not in check." };
  if (chess.isDraw()) return { title: "Draw", detail: "Neither side can force a win." };
  if (phase === "anim") return { title: "Figures clash", detail: "The taken piece shatters." };
  if (phase === "think") return { title: "Obsidian thinks", detail: "A reply is on the way." };
  const side = chess.turn() === "w" ? "Ivory" : "Obsidian";
  const check = chess.inCheck() ? " In check." : "";
  const seat =
    mode === "solo"
      ? chess.turn() === "w"
        ? "You play ivory."
        : "Obsidian replies."
      : "Pass the seat after each move.";
  return { title: `${side} to move`, detail: `${seat}${check}` };
}

function PieceBody({
  piece,
  registry,
  onSquare,
}: {
  piece: LivePiece;
  registry: RefObject<Record<string, Group | null>>;
  onSquare: (square: Square) => void;
}) {
  const ref = useRef<Group>(null);

  useLayoutEffect(() => {
    const group = ref.current;
    if (!group || !registry.current) return;
    registry.current[piece.id] = group;
    const [x, z] = squareXZ(piece.square);
    group.position.set(x, 0, z);
    group.rotation.set(0, yawFor(piece.color), 0);
    group.scale.setScalar(1);
    return () => {
      if (registry.current[piece.id] === group) registry.current[piece.id] = null;
    };
  }, [piece.color, piece.id, piece.square, piece.type, registry]);

  return (
    <group
      ref={ref}
      onClick={(event) => {
        event.stopPropagation();
        onSquare(piece.square);
      }}
    >
      <PieceModel type={piece.type} color={piece.color} />
    </group>
  );
}

function BoardControls({ whiteNear }: { whiteNear: boolean }) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const set = useThree((state) => state.set);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 7;
    controls.maxDistance = 22;
    controls.maxPolarAngle = Math.PI / 2.08;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;
    set({ controls });
    return () => {
      controlsRef.current = null;
      set({ controls: null });
      controls.dispose();
    };
  }, [camera, gl, set]);

  useEffect(() => {
    camera.position.set(0, 8.8, whiteNear ? 9.8 : -9.8);
    camera.lookAt(0, 0, 0);
    const controls = controlsRef.current;
    if (!controls) return;
    controls.target.set(0, 0, 0);
    controls.update();
  }, [camera, whiteNear]);

  useFrame(() => {
    controlsRef.current?.update();
  });

  return null;
}

const SPARK_COUNT = 36;
const RUBBLE = 14;
const STRIKE = 0.68;

type Bit = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  spin: number;
  sx: number;
  sy: number;
  sz: number;
  life: number;
};

function Scene({
  pieces,
  hints,
  selected,
  lastSquares,
  whiteNear,
  motionsRef,
  shakeRef,
  finishRef,
  onSquare,
}: {
  pieces: LivePiece[];
  hints: Hint[];
  selected: Square | null;
  lastSquares: Square[];
  whiteNear: boolean;
  motionsRef: RefObject<Motion[]>;
  shakeRef: RefObject<number>;
  finishRef: RefObject<() => void>;
  onSquare: (square: Square) => void;
}) {
  const registry = useRef<Record<string, Group | null>>({});
  const boardRef = useRef<Group>(null);
  const pointsRef = useRef<Points>(null);
  const rubbleRef = useRef<InstancedMesh>(null);
  const bits = useRef<Bit[]>([]);
  const dummy = useMemo(() => new Object3D(), []);
  const rubbleGeo = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const rubbleMat = useMemo(() => new MeshStandardMaterial({ roughness: 0.55, metalness: 0.08 }), []);
  const sparkPos = useRef(new Float32Array(SPARK_COUNT * 3));
  const sparkVel = useRef(new Float32Array(SPARK_COUNT * 3));
  const sparkLife = useRef(0);
  const labels = useMemo(
    () => ({
      files: "abcdefgh".split("").map((ch) => labelTexture(ch)),
      ranks: "12345678".split("").map((ch) => labelTexture(ch)),
    }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = rubbleRef.current;
    if (!mesh) return;
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    for (let i = 0; i < RUBBLE; i++) mesh.setMatrixAt(i, dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = 0;
  }, [dummy]);

  const burst = useCallback(
    (x: number, z: number, tint: "w" | "b") => {
      for (let i = 0; i < SPARK_COUNT; i++) {
        sparkPos.current[i * 3] = x + (Math.random() - 0.5) * 0.2;
        sparkPos.current[i * 3 + 1] = 0.45 + Math.random() * 0.35;
        sparkPos.current[i * 3 + 2] = z + (Math.random() - 0.5) * 0.2;
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.1 + Math.random() * 2.4;
        sparkVel.current[i * 3] = Math.cos(angle) * speed;
        sparkVel.current[i * 3 + 1] = 1.8 + Math.random() * 2.8;
        sparkVel.current[i * 3 + 2] = Math.sin(angle) * speed;
      }
      sparkLife.current = 0.7;
      const attr = pointsRef.current?.geometry.getAttribute("position");
      if (attr) attr.needsUpdate = true;
      const pointsMat = pointsRef.current?.material;
      if (pointsMat && !Array.isArray(pointsMat)) {
        const mat = pointsMat as PointsMaterial;
        mat.opacity = 1;
        mat.color.set(tint === "w" ? "#f4efe6" : "#c8c2ba");
      }

      const mesh = rubbleRef.current;
      const pale = tint === "w";
      bits.current = Array.from({ length: RUBBLE }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.8 + Math.random() * 2.6;
        const size = 0.09 + Math.random() * 0.11;
        return {
          x,
          y: 0.3 + Math.random() * 0.5,
          z,
          vx: Math.cos(angle) * speed,
          vy: 1.8 + Math.random() * 2.6,
          vz: Math.sin(angle) * speed,
          rx: Math.random() * Math.PI,
          ry: Math.random() * Math.PI,
          rz: Math.random() * Math.PI,
          spin: 3 + Math.random() * 7,
          sx: size,
          sy: size * (0.55 + Math.random()),
          sz: size * (0.55 + Math.random()),
          life: 1,
        };
      });
      if (mesh) {
        mesh.count = RUBBLE;
        for (let i = 0; i < RUBBLE; i++) {
          const chip = i % 2 === 0;
          mesh.setColorAt(i, new Color(pale ? (chip ? "#f3eee4" : "#c9bba6") : chip ? "#4a4852" : "#8d8794"));
        }
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      shakeRef.current = 0.18;
      playClash();
    },
    [shakeRef],
  );

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.1);
    if (sparkLife.current > 0) {
      sparkLife.current = Math.max(0, sparkLife.current - step);
      for (let i = 0; i < SPARK_COUNT; i++) {
        sparkVel.current[i * 3 + 1] -= step * 6;
        sparkPos.current[i * 3] += sparkVel.current[i * 3] * step;
        sparkPos.current[i * 3 + 1] += sparkVel.current[i * 3 + 1] * step;
        sparkPos.current[i * 3 + 2] += sparkVel.current[i * 3 + 2] * step;
      }
      const attr = pointsRef.current?.geometry.getAttribute("position");
      if (attr) attr.needsUpdate = true;
      if (pointsRef.current) {
        const material = pointsRef.current.material;
        if (!Array.isArray(material)) material.opacity = sparkLife.current / 0.6;
      }
    }

    const mesh = rubbleRef.current;
    const alive = bits.current;
    if (mesh && alive.length) {
      let any = false;
      for (let i = 0; i < alive.length; i++) {
        const bit = alive[i];
        if (!bit || bit.life <= 0) {
          dummy.position.set(0, -4, 0);
          dummy.scale.set(0, 0, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          continue;
        }
        any = true;
        bit.life -= step * 0.8;
        bit.vy -= step * 9;
        bit.x += bit.vx * step;
        bit.y += bit.vy * step;
        bit.z += bit.vz * step;
        if (bit.y < 0.05 && bit.vy < 0) {
          bit.y = 0.05;
          bit.vy *= -0.3;
          bit.vx *= 0.45;
          bit.vz *= 0.45;
        }
        bit.rx += bit.spin * step;
        bit.ry += bit.spin * 0.55 * step;
        const fade = bit.life < 0.3 ? Math.max(0, bit.life / 0.3) : 1;
        dummy.position.set(bit.x, bit.y, bit.z);
        dummy.rotation.set(bit.rx, bit.ry, bit.rz);
        dummy.scale.set(bit.sx * fade, bit.sy * fade, bit.sz * fade);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (!any) {
        bits.current = [];
        mesh.count = 0;
      }
    }

    if (boardRef.current) {
      if (shakeRef.current > 0.001) {
        shakeRef.current *= Math.pow(0.04, step);
        boardRef.current.position.x = Math.sin(performance.now() * 0.05) * shakeRef.current;
      } else {
        boardRef.current.position.x = 0;
      }
    }

    const motions = motionsRef.current;
    if (motions.length === 0) return;

    for (const motion of motions) {
      motion.t += step / motion.dur;
      const u = Math.min(1, motion.t);
      const group = registry.current[motion.id];
      if (!group) continue;

      if (motion.kind === "die") {
        if (u < STRIKE) {
          const brace = Math.sin(u * 46) * (u / STRIKE) * 0.03;
          group.position.set(motion.x0 + brace, 0, motion.z0);
          group.rotation.set(0, motion.yaw + brace * 2, 0);
          group.scale.setScalar(1);
        } else {
          const s = (u - STRIKE) / (1 - STRIKE);
          const len = Math.hypot(motion.knockX, motion.knockZ) || 1;
          const fly = Math.sin(Math.min(s, 1) * Math.PI) * 0.42;
          group.position.set(
            motion.x0 + (motion.knockX / len) * s * 0.62,
            fly,
            motion.z0 + (motion.knockZ / len) * s * 0.62,
          );
          group.rotation.set(s * 1.7, motion.yaw + s * 1.4, s * 1.15);
          group.scale.setScalar(Math.max(0.01, 1 - s * 1.25));
          if (!motion.burst && s > 0.04) {
            motion.burst = true;
            burst(motion.x0, motion.z0, motion.tint);
          }
        }
      } else if (motion.kind === "attack") {
        const s = u < STRIKE ? 0 : (u - STRIKE) / (1 - STRIKE);
        const travel =
          u < STRIKE
            ? (1 - (1 - u / STRIKE) ** 3) * 0.84
            : 0.84 + Math.sin(s * Math.PI) * 0.26 + s * 0.16;
        const bob =
          u < STRIKE ? Math.abs(Math.sin((u / STRIKE) * Math.PI * 3)) * 0.08 : Math.sin(s * Math.PI) * 0.06;
        group.position.set(
          motion.x0 + (motion.x1 - motion.x0) * travel,
          bob,
          motion.z0 + (motion.z1 - motion.z0) * travel,
        );
        group.scale.setScalar(1);
        group.rotation.set(u < STRIKE ? -0.22 : -0.22 - Math.sin(s * Math.PI) * 0.7, motion.yaw, 0);
      } else {
        const eased = 1 - (1 - u) ** 2;
        const bob = Math.abs(Math.sin(u * Math.PI * 2)) * 0.07;
        group.position.set(
          motion.x0 + (motion.x1 - motion.x0) * eased,
          bob,
          motion.z0 + (motion.z1 - motion.z0) * eased,
        );
        group.scale.setScalar(1);
        group.rotation.set(-0.14, motion.yaw, Math.sin(u * Math.PI * 2) * 0.1);
      }
    }

    if (motions.every((motion) => motion.t >= 1)) {
      for (const motion of motions) {
        const group = registry.current[motion.id];
        if (!group || motion.kind === "die") continue;
        group.position.set(motion.x1, 0, motion.z1);
        group.rotation.set(0, motion.yaw, 0);
        group.scale.setScalar(1);
      }
      motionsRef.current = [];
      finishRef.current();
    }
  });

  const hintMap = useMemo(() => new Map(hints.map((hint) => [hint.to, hint.capture])), [hints]);

  return (
    <>
      <color attach="background" args={["#101114"]} />
      <ambientLight intensity={0.42} />
      <hemisphereLight args={["#f7f4ee", "#2a2824", 0.42]} />
      <directionalLight
        position={[6, 14, 8]}
        intensity={2.15}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
        shadow-camera-near={2}
        shadow-camera-far={40}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
      />
      <directionalLight position={[-7, 9, -4]} intensity={0.55} color="#d9d3c8" />
      <BoardControls whiteNear={whiteNear} />

      <group ref={boardRef}>
        <mesh position={[0, -0.28, 0]} receiveShadow>
          <boxGeometry args={[9.4, 0.36, 9.4]} />
          <meshStandardMaterial color="#161518" roughness={0.86} />
        </mesh>

        {"abcdefgh".split("").map((file, fileIndex) =>
          "12345678".split("").map((rank, rankIndex) => {
            const square = `${file}${rank}` as Square;
            const [x, z] = squareXZ(square);
            const light = (fileIndex + rankIndex) % 2 === 1;
            const capture = hintMap.get(square) === true;
            const quiet = hintMap.get(square) === false;
            const selectedSquare = selected === square;
            const last = lastSquares.includes(square);
            const color = capture
              ? "#8d4a44"
              : quiet
                ? "#8f9a86"
                : selectedSquare
                  ? light
                    ? "#f7f1e4"
                    : "#4a4036"
                  : last
                    ? light
                      ? "#e4d3b0"
                      : "#4d4336"
                    : light
                      ? "#e7e2d6"
                      : "#3c322b";
            return (
              <mesh
                key={square}
                position={[x, -0.1, z]}
                receiveShadow
                onClick={(event) => {
                  event.stopPropagation();
                  onSquare(square);
                }}
              >
                <boxGeometry args={[1, 0.2, 1]} />
                <meshStandardMaterial color={color} roughness={0.78} />
              </mesh>
            );
          }),
        )}

        {labels.files.map((texture, index) => (
          <mesh key={`f${index}`} position={[index - 3.5, 0.02, 4.55]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.46, 0.46]} />
            <meshBasicMaterial map={texture} transparent />
          </mesh>
        ))}
        {labels.ranks.map((texture, index) => (
          <mesh key={`r${index}`} position={[-4.55, 0.02, 3.5 - index]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.46, 0.46]} />
            <meshBasicMaterial map={texture} transparent />
          </mesh>
        ))}

        {pieces.map((piece) => (
          <PieceBody key={piece.id} piece={piece} registry={registry} onSquare={onSquare} />
        ))}
        <instancedMesh ref={rubbleRef} args={[rubbleGeo, rubbleMat, RUBBLE]} frustumCulled={false} />
      </group>

      <points ref={pointsRef} raycast={() => null}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[sparkPos.current, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#f4f4f5" size={0.09} transparent opacity={0} depthWrite={false} />
      </points>
    </>
  );
}

export function StoneDuel() {
  const chessRef = useRef(new Chess());
  const motionsRef = useRef<Motion[]>([]);
  const pendingRef = useRef<Pending[]>([]);
  const shakeRef = useRef(0);
  const finishRef = useRef<() => void>(() => {});
  const commitRef = useRef<(from: Square, to: Square, promotion?: string) => void>(() => {});
  const busyRef = useRef(false);
  const modeRef = useRef<SeatMode>("solo");
  const genRef = useRef(0);
  const piecesRef = useRef<LivePiece[]>([]);
  const selectedRef = useRef<Square | null>(null);
  const hintsRef = useRef<Hint[]>([]);

  const [pieces, setPieces] = useState<LivePiece[]>(() => spawnPieces(chessRef.current));
  const [fen, setFen] = useState(() => chessRef.current.fen());
  const [selected, setSelected] = useState<Square | null>(null);
  const [hints, setHints] = useState<Hint[]>([]);
  const [phase, setPhase] = useState<Phase>("play");
  const [mode, setMode] = useState<SeatMode>("solo");
  const [whiteNear, setWhiteNear] = useState(true);

  piecesRef.current = pieces;
  selectedRef.current = selected;
  hintsRef.current = hints;

  const syncFen = useCallback(() => {
    setFen(chessRef.current.fen());
  }, []);

  const applyPending = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = [];
    setPieces((current) =>
      current.flatMap((piece) => {
        const update = pending.find((item) => item.id === piece.id);
        if (!update) return [piece];
        if (update.remove) return [];
        return [
          {
            ...piece,
            square: update.square ?? piece.square,
            type: update.type ?? piece.type,
            dying: false,
          },
        ];
      }),
    );
  }, []);

  const finishAnim = useCallback(() => {
    applyPending();
    const chess = chessRef.current;
    syncFen();
    if (chess.isGameOver()) {
      busyRef.current = false;
      setPhase("over");
      return;
    }
    if (modeRef.current === "solo" && chess.turn() === "b") {
      setPhase("think");
      const generation = genRef.current;
      window.setTimeout(() => {
        if (genRef.current !== generation) return;
        const move = pickAiMove(chess);
        if (!move) {
          busyRef.current = false;
          setPhase(chess.isGameOver() ? "over" : "play");
          return;
        }
        commitRef.current(move.from, move.to, move.promotion ?? "q");
      }, 240);
      return;
    }
    busyRef.current = false;
    setPhase("play");
  }, [applyPending, syncFen]);

  useEffect(() => {
    finishRef.current = finishAnim;
  }, [finishAnim]);

  const commitMove = useCallback(
    (from: Square, to: Square, promotion = "q") => {
      const chess = chessRef.current;
      const before = piecesRef.current;
      let move: Move;
      try {
        move = chess.move({ from, to, promotion });
      } catch {
        busyRef.current = false;
        setPhase(chess.isGameOver() ? "over" : "play");
        return;
      }

      const mover = before.find((piece) => piece.square === from && !piece.dying);
      if (!mover) {
        chess.undo();
        busyRef.current = false;
        return;
      }

      const motions: Motion[] = [];
      const pending: Pending[] = [];
      const [x0, z0] = squareXZ(from);
      const [x1, z1] = squareXZ(to);
      motions.push({
        id: mover.id,
        kind: move.isCapture() ? "attack" : "move",
        x0,
        z0,
        x1,
        z1,
        yaw: yawFor(mover.color),
        t: 0,
        dur: move.isCapture() ? 1.15 : 0.55,
        burst: false,
        knockX: 0,
        knockZ: 0,
        tint: mover.color,
      });
      pending.push({ id: mover.id, square: to, type: move.promotion ?? mover.type });

      let victimId: string | undefined;
      if (move.isEnPassant()) {
        victimId = before.find((piece) => piece.square === enPassantSquare(move))?.id;
      } else if (move.isCapture()) {
        victimId = before.find((piece) => piece.square === to)?.id;
      }
      if (victimId) {
        const victim = before.find((piece) => piece.id === victimId);
        if (victim) {
          const [vx, vz] = squareXZ(victim.square);
          motions.push({
            id: victim.id,
            kind: "die",
            x0: vx,
            z0: vz,
            x1: vx,
            z1: vz,
            yaw: yawFor(victim.color),
            t: 0,
            dur: 1.15,
            burst: false,
            knockX: x1 - x0,
            knockZ: z1 - z0,
            tint: victim.color,
          });
          pending.push({ id: victim.id, remove: true });
        }
      }

      const rookShift = castleRook(move);
      if (rookShift) {
        const rook = before.find((piece) => piece.square === rookShift.from);
        if (rook) {
          const [rx0, rz0] = squareXZ(rookShift.from);
          const [rx1, rz1] = squareXZ(rookShift.to);
          motions.push({
            id: rook.id,
            kind: "move",
            x0: rx0,
            z0: rz0,
            x1: rx1,
            z1: rz1,
            yaw: yawFor(rook.color),
            t: 0,
            dur: 0.55,
            burst: false,
            knockX: 0,
            knockZ: 0,
            tint: rook.color,
          });
          pending.push({ id: rook.id, square: rookShift.to });
        }
      }

      busyRef.current = true;
      motionsRef.current = motions;
      pendingRef.current = pending;
      setSelected(null);
      setHints([]);
      setPhase("anim");
      syncFen();
    },
    [syncFen],
  );

  useEffect(() => {
    commitRef.current = commitMove;
  }, [commitMove]);

  const onSquare = useCallback((square: Square) => {
    unlockAudio();
    if (busyRef.current) return;
    const chess = chessRef.current;
    if (modeRef.current === "solo" && chess.turn() === "b") return;

    if (selectedRef.current && hintsRef.current.some((hint) => hint.to === square)) {
      commitRef.current(selectedRef.current, square);
      return;
    }

    const piece = chess.get(square);
    if (piece && piece.color === chess.turn()) {
      const moves = chess.moves({ square, verbose: true });
      const seen = new Set<string>();
      const next: Hint[] = [];
      for (const move of moves) {
        if (seen.has(move.to)) continue;
        seen.add(move.to);
        next.push({ to: move.to, capture: move.isCapture() });
      }
      setSelected(square);
      setHints(next);
      return;
    }
    setSelected(null);
    setHints([]);
  }, []);

  const reset = useCallback(
    (nextMode = modeRef.current) => {
      genRef.current += 1;
      motionsRef.current = [];
      pendingRef.current = [];
      busyRef.current = false;
      chessRef.current.reset();
      modeRef.current = nextMode;
      setMode(nextMode);
      setPieces(spawnPieces(chessRef.current));
      setSelected(null);
      setHints([]);
      setPhase("play");
      syncFen();
    },
    [syncFen],
  );

  const undo = useCallback(() => {
    if (busyRef.current) return;
    const chess = chessRef.current;
    if (chess.history().length === 0) return;
    chess.undo();
    if (modeRef.current === "solo" && chess.turn() === "b") chess.undo();
    motionsRef.current = [];
    pendingRef.current = [];
    setPieces(spawnPieces(chess));
    setSelected(null);
    setHints([]);
    setPhase(chess.isGameOver() ? "over" : "play");
    syncFen();
  }, [syncFen]);

  const status = describe(chessRef.current, phase, mode);
  const history = chessRef.current.history({ verbose: true });
  const last = history[history.length - 1];
  const lastSquares = last ? [last.from, last.to] : [];

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-bg text-fg">
      <div className="absolute inset-0 touch-none">
        <Canvas
          shadows="percentage"
          dpr={[1, 2]}
          camera={{ position: [0, 8.8, whiteNear ? 9.8 : -9.8], fov: 30, near: 0.1, far: 80 }}
          gl={{ antialias: true }}
          onCreated={({ gl }) => {
            gl.shadowMap.type = PCFShadowMap;
          }}
          onPointerMissed={() => {
            if (!busyRef.current) {
              setSelected(null);
              setHints([]);
            }
          }}
        >
          <Scene
            pieces={pieces}
            hints={hints}
            selected={selected}
            lastSquares={lastSquares}
            whiteNear={whiteNear}
            motionsRef={motionsRef}
            shakeRef={shakeRef}
            finishRef={finishRef}
            onSquare={onSquare}
          />
        </Canvas>
      </div>

      <div className="safe-bottom pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
        <section className="hud-panel pointer-events-auto w-fit max-w-xs rounded-xl border border-border bg-elev p-4">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Stone Duel</p>
          <h1 className="mt-1 font-display text-2xl leading-tight font-medium text-fg">{status.title}</h1>
          <p className="mt-1 text-sm leading-normal text-muted">{status.detail}</p>
        </section>

        <div className="pointer-events-auto flex flex-wrap gap-2">
          <button
            type="button"
            className="h-11 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
            onClick={() => reset()}
          >
            New game
          </button>
          <button
            type="button"
            className="h-11 rounded-sm border border-border bg-elev px-4 text-sm font-medium text-fg disabled:opacity-40"
            onClick={undo}
            disabled={phase === "anim" || phase === "think"}
          >
            Undo
          </button>
          <button
            type="button"
            className="h-11 rounded-sm border border-border bg-elev px-4 text-sm font-medium text-fg"
            onClick={() => setWhiteNear((value) => !value)}
          >
            Flip view
          </button>
          <button
            type="button"
            aria-pressed={mode === "solo"}
            className="h-11 rounded-sm border border-border bg-elev px-4 text-sm font-medium text-fg"
            onClick={() => reset(mode === "solo" ? "hotseat" : "solo")}
          >
            {mode === "solo" ? "Solo" : "Two seats"}
          </button>
        </div>
      </div>
      <span className="sr-only">{fen}</span>
    </main>
  );
}
