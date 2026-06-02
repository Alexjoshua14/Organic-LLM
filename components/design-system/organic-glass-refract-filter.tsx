/**
 * SVG filter referenced by `organicGlassWorking` backdrop-filter (url(#organic-glass-refract)).
 * Mount once per document subtree that uses the working organic glass material.
 */
export function OrganicGlassRefractFilterSvg() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute h-0 w-0 overflow-hidden"
      height="0"
      style={{ position: "absolute" }}
      width="0"
    >
      <filter height="100%" id="organic-glass-refract" width="100%" x="0%" y="0%">
        <feTurbulence
          baseFrequency="0.012"
          numOctaves="2"
          result="noise"
          seed="4"
          type="fractalNoise"
        />
        <feGaussianBlur in="noise" result="softNoise" stdDeviation="2.5" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="softNoise"
          scale="14"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}
