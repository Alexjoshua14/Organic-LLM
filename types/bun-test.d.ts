declare module "bun:test" {
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect<T>(actual: T): {
    toBe(expected: T): void;
    toBeNull(): void;
    not: {
      toBeNull(): void;
      toThrow(): void;
    };
    toHaveLength(length: number): void;
    toContain(item: any): void;
    toThrow(): void;
  };
}
