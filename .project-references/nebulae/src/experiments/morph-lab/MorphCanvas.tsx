import { DEFAULT_SPRING_CONFIG } from "@/lib/morphTest/constants";
import { SpringConfig } from "@/lib/morphTest/schemas/springSolverSchemas";
import { Canvas } from "@react-three/fiber";
import { MorphRedBox } from "./gpu-components/MorphMeshTest";
import { OrthographicCamera } from "./gpu-components/OrthographicCamera";
import { RefObject } from "react";
import { LiquidPlane } from "./gpu-components/LiquidPlane";

interface MorphCanvasProps {
  config?: SpringConfig;
  elementRef?: RefObject<HTMLElement>;
}

/**
 * MorphCanvas — GPU-powered morphing experiment (Three.js via @react-three/fiber)
 *
 * This should eventually respond to the passed spring `config`, but right now it ignores it.
 */
export default function MorphCanvas({ config = DEFAULT_SPRING_CONFIG, elementRef }: MorphCanvasProps) {
  return (
    <Canvas
      className="fixed inset-0 w-screen h-screen pointer-events-none z-0"
      camera={{ position: [0, 0, 3], fov: 50 }}
    >
      <OrthographicCamera />
      {/* Subtle ambient + directional light */}
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[2, 4, 3]}
        intensity={1.1}
        castShadow={false}
      />

      {/* Morphable Geometry Placeholder */}
      <LiquidPlane />
    </Canvas>
  );
}