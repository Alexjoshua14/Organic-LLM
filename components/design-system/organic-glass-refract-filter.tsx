/**
 * Static glass refraction. The working glass lab uses the default backdrop reference;
 * GlassBackdrop supplies a unique ID and gentler parameters for filtering owned content.
 */
export function OrganicGlassRefractFilterSvg({
  id = "organic-glass-refract",
  baseFrequency = 0.012,
  scale = 14,
  softness = 2.5,
}: {
  id?: string;
  baseFrequency?: number;
  scale?: number;
  softness?: number;
} = {}) {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute h-0 w-0 overflow-hidden"
      height="0"
      style={{ position: "absolute" }}
      width="0"
    >
      <filter height="100%" id={id} width="100%" x="0%" y="0%">
        <feTurbulence
          baseFrequency={baseFrequency}
          numOctaves="2"
          result="noise"
          seed="4"
          type="fractalNoise"
        />
        <feGaussianBlur in="noise" result="softNoise" stdDeviation={softness} />
        <feDisplacementMap
          in="SourceGraphic"
          in2="softNoise"
          scale={scale}
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}
