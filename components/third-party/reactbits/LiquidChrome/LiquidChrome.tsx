import React, { memo, useEffect, useLayoutEffect, useRef } from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";

import "./LiquidChrome.css";

interface LiquidChromeProps extends React.HTMLAttributes<HTMLDivElement> {
  baseColor?: [number, number, number];
  speed?: number;
  amplitude?: number;
  frequencyX?: number;
  frequencyY?: number;
  interactive?: boolean;
  /** When true, the RAF loop is stopped and rendering is skipped. */
  paused?: boolean;
}

type LiquidChromeRuntimeProps = {
  baseColor: [number, number, number];
  speed: number;
  amplitude: number;
  frequencyX: number;
  frequencyY: number;
};

const MOUSE_LERP = 0.12;
const MAX_DPR = 1.5;

function rgb01ToCss([r, g, b]: [number, number, number]): string {
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

function runtimePropsEqual(a: LiquidChromeRuntimeProps, b: LiquidChromeRuntimeProps): boolean {
  return (
    a.speed === b.speed &&
    a.amplitude === b.amplitude &&
    a.frequencyX === b.frequencyX &&
    a.frequencyY === b.frequencyY &&
    a.baseColor[0] === b.baseColor[0] &&
    a.baseColor[1] === b.baseColor[1] &&
    a.baseColor[2] === b.baseColor[2]
  );
}

export const LiquidChrome = memo(function LiquidChrome({
  baseColor = [0.1, 0.1, 0.1],
  speed = 0.2,
  amplitude = 0.5,
  frequencyX = 3,
  frequencyY = 2,
  interactive = true,
  paused = false,
  ...props
}: LiquidChromeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(paused);
  const propsRef = useRef<LiquidChromeRuntimeProps>({
    baseColor,
    speed,
    amplitude,
    frequencyX,
    frequencyY,
  });
  const mouseTargetRef = useRef<[number, number]>([0, 0]);
  const startLoopRef = useRef<(() => void) | null>(null);

  pausedRef.current = paused;
  propsRef.current = { baseColor, speed, amplitude, frequencyX, frequencyY };

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const multiSample = window.matchMedia("(max-width: 768px)").matches ? 0 : 1;
    const renderer = new Renderer({ antialias: false });
    const gl = renderer.gl;
    const initial = propsRef.current;
    const [clearR, clearG, clearB] = initial.baseColor;

    gl.clearColor(clearR, clearG, clearB, 1);

    const vertexShader = `
      attribute vec2 position;
      attribute vec2 uv;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;
      uniform float uTime;
      uniform vec3 uResolution;
      uniform vec3 uBaseColor;
      uniform float uAmplitude;
      uniform float uFrequencyX;
      uniform float uFrequencyY;
      uniform vec2 uMouse;
      uniform float uMultiSample;
      varying vec2 vUv;

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

      void main() {
          if (uMultiSample < 0.5) {
              gl_FragColor = renderImage(vUv);
              return;
          }
          vec4 col = vec4(0.0);
          int samples = 0;
          for (int i = -1; i <= 1; i++){
              for (int j = -1; j <= 1; j++){
                  vec2 offset = vec2(float(i), float(j)) * (1.0 / min(uResolution.x, uResolution.y));
                  col += renderImage(vUv + offset);
                  samples++;
              }
          }
          gl_FragColor = col / float(samples);
      }
    `;

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: {
          value: new Float32Array([
            gl.canvas.width,
            gl.canvas.height,
            gl.canvas.width / gl.canvas.height,
          ]),
        },
        uBaseColor: { value: new Float32Array(initial.baseColor) },
        uAmplitude: { value: initial.amplitude },
        uFrequencyX: { value: initial.frequencyX },
        uFrequencyY: { value: initial.frequencyY },
        uMouse: { value: new Float32Array([0, 0]) },
        uMultiSample: { value: multiSample },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    let syncedProps: LiquidChromeRuntimeProps = { ...initial };
    let animationId: number | null = null;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      renderer.setSize(container.offsetWidth * dpr, container.offsetHeight * dpr);
      const resUniform = program.uniforms.uResolution.value as Float32Array;

      resUniform[0] = gl.canvas.width;
      resUniform[1] = gl.canvas.height;
      resUniform[2] = gl.canvas.width / gl.canvas.height;
    }
    window.addEventListener("resize", resize);
    resize();

    function setMouseTarget(x: number, y: number) {
      mouseTargetRef.current = [x, y];
    }

    function handleMouseMove(event: MouseEvent) {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      setMouseTarget(
        (event.clientX - rect.left) / rect.width,
        1 - (event.clientY - rect.top) / rect.height,
      );
    }

    function handleTouchMove(event: TouchEvent) {
      if (event.touches.length === 0) return;
      const touch = event.touches[0];
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      setMouseTarget(
        (touch.clientX - rect.left) / rect.width,
        1 - (touch.clientY - rect.top) / rect.height,
      );
    }

    if (interactive) {
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("touchmove", handleTouchMove);
    }

    function syncUniformsFromProps() {
      const runtime = propsRef.current;
      if (runtimePropsEqual(syncedProps, runtime)) return;

      const baseColorUniform = program.uniforms.uBaseColor.value as Float32Array;

      baseColorUniform[0] = runtime.baseColor[0];
      baseColorUniform[1] = runtime.baseColor[1];
      baseColorUniform[2] = runtime.baseColor[2];
      program.uniforms.uAmplitude.value = runtime.amplitude;
      program.uniforms.uFrequencyX.value = runtime.frequencyX;
      program.uniforms.uFrequencyY.value = runtime.frequencyY;
      syncedProps = { ...runtime };
    }

    function renderFrame(timeMs: number) {
      syncUniformsFromProps();

      const runtime = propsRef.current;
      program.uniforms.uTime.value = timeMs * 0.001 * runtime.speed;

      if (interactive) {
        const mouseUniform = program.uniforms.uMouse.value as Float32Array;
        const [targetX, targetY] = mouseTargetRef.current;

        mouseUniform[0] += (targetX - mouseUniform[0]) * MOUSE_LERP;
        mouseUniform[1] += (targetY - mouseUniform[1]) * MOUSE_LERP;
      }

      renderer.render({ scene: mesh });
    }

    function tick(t: number) {
      if (pausedRef.current) {
        animationId = null;
        return;
      }

      animationId = requestAnimationFrame(tick);
      renderFrame(t);
    }

    function startLoop() {
      if (animationId !== null || pausedRef.current) return;
      animationId = requestAnimationFrame(tick);
    }

    container.appendChild(gl.canvas);
    renderFrame(0);

    startLoopRef.current = startLoop;
    if (!pausedRef.current) {
      startLoop();
    }

    return () => {
      startLoopRef.current = null;
      if (animationId !== null) cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      if (interactive) {
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("touchmove", handleTouchMove);
      }
      if (gl.canvas.parentElement) {
        gl.canvas.parentElement.removeChild(gl.canvas);
      }
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [interactive]);

  useEffect(() => {
    if (!paused) {
      startLoopRef.current?.();
    }
  }, [paused]);

  return <div ref={containerRef} className="liquidChrome-container" {...props} />;
});

LiquidChrome.displayName = "LiquidChrome";

export { rgb01ToCss };

export default LiquidChrome;
