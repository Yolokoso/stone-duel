import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshStandardMaterial, type Group } from "three";
import type { Color as Side, PieceSymbol } from "chess.js";

type Mats = {
  stone: MeshStandardMaterial;
  cloth: MeshStandardMaterial;
  metal: MeshStandardMaterial;
  eye: MeshStandardMaterial;
};

let matsCache: Record<Side, Mats> | null = null;

function getMats(color: Side): Mats {
  if (!matsCache) {
    matsCache = {
      w: {
        stone: new MeshStandardMaterial({ color: "#f3eee4", roughness: 0.46, metalness: 0.05 }),
        cloth: new MeshStandardMaterial({ color: "#e4d8c8", roughness: 0.74, metalness: 0.02 }),
        metal: new MeshStandardMaterial({ color: "#6a6158", roughness: 0.36, metalness: 0.46 }),
        eye: new MeshStandardMaterial({
          color: "#2c241c",
          roughness: 0.4,
          emissive: "#b08a58",
          emissiveIntensity: 0.4,
        }),
      },
      b: {
        stone: new MeshStandardMaterial({ color: "#3a3942", roughness: 0.4, metalness: 0.32 }),
        cloth: new MeshStandardMaterial({ color: "#221f26", roughness: 0.68, metalness: 0.1 }),
        metal: new MeshStandardMaterial({ color: "#d5cfc4", roughness: 0.32, metalness: 0.52 }),
        eye: new MeshStandardMaterial({
          color: "#1a140e",
          roughness: 0.35,
          emissive: "#e2b86a",
          emissiveIntensity: 0.65,
        }),
      },
    };
  }
  return matsCache[color];
}

function Breath({ offset, children }: { offset: number; children: ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    const group = ref.current;
    if (!group) return;
    const t = clock.elapsedTime;
    group.position.y = Math.sin(t * 1.7 + offset) * 0.012;
    group.rotation.y = Math.sin(t * 0.65 + offset) * 0.045;
  });
  return <group ref={ref}>{children}</group>;
}

function Footing({ mats }: { mats: Mats }) {
  return (
    <mesh position={[0, 0.04, 0]} castShadow material={mats.metal}>
      <cylinderGeometry args={[0.28, 0.32, 0.08, 8]} />
    </mesh>
  );
}

