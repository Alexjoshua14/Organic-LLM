export { morphPropertyRegistry } from "./registry";
export type { MorphProperty } from "./types";
export { positionProperty } from "./position";
export { colorProperty } from "./color";
export { brightnessProperty } from "./brightness";

// Register default properties
import { morphPropertyRegistry } from "./registry";
import { positionProperty } from "./position";
import { colorProperty } from "./color";
import { brightnessProperty } from "./brightness";

morphPropertyRegistry.registerProperty(positionProperty);
morphPropertyRegistry.registerProperty(colorProperty);
// Brightness is available but not registered by default - register it if needed
// morphPropertyRegistry.registerProperty(brightnessProperty);
