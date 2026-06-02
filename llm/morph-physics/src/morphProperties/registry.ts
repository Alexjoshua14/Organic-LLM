import type { MorphProperty } from "./types";

/** Singleton holding active morph channels; mutates morph state during integration. */
class MorphPropertyRegistry {
  private properties = new Map<string, MorphProperty<any>>();

  registerProperty<T = unknown>(property: MorphProperty<T>): void {
    this.properties.set(property.key, property as MorphProperty);
  }

  getProperty(key: string): MorphProperty<any> | undefined {
    return this.properties.get(key);
  }

  getAllProperties(): MorphProperty<any>[] {
    return Array.from(this.properties.values());
  }

  hasProperty(key: string): boolean {
    return this.properties.has(key);
  }
}

export const morphPropertyRegistry = new MorphPropertyRegistry();