function PawnMesh({ mats }: { mats: Mats }) {
  return (
    <group>
      <Footing mats={mats} />
      <mesh position={[-0.07, 0.2, 0]} castShadow material={mats.cloth}>
        <boxGeometry args={[0.09, 0.24, 0.1]} />
      </mesh>
      <mesh position={[0.07, 0.2, 0]} castShadow material={mats.cloth}>
        <boxGeometry args={[0.09, 0.24, 0.1]} />
      </mesh>
      <mesh position={[-0.07, 0.1, -0.02]} castShadow material={mats.metal}>
        <boxGeometry args={[0.1, 0.07, 0.14]} />
      </mesh>
      <mesh position={[0.07, 0.1, -0.02]} castShadow material={mats.metal}>
        <boxGeometry args={[0.1, 0.07, 0.14]} />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow material={mats.stone}>
        <boxGeometry args={[0.24, 0.26, 0.16]} />
      </mesh>
      <mesh position={[0, 0.32, 0.09]} material={mats.cloth}>
        <boxGeometry args={[0.16, 0.2, 0.05]} />
      </mesh>
      <mesh position={[0, 0.32, -0.09]} material={mats.metal}>
        <boxGeometry args={[0.22, 0.05, 0.02]} />
      </mesh>
      <mesh position={[0, 0.66, 0]} castShadow material={mats.stone}>
        <sphereGeometry args={[0.12, 14, 12]} />
      </mesh>
      <mesh position={[0, 0.74, 0]} castShadow material={mats.metal}>
        <sphereGeometry args={[0.125, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
      </mesh>
      <mesh position={[-0.045, 0.66, -0.11]} material={mats.eye}>
        <boxGeometry args={[0.04, 0.028, 0.03]} />
      </mesh>
      <mesh position={[0.045, 0.66, -0.11]} material={mats.eye}>
        <boxGeometry args={[0.04, 0.028, 0.03]} />
      </mesh>
      <mesh position={[0.18, 0.44, 0]} castShadow material={mats.metal}>
        <boxGeometry args={[0.05, 0.3, 0.2]} />
      </mesh>
      <mesh position={[0.18, 0.3, 0]} material={mats.stone}>
        <boxGeometry args={[0.055, 0.06, 0.22]} />
      </mesh>
      <group position={[-0.14, 0.46, -0.02]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow material={mats.metal}>
          <cylinderGeometry args={[0.018, 0.02, 0.56, 6]} />
        </mesh>
        <mesh position={[0, 0, -0.32]} rotation={[-Math.PI / 2, 0, 0]} castShadow material={mats.metal}>
          <coneGeometry args={[0.045, 0.12, 6]} />
        </mesh>
      </group>
    </group>
  );
}

function RookMesh({ mats }: { mats: Mats }) {
  return (
    <group>
      <Footing mats={mats} />
      <mesh position={[-0.1, 0.18, 0]} castShadow material={mats.stone}>
        <boxGeometry args={[0.12, 0.2, 0.14]} />
      </mesh>
      <mesh position={[0.1, 0.18, 0]} castShadow material={mats.stone}>
        <boxGeometry args={[0.12, 0.2, 0.14]} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow material={mats.stone}>
        <boxGeometry args={[0.42, 0.48, 0.32]} />
      </mesh>
      <mesh position={[0, 0.52, -0.17]} material={mats.cloth}>
        <boxGeometry args={[0.2, 0.16, 0.02]} />
      </mesh>
      <mesh position={[-0.05, 0.55, -0.185]} material={mats.eye}>
        <boxGeometry args={[0.05, 0.04, 0.02]} />
      </mesh>
      <mesh position={[0.05, 0.55, -0.185]} material={mats.eye}>
        <boxGeometry args={[0.05, 0.04, 0.02]} />
      </mesh>
      <mesh position={[0, 0.46, -0.185]} material={mats.metal}>
        <boxGeometry args={[0.08, 0.025, 0.02]} />
      </mesh>
      <mesh position={[-0.26, 0.46, 0]} castShadow material={mats.stone}>
        <boxGeometry args={[0.1, 0.28, 0.14]} />
      </mesh>
      <mesh position={[0.26, 0.46, 0]} castShadow material={mats.stone}>
        <boxGeometry args={[0.1, 0.28, 0.14]} />
      </mesh>
      <mesh position={[0, 0.4, -0.22]} rotation={[0, 0, Math.PI / 2]} castShadow material={mats.metal}>
        <cylinderGeometry args={[0.045, 0.045, 0.52, 8]} />
      </mesh>
      {[-0.14, 0, 0.14].map((x) => (
        <mesh key={x} position={[x, 0.84, 0]} castShadow material={mats.metal}>
          <boxGeometry args={[0.1, 0.16, 0.32]} />
        </mesh>
      ))}
    </group>
  );
}

function KnightMesh({ mats }: { mats: Mats }) {
  const hooves = [
    [-0.09, -0.16],
    [0.09, -0.16],
    [-0.09, 0.16],
    [0.09, 0.16],
  ] as const;
  return (
    <group>
      <Footing mats={mats} />
      <mesh position={[0, 0.34, 0.02]} castShadow material={mats.stone}>
        <boxGeometry args={[0.22, 0.18, 0.48]} />
      </mesh>
      {hooves.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.16, z]} castShadow material={mats.metal}>
          <boxGeometry args={[0.07, 0.2, 0.08]} />
        </mesh>
      ))}
      <mesh position={[0, 0.48, -0.2]} rotation={[0.8, 0, 0]} castShadow material={mats.stone}>
        <boxGeometry args={[0.12, 0.2, 0.12]} />
      </mesh>
      <mesh position={[0, 0.58, -0.34]} castShadow material={mats.stone}>
        <boxGeometry args={[0.12, 0.12, 0.22]} />
      </mesh>
      <mesh position={[-0.045, 0.68, -0.32]} material={mats.stone}>
        <boxGeometry args={[0.035, 0.08, 0.035]} />
      </mesh>
      <mesh position={[0.045, 0.68, -0.32]} material={mats.stone}>
        <boxGeometry args={[0.035, 0.08, 0.035]} />
      </mesh>
      <mesh position={[0, 0.56, -0.42]} material={mats.eye}>
        <boxGeometry args={[0.07, 0.025, 0.02]} />
      </mesh>
      <mesh position={[0, 0.42, 0.28]} rotation={[0.9, 0, 0]} material={mats.cloth}>
        <boxGeometry args={[0.05, 0.2, 0.05]} />
      </mesh>
      <mesh position={[0, 0.56, 0]} castShadow material={mats.cloth}>
        <boxGeometry args={[0.16, 0.18, 0.12]} />
      </mesh>
      <mesh position={[0, 0.74, -0.02]} castShadow material={mats.stone}>
        <sphereGeometry args={[0.08, 12, 10]} />
      </mesh>
      <mesh position={[0, 0.82, -0.02]} castShadow material={mats.metal}>
        <coneGeometry args={[0.09, 0.14, 8]} />
      </mesh>
      <mesh position={[-0.03, 0.74, -0.09]} material={mats.eye}>
        <boxGeometry args={[0.025, 0.02, 0.02]} />
      </mesh>
      <mesh position={[0.03, 0.74, -0.09]} material={mats.eye}>
        <boxGeometry args={[0.025, 0.02, 0.02]} />
      </mesh>
      <mesh position={[0.12, 0.62, -0.16]} rotation={[-1.15, 0.05, 0]} castShadow material={mats.metal}>
        <cylinderGeometry args={[0.02, 0.02, 0.78, 6]} />
      </mesh>
    </group>
  );
}

