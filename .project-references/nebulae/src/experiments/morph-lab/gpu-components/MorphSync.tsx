import { useRef, ReactNode, useLayoutEffect, cloneElement, ReactElement, useCallback } from "react";
import { Mesh } from "three";
import { useMeshRegistry } from "@/lib/morphTest/webGL/meshRegistryContext";
import { MeshMetadata } from "@/lib/morphTest/schemas/webGLSchemas";
import { snapshot } from "@/lib/morphTest/morphUtils";


interface MorphSyncProps {
  id: string;
  children: ReactNode;
  metadata?: MeshMetadata;
}

export function MorphSync({ id, children, metadata }: MorphSyncProps) {
  const ctx = useMeshRegistry()

  const containerRef = useRef<HTMLDivElement>(null)

  const htmlElementRef = useRef<HTMLElement>(null)
  const webGLElementRef = useRef<Mesh>(null)

  // Callback ref - React calls this with the DOM node
  // This is more reliable than passing ref directly to cloneElement
  const setElementRef = useCallback((node: HTMLElement) => {
    htmlElementRef.current = node;
  }, []);

  useLayoutEffect(() => {
    // Extract the DOM elements from the refs before passing to snapshot
    const htmlElement = htmlElementRef.current;
    const containerElement = containerRef.current;
    if (!htmlElement || !containerElement) return;

    // Take snapshot of current position/size
    const updateMesh = () => {
      const currState = snapshot(htmlElement, containerElement);
      ctx.updateMesh(id, currState)
    }

    // Register mesh on mount, update on changes
    // registerMesh handles both create and update, so we can use it for both
    const currState = snapshot(htmlElement, containerElement);
    ctx.registerMesh(id, currState, metadata);

    // Set up ResizeObserver to watch for size/position changes
    const resizeObserver = new ResizeObserver(() => {
      updateMesh();
    });

    resizeObserver.observe(htmlElement);
    resizeObserver.observe(containerElement);

    // Cleanup: unregister when component unmounts
    return () => {
      resizeObserver.disconnect();
      ctx.unregisterMesh(id);
    };
  }, [id, ctx, metadata]) // Re-run if id, context, or metadata changes

  return (
    <div ref={containerRef}>
      {cloneElement(children as ReactElement<any>, {
        ref: setElementRef
      } as any)}
    </div>
  )
}