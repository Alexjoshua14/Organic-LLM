"use client";

/* R3F intrinsics carry Three props that eslint-plugin-react does not recognize. */
/* eslint-disable react/no-unknown-property */

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, MeshTransmissionMaterial, useFBO } from "@react-three/drei";
import * as THREE from "three";

import { createGlassBarGeometry, GLASS_THICKNESS_PER_HEIGHT } from "./voice-glass-geometry";

import {
  chromeUvTransform,
  effectiveOpacity,
  resolveBackdropRgb,
} from "@/lib/background/liquid-chrome-mirror";
import {
  LIQUID_CHROME_RENDER_IMAGE_GLSL,
  LIQUID_CHROME_SAMPLE_GLSL,
  LIQUID_CHROME_UNIFORMS_GLSL,
} from "@/lib/background/liquid-chrome-shader";
import {
  getActiveLiquidChromeSource,
  liquidChromePhaseAt,
} from "@/lib/background/liquid-chrome-source";

/**
 * Adapted from ReactBits FluidGlass's Bar / ModeWrapper rendering pattern (offscreen scene →
 * framebuffer → transmission). MIT, https://github.com/DavidHDev/react-bits/tree/c5df8610c0b47d7cd805cda480baba402f7267c1/src/ts-default/Components/FluidGlass
 *
 * ReactBits can refract its content because that content lives inside the 3D scene. The voice
 * bar's content is the page, which WebGL cannot sample — but where the page background is
 * LiquidChrome, that background is itself a shader. So the offscreen scene re-renders the *same*
 * field (shared GLSL, the background's live uniforms, the same clock) for exactly the patch of
 * screen the bar covers. The glass then bends the real background, as FluidGlass should.
 */
const TRANSMISSION_SAMPLES = 4;
const MAX_BUFFER_WIDTH = 1024;
const MAX_DPR = 1.5;
/** The field moves slowly; the glass does not need the waveform's display refresh rate. */
const GLASS_FRAME_MS = 1000 / 30;
/** Leave one CSS pixel around the bar so its rounded bevel stays in the frustum. */
const EDGE_INSET_PX = 1;
const CAMERA_ZOOM = 160;
/**
 * How often the colour beneath the chrome (or beneath the bar, off-chrome) is re-resolved. It only
 * changes with theme or route, and resolving walks the DOM, so once a second is plenty.
 */
const BACKDROP_REFRESH_MS = 1000;

const MIRROR_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MIRROR_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  ${LIQUID_CHROME_UNIFORMS_GLSL}
  uniform vec2 uChromeOffset;
  uniform vec2 uChromeScale;
  uniform float uHasChrome;
  uniform float uOpacity;
  uniform vec3 uBackdrop;

  ${LIQUID_CHROME_RENDER_IMAGE_GLSL}
  ${LIQUID_CHROME_SAMPLE_GLSL}

  vec3 srgbToLinear(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
  }

  void main() {
    vec3 seen = uBackdrop;

    if (uHasChrome > 0.5) {
      vec2 fieldUv = uChromeOffset + vUv * uChromeScale;
      // LiquidChrome's output overshoots 1 and its 8-bit framebuffer clamps after the kernel
      // average. Clamp at the same point or the glass blooms where the page does not.
      vec3 field = clamp(sampleLiquidChrome(fieldUv).rgb, 0.0, 1.0);
      float inside = step(0.0, fieldUv.x) * step(fieldUv.x, 1.0)
        * step(0.0, fieldUv.y) * step(fieldUv.y, 1.0);
      // CSS opacity composites in display space, so the dim is applied before linearising.
      seen = mix(uBackdrop, field, uOpacity * inside);
    }

    // ogl writes display values straight to its canvas; three stores linear in the framebuffer and
    // re-encodes on output. Linearise here so the round trip lands on the page's exact colour.
    gl_FragColor = vec4(srgbToLinear(seen), 1.0);
  }
