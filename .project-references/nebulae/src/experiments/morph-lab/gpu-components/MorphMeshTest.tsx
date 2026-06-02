import { useFrame } from "@react-three/fiber";
import { useRef } from "react"
import { Mesh } from "three";


export const MorphRedBox = () => {
  const meshRef = useRef<Mesh>(null);

  return (
    <mesh ref={meshRef} position={[0, 140, 0]}>
      <planeGeometry args={[130, 100]} />
      <meshStandardMaterial
        color="#fc225d"
        roughness={0.27}
        metalness={0.48}
      />
    </mesh>
  )
}