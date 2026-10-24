import { PAPER_INK_MATERIAL } from "./liquid-chrome-material";

/**
 * The LiquidChrome field, as GLSL shared by every renderer that draws it.
 *
 * Two renderers draw this field: the page background (`LiquidChrome`, ogl) and the voice bar's
 * FluidGlass mirror (three), which re-renders the patch of background sitting behind the bar so
 * the glass can refract it. A mirror is only a mirror if the maths is identical, so neither
 * renderer owns a copy — both interpolate these strings. Change the field here and both follow.
 *
 * Uniform contract (names and meaning are load-bearing; mirrors read them by name):
 * - `uTime`        field phase; LiquidChrome sets it to `rAF ms × 0.001 × speed`
 * - `uResolution`  canvas size in device pixels, and aspect in `.z`
 * - `uBaseColor`   chrome tint, or paper colour when `uPaperInk` is enabled
 * - `uPaperInk`    0 keeps the original chrome field; 1 selects the light-mode material
 * - `uPixelRatio`  canvas pixels per CSS pixel; anchors the paper texture at a stable scale
 * - `uAmplitude`, `uFrequencyX`, `uFrequencyY`  warp parameters
 * - `uMouse`       ripple centre in the field's own UV space (y up)
 * - `uMultiSample` > 0.5 averages a 3×3 kernel before the write
 */
export const LIQUID_CHROME_UNIFORMS_GLSL = /* glsl */ `
  uniform float uTime;
  uniform vec3 uResolution;
  uniform vec3 uBaseColor;
  uniform float uPaperInk;
  uniform float uPixelRatio;
  uniform float uAmplitude;
  uniform float uFrequencyX;
  uniform float uFrequencyY;
  uniform vec2 uMouse;
  uniform float uMultiSample;
`;

export const LIQUID_CHROME_RENDER_IMAGE_GLSL = /* glsl */ `
  float paperNoise(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float paperSurfaceNoise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(paperNoise(cell), paperNoise(cell + vec2(1.0, 0.0)), f.x),
      mix(paperNoise(cell + vec2(0.0, 1.0)), paperNoise(cell + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float paperTooth(vec2 p) {
    return 0.35 * paperNoise(floor(p))
      + 0.42 * paperSurfaceNoise(p * 0.7)
      + 0.23 * paperSurfaceNoise(p * vec2(0.18, 0.64)) - 0.5;
  }

  vec4 renderImage(vec2 uvCoord) {
      vec2 fragCoord = uvCoord * uResolution.xy;
      vec2 uv = (2.0 * fragCoord - uResolution.xy) / min(uResolution.x, uResolution.y);

      for (float i = 1.0; i < 10.0; i++){
          uv.x += uAmplitude / i * cos(i * uFrequencyX * uv.y + uTime + uMouse.x * 3.14159);
          uv.y += uAmplitude / i * cos(i * uFrequencyY * uv.x + uTime + uMouse.y * 3.14159);
      }

      vec2 diff = (uvCoord - uMouse);
      float dist = length(diff);
      float falloff = exp(-dist * 20.0);
      float ripple = sin(10.0 * dist - uTime * 2.0) * 0.03;
      uv += (diff / (dist + 0.0001)) * ripple * falloff;

      if (uPaperInk > 0.5) {
        float field = abs(sin(uTime - uv.y - uv.x));
        float widthProfile = 0.5 + 0.5 * sin((uv.x - uv.y) * 1.15 + uTime * 0.65
          + 0.65 * sin(uv.x * 0.8 - uv.y * 0.45));
        float widthScale = mix(1.0 - ${PAPER_INK_MATERIAL.widthVariance},
          1.0 + ${PAPER_INK_MATERIAL.widthVariance}, widthProfile);
        float coreProfile = 0.5 + 0.5 * sin((uv.x - uv.y) * 1.75 - uTime * 0.45
          + 0.85 * sin(uv.x * 0.7 + uv.y * 0.55 + uTime * 0.25));
        float coreScale = mix(1.0 - ${PAPER_INK_MATERIAL.coreVariance},
          1.0 + ${PAPER_INK_MATERIAL.coreVariance}, coreProfile);
        float washSpread = ${PAPER_INK_MATERIAL.spread} * widthScale
          * (1.0 + ${PAPER_INK_MATERIAL.gradientSoftness} * 0.16);
        float coreSpread = 0.065 * coreScale
          * (1.0 + ${PAPER_INK_MATERIAL.gradientSoftness} * 0.75);

        // The surface stays still while the flowing field passes across its fibres.
        vec2 paperPixel = fragCoord / uPixelRatio;
        float feathering = paperSurfaceNoise(paperPixel * 0.018 + vec2(4.8, 6.1)) - 0.5;
        float edgeNoise = 0.65 * (paperSurfaceNoise(paperPixel * 0.14) - 0.5)
          + 0.35 * (paperSurfaceNoise(paperPixel * 0.42 + vec2(8.3, 2.7)) - 0.5);
        float washDistance = field / washSpread;
        float shoulder = smoothstep(0.1, 0.8, washDistance);
        washDistance = max(0.0, washDistance
          + ${PAPER_INK_MATERIAL.edgeTexture} * 0.18 * edgeNoise * shoulder);
        float localSoftness = 1.0 + ${PAPER_INK_MATERIAL.edgeTexture} * 0.30 * feathering;
        float wash = exp(-pow(washDistance / localSoftness, 2.0));
        float core = exp(-pow(field / coreSpread, 2.0));
        float coreBlend = mix(0.18, 0.08, ${PAPER_INK_MATERIAL.gradientSoftness});
        float strength = mix(1.0 - ${PAPER_INK_MATERIAL.coreVariance} * 0.24, 1.0, coreProfile);
        float weight = ${PAPER_INK_MATERIAL.density} * strength * mix(wash, core, coreBlend);
        vec3 pigment = vec3(${PAPER_INK_MATERIAL.pigmentColor.join(", ")});
        vec3 color = mix(uBaseColor, pigment, weight);
        float grain = (paperNoise(floor(fragCoord)) - 0.5) * 0.006;
        return vec4(color + grain, 1.0);
      }

      vec3 color = uBaseColor / abs(sin(uTime - uv.y - uv.x));
      return vec4(color, 1.0);
  }
`;

/**
 * The field at `uvCoord`, averaged over the 3×3 kernel when `uMultiSample` is on — exactly what
 * LiquidChrome writes per pixel, before the framebuffer clamps it.
 */
export const LIQUID_CHROME_SAMPLE_GLSL = /* glsl */ `
  vec4 finishLiquidChromeMaterial(vec4 color, vec2 uvCoord) {
    if (uPaperInk > 0.5) {
      vec2 paperPixel = uvCoord * uResolution.xy / uPixelRatio;
      color.rgb = clamp(color.rgb + ${PAPER_INK_MATERIAL.paperGrain} * paperTooth(paperPixel), 0.0, 1.0);
    }
    return color;
  }

  vec4 sampleLiquidChrome(vec2 uvCoord) {
      if (uMultiSample < 0.5) {
          return finishLiquidChromeMaterial(renderImage(uvCoord), uvCoord);
      }
      vec4 col = vec4(0.0);
      int samples = 0;
      for (int i = -1; i <= 1; i++){
          for (int j = -1; j <= 1; j++){
              vec2 offset = vec2(float(i), float(j)) * (1.0 / min(uResolution.x, uResolution.y));
              col += renderImage(uvCoord + offset);
              samples++;
          }
      }
      return finishLiquidChromeMaterial(col / float(samples), uvCoord);
  }
`;
