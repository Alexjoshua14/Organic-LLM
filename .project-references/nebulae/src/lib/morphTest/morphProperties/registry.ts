import { MorphProperty } from "./types";

/**
 * Registry for morph properties.
 * Allows registration and retrieval of property modules.
 */
class MorphPropertyRegistry {
  private properties = new Map<string, MorphProperty<any>>();

  /**
   * Register a morph property
   */
  registerProperty<T = unknown>(property: MorphProperty<T>): void {
    this.properties.set(property.key, property as MorphProperty);
  }

  /**
   * Get a property by key
   */
  getProperty(key: string): MorphProperty<any> | undefined {
    return this.properties.get(key);
  }

  /**
   * Get all registered properties
   */
  getAllProperties(): MorphProperty<any>[] {
    return Array.from(this.properties.values());
  }

  /**
   * Check if a property is registered
   */
  hasProperty(key: string): boolean {
    return this.properties.has(key);
  }
}

// Singleton registry instance
export const morphPropertyRegistry = new MorphPropertyRegistry();