`;

type MirrorUniforms = {
  uTime: THREE.IUniform<number>;
  uResolution: THREE.IUniform<THREE.Vector3>;
  uBaseColor: THREE.IUniform<THREE.Vector3>;
  uAmplitude: THREE.IUniform<number>;
  uFrequencyX: THREE.IUniform<number>;
  uFrequencyY: THREE.IUniform<number>;
  uMouse: THREE.IUniform<THREE.Vector2>;
  uMultiSample: THREE.IUniform<number>;
  uChromeOffset: THREE.IUniform<THREE.Vector2>;
  uChromeScale: THREE.IUniform<THREE.Vector2>;
  uHasChrome: THREE.IUniform<number>;
  uOpacity: THREE.IUniform<number>;
  uBackdrop: THREE.IUniform<THREE.Vector3>;
};

function createMirrorUniforms(): MirrorUniforms {
  return {
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector3(1, 1, 1) },
    uBaseColor: { value: new THREE.Vector3() },
    uAmplitude: { value: 0 },
    uFrequencyX: { value: 0 },
    uFrequencyY: { value: 0 },
    uMouse: { value: new THREE.Vector2() },
    uMultiSample: { value: 0 },
    uChromeOffset: { value: new THREE.Vector2() },
    uChromeScale: { value: new THREE.Vector2(1, 1) },
    uHasChrome: { value: 0 },
    uOpacity: { value: 1 },
    uBackdrop: { value: new THREE.Vector3(1, 1, 1) },
  };
}

/**
 * Copies the page's current LiquidChrome state into the mirror. Runs once per glass frame; reads
 * two client rects and a short chain of computed opacities, allocates nothing.
 */
function syncMirror(
  uniforms: MirrorUniforms,
  canvas: HTMLCanvasElement,
  nowMs: number,
  backdrop: { refreshedAt: number; key: Element | null }
) {
  const source = getActiveLiquidChromeSource();
  const bar = canvas.getBoundingClientRect();

  if (!source) {
    uniforms.uHasChrome.value = 0;

    // Off-chrome routes (chat, rabbit holes) paint a flat page colour; glass over flat colour
    // shows flat colour, so that is what the mirror renders.
    if (backdrop.key !== canvas || nowMs - backdrop.refreshedAt > BACKDROP_REFRESH_MS) {
      uniforms.uBackdrop.value.fromArray(resolveBackdropRgb(canvas.parentElement));
      backdrop.key = canvas;
      backdrop.refreshedAt = nowMs;
    }

    return;
  }

  const { offset, scale } = chromeUvTransform(bar, source.element.getBoundingClientRect());
  const live = source.uniforms;

  uniforms.uHasChrome.value = 1;
  uniforms.uChromeOffset.value.set(offset[0], offset[1]);
  uniforms.uChromeScale.value.set(scale[0], scale[1]);
  uniforms.uTime.value = liquidChromePhaseAt(source, nowMs);
  uniforms.uResolution.value.set(
    live.uResolution.value[0]!,
    live.uResolution.value[1]!,
    live.uResolution.value[2]!
  );
  uniforms.uBaseColor.value.set(
    live.uBaseColor.value[0]!,
    live.uBaseColor.value[1]!,
    live.uBaseColor.value[2]!
  );
  uniforms.uAmplitude.value = live.uAmplitude.value;
  uniforms.uFrequencyX.value = live.uFrequencyX.value;
  uniforms.uFrequencyY.value = live.uFrequencyY.value;
  uniforms.uMouse.value.set(live.uMouse.value[0]!, live.uMouse.value[1]!);
  uniforms.uMultiSample.value = live.uMultiSample.value;

  const { opacity, fadeRoot } = effectiveOpacity(source.element);

  uniforms.uOpacity.value = opacity;

  // Beneath the fade is only visible while dimmed, and only changes with theme or route.
  const under = fadeRoot?.parentElement ?? source.element.parentElement;

  if (backdrop.key !== under || nowMs - backdrop.refreshedAt > BACKDROP_REFRESH_MS) {
    uniforms.uBackdrop.value.fromArray(resolveBackdropRgb(under));
    backdrop.key = under;
    backdrop.refreshedAt = nowMs;
  }
}

type GlassCanvasProps = {
  paused: boolean;
  onReady: () => void;
  onContextLost: () => void;
};

function GlassBar({ onReady }: Pick<GlassCanvasProps, "onReady">) {
  const { viewport, size } = useThree();
  const [scene] = useState(() => new THREE.Scene());
  // The material is built here, not declared as <shaderMaterial uniforms={…}>. Declared that way,
  // R3F hands the material a copy of the uniform entries: Vector3 values stay shared by reference,
  // but plain numbers are snapshotted — so `uHasChrome`, `uTime` and `uOpacity` written by
  // `syncMirror` never reached the GPU while `uBackdrop` did, and the glass showed a flat colour.
  // Owning the material means exactly one uniforms object.
  const [uniforms] = useState(createMirrorUniforms);
  const mirrorMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: MIRROR_VERTEX,
        fragmentShader: MIRROR_FRAGMENT,
        toneMapped: false,
      }),
    [uniforms]
  );

  useEffect(() => () => mirrorMaterial.dispose(), [mirrorMaterial]);
  const backdrop = useRef({ refreshedAt: -Infinity, key: null as Element | null });
  const readyRef = useRef(false);
  const pixel = viewport.height / size.height;
  const height = Math.max(pixel, viewport.height - EDGE_INSET_PX * pixel * 2);
  const width = Math.max(pixel, viewport.width - EDGE_INSET_PX * pixel * 2);

  // Built in world units at the drawer's exact size, so there is nothing to stretch or rescale.
  const geometry = useMemo(() => createGlassBarGeometry(width, height), [width, height]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // Aspect-correct and half-float: the mirror writes linear values, and 8 bits of linear bands
  // visibly in the dark theme's near-black field.
  const bufferScale = Math.min(viewport.dpr, MAX_DPR, MAX_BUFFER_WIDTH / size.width);
  const buffer = useFBO(
    Math.max(1, Math.round(size.width * bufferScale)),
    Math.max(1, Math.round(size.height * bufferScale)),
    { depthBuffer: false, stencilBuffer: false, type: THREE.HalfFloatType }
  );

  useFrame(({ gl, camera }) => {
    syncMirror(uniforms, gl.domElement, performance.now(), backdrop.current);

    const target = gl.getRenderTarget();

    gl.setRenderTarget(buffer);
    gl.render(scene, camera);
    gl.setRenderTarget(target);

    if (!readyRef.current) {
      readyRef.current = true;
      // After this frame reaches the screen, so the fallback never uncovers an empty canvas.
      requestAnimationFrame(onReady);
    }
  });

  return (
    <>
      {createPortal(
        <mesh
          material={mirrorMaterial}
          position={[0, 0, -1]}
          scale={[viewport.width, viewport.height, 1]}
        >
          <planeGeometry />
        </mesh>,
        scene
      )}
      {/*
        Neutral light only: the glass should add highlights, never a colour cast. A tinted
        lightformer is what turned the light theme mint.
      */}
      <Environment frames={1} resolution={64}>
        <Lightformer intensity={3} position={[0, 2, 3]} scale={[10, 0.5, 1]} />
        <Lightformer intensity={1.2} position={[-3, -1, 2]} scale={[3, 1, 1]} />
        <Lightformer intensity={1.5} position={[3, -2, 1]} scale={[4, 0.5, 1]} />
      </Environment>
      <mesh geometry={geometry}>
        {/*
          Fully transmissive: at the flat centre, with IOR 1.15, reflectance is ~0.5%, so the glass
          shows the background almost exactly; the bevel refracts and catches the light. No
          opacity, no tint — the colour you see is the page's.
        */}
        <MeshTransmissionMaterial
          anisotropicBlur={0.01}
          buffer={buffer.texture}
          chromaticAberration={0.1}
          ior={1.15}
          roughness={0}
          samples={TRANSMISSION_SAMPLES}
          thickness={GLASS_THICKNESS_PER_HEIGHT * height}
          transmission={1}
        />
      </mesh>
    </>
  );
}

function CanvasLifecycle({
  onContextLost,
  paused,
}: Pick<GlassCanvasProps, "onContextLost" | "paused">) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    if (paused) return;

    const timer = window.setInterval(() => invalidate(), GLASS_FRAME_MS);

    return () => window.clearInterval(timer);
  }, [invalidate, paused]);

  useEffect(() => {
    const canvas = gl.domElement;

    canvas.addEventListener("webglcontextlost", onContextLost);

    return () => canvas.removeEventListener("webglcontextlost", onContextLost);
  }, [gl, onContextLost]);

  return null;
}

export default function FluidGlassCanvas({ onContextLost, onReady, paused }: GlassCanvasProps) {
  return (
    <Canvas
      orthographic
      camera={{ zoom: CAMERA_ZOOM, position: [0, 0, 20] }}
      dpr={[1, MAX_DPR]}
      fallback={null}
      frameloop="demand"
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
        toneMapping: THREE.NoToneMapping,
      }}
    >
      <CanvasLifecycle paused={paused} onContextLost={onContextLost} />
      <GlassBar onReady={onReady} />
    </Canvas>
  );
}
