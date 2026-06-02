import { useRef, useMemo, forwardRef, useEffect } from "react";
import { Mesh, ShaderMaterial } from "three";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Placeholder shader - will be replaced with actual liquid shader
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec2 uResolution;
  uniform vec2 uDimensions;
  uniform vec3 uColor;
  uniform float uTime;
  uniform vec2 uVelocity;
  
  varying vec2 vUv;
  
  void main() {
    // Placeholder: simple colored rectangle
    // TODO: Replace with SDF rounded rect + gooey effect
    vec2 uv = vUv;
    vec3 color = uColor;
    gl_FragColor = vec4(color, 1.0);
  }
`;

interface LiquidPlaneProps {
  color?: string;
}

export const LiquidPlane = forwardRef<Mesh, LiquidPlaneProps>(
  ({ color = "#fc225d" }, ref) => {
    const meshRef = useRef<Mesh>(null);

    useEffect(() => {
      if (typeof ref === 'function') {
        ref(meshRef.current);
      } else if (ref) {
        ref.current = meshRef.current;
      }
    }, [ref])

    const uniforms = useMemo(() => ({
      uTime: { value: 0 },
      uResolution: { value: [window.innerWidth, window.innerHeight] },
      uColor: { value: new THREE.Color(color) },
      uDimensions: { value: [130, 100] }, // Initial size
      uVelocity: { value: [0, 0] },
    }), [color]);

    useFrame((state) => {
      if (meshRef.current?.material) {
        const material = meshRef.current.material as ShaderMaterial;
        if (material.uniforms.uTime) {
          material.uniforms.uTime.value = state.clock.elapsedTime;
        }
        if (material.uniforms.uResolution) {
          material.uniforms.uResolution.value = [state.size.width, state.size.height];
        }
      }
    });

    return (
      <mesh ref={meshRef}>
        <planeGeometry args={[130, 100]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
        />
      </mesh>
    );
  })