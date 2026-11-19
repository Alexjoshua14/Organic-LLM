import type { BlogArtId } from "@/lib/blog/posts";

import styles from "./blog-card.module.css";

/**
 * One abstract line drawing per post. They are marks of identity, not charts: nothing here
 * encodes a value, so nothing can be misread as data. Lumen picks out the one element that "is"
 * the post (the live voice ribbon, the open pane, the key). All share a 160x100 viewBox.
 */

/** A smooth curve across the drawing, tapering to nothing at both ends like the live ribbon. */
function ribbonPath(phase: number, amplitude: number, cycles: number): string {
  const steps = 64;
  const points: string[] = [];

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const envelope = Math.sin(Math.PI * t) ** 1.4;
    const x = 12 + t * 136;
    const y = 50 + Math.sin(t * Math.PI * 2 * cycles + phase) * amplitude * envelope;

    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  return points.join(" ");
}

const RIBBON_CURVES = [
  { phase: 0.4, amplitude: 26, cycles: 1.5 },
  { phase: 1.3, amplitude: 20, cycles: 1.5 },
  { phase: 2.2, amplitude: 14, cycles: 1.5 },
] as const;

function Voice() {
  // The voice ribbon: a few quiet curves that cross in the middle, one of them in Lumen.
  return (
    <>
      {RIBBON_CURVES.map((c) => (
        <path
          key={c.phase}
          className={styles.stroke}
          d={ribbonPath(c.phase, c.amplitude, c.cycles)}
        />
      ))}
      <path className={styles.lumen} d={ribbonPath(-0.5, 22, 1.5)} />
    </>
  );
}

function Surfaces() {
  // A rail beside panes; the open pane is the one in Lumen.
  return (
    <>
      <rect className={styles.stroke} height={72} rx={6} width={22} x={16} y={14} />
      <rect className={styles.stroke} height={32} rx={6} width={52} x={46} y={14} />
      <rect className={styles.lumen} height={32} rx={6} width={46} x={104} y={14} />
      <rect className={styles.stroke} height={34} rx={6} width={104} x={46} y={52} />
      <line className={styles.stroke} x1={24} x2={30} y1={28} y2={28} />
      <line className={styles.stroke} x1={24} x2={30} y1={40} y2={40} />
      <line className={styles.lumen} x1={24} x2={30} y1={52} y2={52} />
    </>
  );
}

function Flow() {
  // A message crossing four stations; the last one is the answer arriving.
  const xs = [20, 62, 104, 140];

  return (
    <>
      <path className={styles.stroke} d="M20 62 C40 62 44 32 62 32 S86 66 104 66 S122 38 140 38" />
      {xs.slice(0, 3).map((x, i) => (
        <circle key={x} className={styles.stroke} cx={x} cy={[62, 32, 66][i]} r={5} />
      ))}
      <circle className={styles.lumenFill} cx={140} cy={38} r={5} />
      <path className={styles.lumen} d="M140 38 m-12 -2 a14 14 0 0 1 12 -12" />
    </>
  );
}

function Vault() {
  // A lock; the keyhole is the one thing that is open to you.
  return (
    <>
      <rect className={styles.stroke} height={44} rx={7} width={62} x={49} y={42} />
      <path className={styles.stroke} d="M61 42 V32 a19 19 0 0 1 38 0 V42" />
      <circle className={styles.lumen} cx={80} cy={61} r={5.5} />
      <line className={styles.lumen} x1={80} x2={80} y1={66} y2={75} />
    </>
  );
}

function Memory() {
  // Layers of stored text; the nearest one is the one decrypted for you.
  return (
    <>
      <path className={styles.stroke} d="M20 40 L80 18 L140 40 L80 62 Z" opacity={0.45} />
      <path className={styles.stroke} d="M20 54 L80 32 L140 54 L80 76 Z" opacity={0.7} />
      <path className={styles.lumen} d="M20 68 L80 46 L140 68 L80 90 Z" />
      <circle className={styles.lumenFill} cx={80} cy={68} r={3} />
    </>
  );
}

function Chrome() {
  // A liquid surface: three swells, the top one lit.
  return (
    <>
      <path className={styles.stroke} d="M10 74 C40 56 60 90 90 72 S130 58 150 70" opacity={0.5} />
      <path className={styles.stroke} d="M10 58 C38 40 62 76 92 56 S132 42 150 54" opacity={0.75} />
      <path className={styles.lumen} d="M10 42 C36 24 64 60 94 40 S134 26 150 38" />
      <circle className={styles.lumenFill} cx={94} cy={40} r={3.5} />
    </>
  );
}

function Export() {
  // A card with an arrow leaving it.
  return (
    <>
      <path
        className={styles.stroke}
        d="M62 28 H34 a8 8 0 0 0 -8 8 V76 a8 8 0 0 0 8 8 H74 a8 8 0 0 0 8 -8 V62"
      />
      <line className={styles.lumen} x1={64} x2={128} y1={64} y2={20} />
      <polyline className={styles.lumen} points="100,20 128,20 128,48" />
    </>
  );
}

function Composer() {
  // The message box: a wide rounded bar, a short line of text in it, and Lumen on the send mark.
  return (
    <>
      <rect className={styles.stroke} height={44} rx={14} width={124} x={18} y={34} />
      <line className={styles.stroke} opacity={0.6} x1={32} x2={74} y1={52} y2={52} />
      <line className={styles.stroke} opacity={0.35} x1={32} x2={54} y1={62} y2={62} />
      <circle className={styles.lumen} cx={124} cy={56} r={9} />
      <polyline className={styles.lumen} points="120,59 124,53 128,59" />
    </>
  );
}

