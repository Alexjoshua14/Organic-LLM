import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

/**
 * Sets up an orthographic camera for 1:1 pixel mapping.
 * 1 WebGL unit = 1 viewport pixel.
 * Origin (0,0) is at the center of the canvas.
 */
export function OrthographicCamera() {
  const set = useThree((state) => state.set);
  const size = useThree((state) => state.size);

  useEffect(() => {
    // Set frustum to match canvas size in pixels
    // This creates a 1:1 mapping between WebGL units and viewport pixels
    const camera = new THREE.OrthographicCamera(
      -size.width / 2,  // left
      size.width / 2,   // right
      size.height / 2,  // top
      -size.height / 2, // bottom
      0.1,               // near
      1000               // far
    );
    camera.position.set(0, 0, 1);
    camera.updateProjectionMatrix();

    set({ camera });
  }, [set, size.width, size.height]);

  return null;
}