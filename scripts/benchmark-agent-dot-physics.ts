// CPU integration only; this does not measure browser SVG/glass rendering.
import { DotMorphPhysics } from "../components/agents/dot-morph-physics";
import { dotRestScale } from "../components/agents/agent-dot-grid-motion";

const FRAMES = 3000;
const WARMUP = 300;
const percentile = (values: number[], fraction: number) =>
  values[Math.floor((values.length - 1) * fraction)]!;

for (const count of [18, 90, 180, 360]) {
  const dots = Array.from({ length: count }, (_, index) => {
    const dot = new DotMorphPhysics(
      dotRestScale(index % 18, `mark-${Math.floor(index / 18)}`),
      index % 18
    );
    dot.setState("working");
    return dot;
  });
  const samples: number[] = [];
  for (let frame = 0; frame < WARMUP + FRAMES; frame++) {
    const start = performance.now();
    for (const dot of dots) dot.step(1000 / 60);
    if (frame >= WARMUP) samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const checksum = dots.reduce(
    (sum, dot) => sum + dot.current.x + dot.current.y + dot.current.scale,
    0
  );
  if (!Number.isFinite(checksum)) throw new Error("Invalid physics benchmark result");
  console.log(
    JSON.stringify({
      dots: count,
      marks: count / 18,
      medianMs: Number(percentile(samples, 0.5).toFixed(4)),
      p95Ms: Number(percentile(samples, 0.95).toFixed(4)),
      p99Ms: Number(percentile(samples, 0.99).toFixed(4)),
      frameBudgetMs: 1000 / 60,
      checksum: Number(checksum.toFixed(4)),
    })
  );
}
