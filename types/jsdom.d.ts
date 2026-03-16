declare module "jsdom" {
  export class JSDOM {
    window: Window & typeof globalThis;

    constructor(
      html?: string | Buffer | ArrayBuffer | ArrayBufferView,
      options?: {
        url?: string;
      }
    );
  }
}
