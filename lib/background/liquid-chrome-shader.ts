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
 * - `uResolution`  canvas size in device pixels, and aspect in `.z`; only the aspect affects output
 * - `uBaseColor`   field tint; output is this divided by a periodic term, so it exceeds 1 and is
 *                  clamped when written to an 8-bit framebuffer
 * - `uAmplitude`, `uFrequencyX`, `uFrequencyY`  warp parameters
 * - `uMouse`       ripple centre in the field's own UV space (y up)
 * - `uMultiSample` > 0.5 averages a 3×3 kernel before the write
 */
export const LIQUID_CHROME_UNIFORMS_GLSL = /* glsl */ `
  uniform float uTime;
  uniform vec3 uResolution;
  uniform vec3 uBaseColor;
  uniform float uAmplitude;
  uniform float uFrequencyX;
  uniform float uFrequencyY;
  uniform vec2 uMouse;
  uniform float uMultiSample;
`;

export const LIQUID_CHROME_RENDER_IMAGE_GLSL = /* glsl */ `
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

      vec3 color = uBaseColor / abs(sin(uTime - uv.y - uv.x));
      return vec4(color, 1.0);
  }
`;

/**
 * The field at `uvCoord`, averaged over the 3×3 kernel when `uMultiSample` is on — exactly what
 * LiquidChrome writes per pixel, before the framebuffer clamps it.
 */
export const LIQUID_CHROME_SAMPLE_GLSL = /* glsl */ `
  vec4 sampleLiquidChrome(vec2 uvCoord) {
      if (uMultiSample < 0.5) {
          return renderImage(uvCoord);
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
      return col / float(samples);
  }
`;
