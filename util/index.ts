/**
 * Generates UUIDs
 * @returns
 */
import { randomUUID } from "crypto";

// Simple function to generate a single UUID
export function generateUUID(): string {
  return randomUUID();
}
