/**
 * Live LiquidChrome backgrounds, published for renderers that need to reproduce them.
 *
 * The voice bar's FluidGlass refracts the background behind it. WebGL cannot sample the page, but
 * LiquidChrome is itself a shader, so the glass re-renders the same field for its own patch of
 * screen. To match pixel-for-pixel it needs the background's *live* state — theme tint, warp
 * parameters, pause state, canvas size — not a guess at it.
 *
 * LiquidChrome registers its actual uniform objects here. Mirrors read them each frame and never
 * write them, so publishing costs the background nothing per frame.
 */

type NumberUniform = { value: number };
type VectorUniform = { value: ArrayLike<number> };

export type LiquidChromeUniforms = {
  uTime: NumberUniform;
  /** Device pixels; `[width, height, aspect]`. */
  uResolution: VectorUniform;
  uBaseColor: VectorUniform;
  uAmplitude: NumberUniform;
  uFrequencyX: NumberUniform;
  uFrequencyY: NumberUniform;
  uMouse: VectorUniform;
  uMultiSample: NumberUniform;
};

export type LiquidChromeSource = {
  /** The element the chrome canvas fills. Its client rect maps field UV space to the screen. */
  element: HTMLElement;
  /** Live uniform objects. Read-only for mirrors. */
  uniforms: LiquidChromeUniforms;
  /**
   * Whether the frame loop is running. While it runs the field's phase is a pure function of the
   * clock (`performance.now() × 0.001 × speed`); while paused it holds at `uniforms.uTime`.
   */
  isRunning: () => boolean;
  getSpeed: () => number;
};

const sources: LiquidChromeSource[] = [];

/** Returns an unregister function; call it when the background unmounts. */
export function registerLiquidChromeSource(source: LiquidChromeSource): () => void {
  sources.push(source);

  return () => {
    const index = sources.indexOf(source);

    if (index !== -1) sources.splice(index, 1);
  };
}

/**
 * The background a mirror should reproduce: the most recently mounted one still in the document.
 * Pages render one LiquidChrome; during a route transition the incoming page's registers last.
 */
export function getActiveLiquidChromeSource(): LiquidChromeSource | null {
  for (let i = sources.length - 1; i >= 0; i--) {
    const source = sources[i]!;

    if (source.element.isConnected) return source;
  }

  return null;
}

/**
 * The field phase a mirror should render *now*. Computed from the clock rather than copied from
 * the uniform, because the background writes `uTime` once per its own frame and the mirror renders
 * on a different cadence — reading the stale uniform would lag the page by up to a frame.
 */
export function liquidChromePhaseAt(source: LiquidChromeSource, nowMs: number): number {
  return source.isRunning() ? nowMs * 0.001 * source.getSpeed() : source.uniforms.uTime.value;
}

/** Test-only: forget every registration. */
export function resetLiquidChromeSourcesForTests(): void {
  sources.length = 0;
}