function BishopMesh({ mats }: { mats: Mats }) {
  return (
    <group>
      <Footing mats={mats} />
      <mesh position={[0, 0.42, 0]} castShadow material={mats.cloth}>
        <cylinderGeometry args={[0.12, 0.24, 0.62, 10]} />
      </mesh>
      <mesh position={[0, 0.48, -0.1]} material={mats.metal}>
        <boxGeometry args={[0.08, 0.42, 0.03]} />
      </mesh>
      <mesh position={[0, 0.7, 0.08]} material={mats.cloth}>
        <boxGeometry args={[0.14, 0.28, 0.04]} />
      </mesh>
      <mesh position={[0, 0.74, 0]} castShadow material={mats.stone}>
        <boxGeometry args={[0.28, 0.1, 0.14]} />
      </mesh>
      <mesh position={[0, 0.88, 0]} castShadow material={mats.stone}>
        <sphereGeometry args={[0.09, 12, 10]} />
      </mesh>
      <mesh position={[-0.035, 0.89, -0.08]} material={mats.eye}>
        <boxGeometry args={[0.03, 0.025, 0.02]} />
      </mesh>
      <mesh position={[0.035, 0.89, -0.08]} material={mats.eye}>
        <boxGeometry args={[0.03, 0.025, 0.02]} />
      </mesh>
      <mesh position={[0, 1.08, 0]} rotation={[0, Math.PI / 4, 0]} castShadow material={mats.metal}>
        <coneGeometry args={[0.11, 0.32, 4]} />
      </mesh>
      <mesh position={[0.16, 0.55, -0.02]} castShadow material={mats.metal}>
        <cylinderGeometry args={[0.018, 0.022, 0.78, 6]} />
      </mesh>
      <mesh position={[0.16, 0.96, -0.02]} rotation={[Math.PI / 2, 0, 0]} material={mats.metal}>
        <torusGeometry args={[0.055, 0.014, 6, 10, Math.PI]} />
      </mesh>
    </group>
  );
}

function QueenMesh({ mats }: { mats: Mats }) {
  const spikes = [0, 1, 2, 3, 4, 5].map((i) => {
    const angle = (i / 6) * Math.PI * 2;
    return [Math.cos(angle) * 0.1, Math.sin(angle) * 0.1] as const;
  });
  return (
    <group>
      <Footing mats={mats} />
      <mesh position={[0, 0.4, 0]} castShadow material={mats.cloth}>
        <cylinderGeometry args={[0.14, 0.28, 0.58, 12]} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow material={mats.stone}>
        <boxGeometry args={[0.2, 0.18, 0.12]} />
      </mesh>
      <mesh position={[0, 0.68, 0.08]} material={mats.cloth}>
        <boxGeometry args={[0.16, 0.32, 0.04]} />
      </mesh>
      <mesh position={[0, 0.92, 0]} castShadow material={mats.stone}>
        <sphereGeometry args={[0.09, 14, 12]} />
      </mesh>
      <mesh position={[0, 0.9, 0.08]} material={mats.cloth}>
        <sphereGeometry args={[0.07, 10, 8]} />
      </mesh>
      <mesh position={[-0.032, 0.93, -0.08]} material={mats.eye}>
        <boxGeometry args={[0.028, 0.022, 0.02]} />
      </mesh>
      <mesh position={[0.032, 0.93, -0.08]} material={mats.eye}>
        <boxGeometry args={[0.028, 0.022, 0.02]} />
      </mesh>
      <mesh position={[0, 1.02, 0]} material={mats.metal}>
        <cylinderGeometry args={[0.1, 0.1, 0.05, 10]} />
      </mesh>
      {spikes.map(([x, z], i) => (
        <mesh key={i} position={[x, 1.14, z]} castShadow material={mats.metal}>
          <coneGeometry args={[0.035, 0.18, 5]} />
        </mesh>
      ))}
      <mesh position={[-0.16, 0.62, -0.04]} castShadow material={mats.metal}>
        <cylinderGeometry args={[0.016, 0.016, 0.55, 6]} />
      </mesh>
      <mesh position={[-0.16, 0.92, -0.04]} material={mats.metal}>
        <sphereGeometry args={[0.045, 8, 8]} />
      </mesh>
    </group>
  );
}

