/**
 * Shared types for streaming text animation prototypes
 */

export type StreamMode = "character" | "word" | "line" | "sentence";

export interface PrototypeConfig {
  id: string;
  name: string;
  description?: string;
}
