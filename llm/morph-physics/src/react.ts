/** React: `useMorphPhysics` — ensures default morph properties are registered. */
import "./morphProperties/index";

export {
  useMorphPhysics,
  morphPhysicsParamsSchema,
  type UseMorphPhysicsOutput,
  type UseMorphPhysicsParams,
  type Vector4,
  type ShellLayoutInfo,
} from "./react/useMorphPhysics";
export {
  suggestLayoutConstraintRelaxation,
  type LayoutConstraintRelaxation,
} from "./layoutRelaxation";