function KingMesh({ mats }: { mats: Mats }) {
  return (
    <group>
      <Footing mats={mats} />
      <mesh position={[-0.08, 0.2, 0]} castShadow material={mats.cloth}>
        <boxGeometry args={[0.1, 0.24, 0.12]} />
      </mesh>
      <mesh position={[0.08, 0.2, 0]} castShadow material={mats.cloth}>
        <boxGeometry args={[0.1, 0.24, 0.12]} />
      </mesh>
      <mesh position={[0, 0.48, 0]} castShadow material={mats.stone}>
        <boxGeometry args={[0.3, 0.32, 0.16]} />
      </mesh>
      <mesh position={[0, 0.42, 0.1]} material={mats.cloth}>
        <boxGeometry args={[0.22, 0.36, 0.06]} />
      </mesh>
      <mesh position={[-0.2, 0.5, 0]} castShadow material={mats.stone}>
        <boxGeometry args={[0.1, 0.22, 0.12]} />
      </mesh>
      <mesh position={[0.2, 0.5, 0]} castShadow material={mats.stone}>
        <boxGeometry args={[0.1, 0.22, 0.12]} />
      </mesh>
      <mesh position={[0, 0.76, 0]} castShadow material={mats.stone}>
        <sphereGeometry args={[0.1, 14, 12]} />
      </mesh>
      <mesh position={[0, 0.7, -0.08]} material={mats.cloth}>
        <boxGeometry args={[0.08, 0.08, 0.04]} />
      </mesh>
      <mesh position={[-0.038, 0.78, -0.09]} material={mats.eye}>
        <boxGeometry args={[0.032, 0.024, 0.02]} />
      </mesh>
      <mesh position={[0.038, 0.78, -0.09]} material={mats.eye}>
        <boxGeometry args={[0.032, 0.024, 0.02]} />
      </mesh>
      <mesh position={[0, 0.9, 0]} material={mats.metal}>
        <cylinderGeometry args={[0.11, 0.12, 0.07, 10]} />
      </mesh>
      <mesh position={[0, 1.08, 0]} castShadow material={mats.metal}>
        <boxGeometry args={[0.05, 0.28, 0.05]} />
      </mesh>
      <mesh position={[0, 1.16, 0]} castShadow material={mats.metal}>
        <boxGeometry args={[0.22, 0.05, 0.05]} />
      </mesh>
      <mesh position={[0.22, 0.42, -0.06]} castShadow material={mats.metal}>
        <boxGeometry args={[0.035, 0.46, 0.035]} />
      </mesh>
      <mesh position={[0.22, 0.66, -0.06]} material={mats.metal}>
        <boxGeometry args={[0.1, 0.035, 0.035]} />
      </mesh>
    </group>
  );
}

const MODELS: Record<PieceSymbol, (props: { mats: Mats }) => ReactNode> = {
  p: PawnMesh,
  r: RookMesh,
  n: KnightMesh,
  b: BishopMesh,
  q: QueenMesh,
  k: KingMesh,
};

export function PieceModel({ type, color }: { type: PieceSymbol; color: Side }) {
  const mats = getMats(color);
  const offset = useMemo(() => Math.random() * Math.PI * 2, []);
  const Model = MODELS[type];
  return (
    <Breath offset={offset}>
      <group scale={1.18}>
        <Model mats={mats} />
      </group>
    </Breath>
  );
}
