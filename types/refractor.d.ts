declare module "refractor/core" {
  const refractor: {
    highlight(code: string, language: string): unknown[];
    register(grammar: unknown): void;
  };

  export default refractor;
}
