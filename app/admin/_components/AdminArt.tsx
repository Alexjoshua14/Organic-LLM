import styles from "./AdminIndex.module.css";

/**
 * One abstract line drawing per admin page. They are marks of identity, not charts: nothing here
 * encodes a value, so nothing can be misread as data. Lumen picks out the one element that
 * "is" the page (the needle, the newest bar, the pulse).
 */

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;

  return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
};

function Gauge() {
  const [ax, ay] = polar(80, 84, 60, 45);
  const [nx, ny] = polar(80, 84, 42, 45);
  const ticks = [180, 150, 120, 90, 60, 30, 0].map((deg) => ({
    a: polar(80, 84, 52, deg),
    b: polar(80, 84, 57, deg),
    deg,
  }));

  return (
    <>
      <path className={styles.stroke} d="M20 84 A60 60 0 0 1 140 84" />
      {ticks.map((t) => (
        <line
          key={t.deg}
          className={styles.stroke}
          x1={t.a[0]}
          x2={t.b[0]}
          y1={t.a[1]}
          y2={t.b[1]}
        />
      ))}
      <path className={styles.lumen} d={`M20 84 A60 60 0 0 1 ${ax.toFixed(1)} ${ay.toFixed(1)}`} />
      <line className={styles.lumen} x1={80} x2={nx} y1={84} y2={ny} />
      <circle className={styles.lumenFill} cx={80} cy={84} r={3.5} />
    </>
  );
}

function Waterfall() {
  const bars = [
    { x: 20, w: 58 },
    { x: 42, w: 84 },
    { x: 66, w: 46 },
    { x: 90, w: 40 },
  ];

  return (
    <>
      {[20, 60, 100, 140].map((x) => (
        <line key={x} className={styles.stroke} opacity={0.4} x1={x} x2={x} y1={14} y2={86} />
      ))}
      {bars.map((b, i) => (
        <rect
          key={b.x}
          className={i === 2 ? styles.lumen : styles.stroke}
          height={9}
          rx={4.5}
          width={b.w}
          x={b.x}
          y={20 + i * 16}
        />
      ))}
    </>
  );
}

function Graph() {
  const nodes = [
    [34, 28],
    [126, 24],
    [42, 78],
    [120, 76],
  ] as const;

  return (
    <>
      {nodes.map(([x, y]) => (
        <line key={`${x}-${y}`} className={styles.stroke} x1={80} x2={x} y1={50} y2={y} />
      ))}
      {nodes.map(([x, y]) => (
        <circle key={`n${x}-${y}`} className={styles.stroke} cx={x} cy={y} r={5} />
      ))}
      <circle
        className={styles.stroke}
        cx={80}
        cy={50}
        r={15}
        opacity={0.5}
        strokeDasharray="2 4"
      />
      <circle className={styles.lumenFill} cx={80} cy={50} r={6.5} />
    </>
  );
}

function Columns() {
  const heights = [18, 28, 22, 40, 34, 54];

  return (
    <>
      <line className={styles.stroke} x1={14} x2={146} y1={86} y2={86} />
      {heights.map((h, i) => (
        <rect
          key={i}
          className={i === heights.length - 1 ? styles.lumenFill : styles.stroke}
          height={h}
          rx={4}
          width={12}
          x={22 + i * 21}
          y={86 - h}
        />
      ))}
    </>
  );
}

function Pulse() {
  return (
    <>
      <path
        className={styles.stroke}
        d="M10 54 H46 L54 54 L62 30 L73 78 L84 42 L90 54 H118"
        opacity={0.9}
      />
      <path className={styles.lumen} d="M118 54 H150" />
      <circle className={styles.lumenFill} cx={150} cy={54} r={4} />
      <circle className={styles.stroke} cx={150} cy={54} r={9} opacity={0.5} />
    </>
  );
}

function Envelope() {
  return (
    <>
      <rect className={styles.stroke} height={58} rx={9} width={100} x={30} y={28} />
      <path className={styles.stroke} d="M32 36 L80 64 L128 36" />
      <circle className={styles.lumenFill} cx={80} cy={64} r={5.5} />
    </>
  );
}

const ART: Record<string, () => React.JSX.Element> = {
  performance: Gauge,
  "thread-reference-performance": Waterfall,
  "memory-quality": Graph,
  usage: Columns,
  heartbeats: Pulse,
  invites: Envelope,
};

/** A page without a drawing of its own simply has none: the card still works. */
export function AdminArt({ slug }: { slug: string }) {
  const Drawing = ART[slug];

  if (!Drawing) return null;

  return (
    <svg aria-hidden className={styles.art} focusable="false" viewBox="0 0 160 100">
      <Drawing />
    </svg>
  );
}
