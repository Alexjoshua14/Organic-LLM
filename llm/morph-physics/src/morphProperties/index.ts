/**
 * Side effect: registers `position` and `color` on `morphPropertyRegistry`.
 * Import this module (or the package root) before running `useMorphPhysics`.
 */
export { morphPropertyRegistry } from "./registry";
export type { MorphProperty } from "./types";
export { positionProperty } from "./position";
export { colorProperty } from "./color";
export { brightnessProperty } from "./brightness";

import { morphPropertyRegistry } from "./registry";
import { positionProperty } from "./position";
import { colorProperty } from "./color";

morphPropertyRegistry.registerProperty(positionProperty);
morphPropertyRegistry.registerProperty(colorProperty);
