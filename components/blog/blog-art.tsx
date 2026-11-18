import type { BlogArtId } from "@/lib/blog/posts";

import styles from "./blog-card.module.css";

/**
 * One abstract line drawing per post. They are marks of identity, not charts: nothing here
 * encodes a value, so nothing can be misread as data. Lumen picks out the one element that "is"
 * the post (the live voice, the open pane, the key). All share a 160x100 viewBox.
 */

function Voice() {
  // A spoken waveform: the middle bar is the voice that is being heard right now.
  const bars = [
    { x: 24, h: 14 },
    { x: 38, h: 26 },
    { x: 52, h: 40 },
    { x: 66, h: 22 },
    { x: 94, h: 28 },
    { x: 108, h: 46 },
    { x: 122, h: 24 },
    { x: 136, h: 12 },
  ];

  return (
    <>
      {bars.map((b) => (
        <line
          key={b.x}
          className={styles.stroke}
          x1={b.x}
          x2={b.x}
          y1={50 - b.h / 2}
          y2={50 + b.h / 2}
        />
      ))}
      <line className={styles.lumen} x1={80} x2={80} y1={14} y2={86} />
      <circle className={styles.lumenFill} cx={80} cy={50} r={3.5} />
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
      <path className={styles.stroke} d="M62 28 H34 a8 8 0 0 0 -8 8 V76 a8 8 0 0 0 8 8 H74 a8 8 0 0 0 8 -8 V62" />
      <line className={styles.lumen} x1={64} x2={128} y1={64} y2={20} />
      <polyline className={styles.lumen} points="100,20 128,20 128,48" />
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
