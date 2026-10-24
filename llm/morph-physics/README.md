# @organic-llm/morph-physics

Spring-driven **layout morphing** for the DOM: animate a `Vector4` \((x, y, w, h)\) with damped springs, optional **React** hook, and optional **Three.js** mesh sync. Ported from [Project Nebulae](https://github.com/) morph-lab (`morphTest` + `useMorphPhysics`).

## Install

```bash
npm install @organic-llm/morph-physics
# peers: react, zod; optional: three
```

Local monorepo / unpublished tarball:

```bash
npm install file:./llm/morph-physics
```

## Usage

**Core** (registry auto-loads `position` + `color` when you import the package root):

```ts
import {
  FrameLoop,
  solveSpringVector4,
  snapshot,
  clearInlineStyles,
  DEFAULT_SPRING_CONFIG,
  morphPropertyRegistry,
} from "@organic-llm/morph-physics";
```

**React**:

```ts
import { useMorphPhysics } from "@organic-llm/morph-physics/react";

const { elementRef, reset, morphTo } = useMorphPhysics({
  config: DEFAULT_SPRING_CONFIG,
});
```

**WebGL** (peer `three`):

```ts
import { MeshRegistryProvider, useMeshRegistry } from "@organic-llm/morph-physics/webgl";
```

## Exports

| Subpath   | Purpose                          |
|-----------|----------------------------------|
| `.`       | Springs, `FrameLoop`, `morphUtils`, schemas, registry |
| `./react` | `useMorphPhysics`                |
| `./webgl` | Mesh registry context + utils   |

## Scripts

```bash
bun install
bun run build    # tsup → dist/
bun run test     # vitest
```

## License

Apache-2.0 (see `LICENSE`). Derived from Nebulae reference code in this repo under `.project-references/nebulae`.