function Chat() {
  // Two bubbles, one lit: the reply.
  return (
    <>
      <path
        className={styles.stroke}
        d="M20 24 h58 a8 8 0 0 1 8 8 v14 a8 8 0 0 1 -8 8 H44 l-12 10 v-10 h-12 a8 8 0 0 1 -8 -8 V32 a8 8 0 0 1 8 -8z"
      />
      <rect className={styles.lumen} height={26} rx={8} width={66} x={78} y={52} />
      <line className={styles.stroke} x1={30} x2={64} y1={39} y2={39} />
      <line className={styles.lumen} x1={88} x2={132} y1={65} y2={65} />
    </>
  );
}

function Arcadia() {
  // One orchestrator, four subagents; one is speaking.
  const nodes: Array<[number, number]> = [
    [30, 24],
    [130, 24],
    [30, 78],
    [130, 78],
  ];

  return (
    <>
      {nodes.map(([x, y], i) => (
        <g key={`${x}-${y}`}>
          <line className={styles.stroke} x1={80} x2={x} y1={51} y2={y} />
          <circle className={i === 3 ? styles.lumen : styles.stroke} cx={x} cy={y} r={8} />
        </g>
      ))}
      <circle className={styles.lumenFill} cx={80} cy={51} r={9} />
    </>
  );
}

function Noesis() {
  // Sparks rising from a line of thought.
  return (
    <>
      <path className={styles.stroke} d="M16 76 C48 76 56 58 82 58 S120 50 144 40" />
      {[
        [44, 40],
        [66, 26],
        [100, 30],
        [122, 18],
      ].map(([x, y]) => (
        <path
          key={`${x}-${y}`}
          className={styles.stroke}
          d={`M${x} ${y - 6} v12 M${x - 6} ${y} h12`}
        />
      ))}
      <path className={styles.lumen} d="M144 28 v24 M132 40 h24" />
    </>
  );
}

function Strata() {
  // Rough lines resolving into ordered sections; the middle one is open.
  return (
    <>
      <path className={styles.stroke} d="M16 26 l8 -6 l8 6 l8 -6 l8 6" opacity={0.6} />
      <rect className={styles.stroke} height={14} rx={4} width={96} x={48} y={14} />
      <rect className={styles.lumen} height={22} rx={4} width={96} x={48} y={38} />
      <rect className={styles.stroke} height={14} rx={4} width={96} x={48} y={68} />
      <line className={styles.lumen} x1={58} x2={112} y1={49} y2={49} />
    </>
  );
}

function Rabbit() {
  // A question branching into a tree; one branch is being followed.
  return (
    <>
      <circle className={styles.stroke} cx={24} cy={50} r={6} />
      <path className={styles.stroke} d="M30 50 C52 50 52 26 74 26 M30 50 C52 50 52 74 74 74" />
      <circle className={styles.stroke} cx={80} cy={26} r={6} />
      <circle className={styles.lumen} cx={80} cy={74} r={6} />
      <path
        className={styles.stroke}
        d="M86 26 C108 26 108 14 130 14 M86 26 C108 26 108 38 130 38"
      />
      <path
        className={styles.lumen}
        d="M86 74 C108 74 108 62 130 62 M86 74 C108 74 108 86 130 86"
      />
      <circle className={styles.stroke} cx={136} cy={14} r={4} />
      <circle className={styles.stroke} cx={136} cy={38} r={4} />
      <circle className={styles.lumenFill} cx={136} cy={62} r={4} />
    </>
  );
}

function Ergon() {
  // A checklist; the next one is the lit one.
  return (
    <>
      <rect className={styles.stroke} height={14} rx={4} width={14} x={24} y={20} />
      <polyline className={styles.stroke} points="28,27 32,31 38,23" />
      <line className={styles.stroke} x1={50} x2={130} y1={27} y2={27} />
      <rect className={styles.lumen} height={14} rx={4} width={14} x={24} y={43} />
      <line className={styles.lumen} x1={50} x2={116} y1={50} y2={50} />
      <rect className={styles.stroke} height={14} rx={4} width={14} x={24} y={66} />
      <line className={styles.stroke} x1={50} x2={124} y1={73} y2={73} />
    </>
  );
}

function Remy() {
  // A plate and a fork; the plate rim is lit.
  return (
    <>
      <circle className={styles.stroke} cx={72} cy={52} r={30} />
      <circle className={styles.lumen} cx={72} cy={52} r={20} />
      <line className={styles.stroke} x1={120} x2={120} y1={20} y2={84} />
      <path className={styles.stroke} d="M112 20 v16 a8 8 0 0 0 16 0 V20" />
    </>
  );
}

const ART: Record<BlogArtId, () => React.JSX.Element> = {
  voice: Voice,
  surfaces: Surfaces,
  flow: Flow,
  vault: Vault,
  memory: Memory,
  chrome: Chrome,
  export: Export,
  composer: Composer,
  chat: Chat,
  arcadia: Arcadia,
  noesis: Noesis,
  strata: Strata,
  rabbit: Rabbit,
  ergon: Ergon,
  remy: Remy,
};

export function BlogArt({ id }: { id: BlogArtId }) {
  const Drawing = ART[id];

  return (
    <span aria-hidden className={styles.artZone}>
      <svg className={styles.art} fill="none" viewBox="0 0 160 100">
        <Drawing />
      </svg>
    </span>
  );
}
