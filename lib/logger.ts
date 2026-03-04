/** True when DEBUG=1, DEBUG=true, or DEBUG includes "chat" (and NODE_ENV is development). */
export const isDebug =
  process.env.NODE_ENV === "development" &&
  (process.env.DEBUG === "1" ||
    process.env.DEBUG === "true" ||
    process.env.DEBUG?.includes("chat"));

export class Logger {
  private filename: string;

  constructor(filepath: string) {
    // Extract just the filename from the full path
    this.filename = filepath;
  }

  log(functionName: string, message: string, ...args: any[]) {
    console.log(`[${this.filename}]/[${functionName}]`, message, ...args);
  }

  warn(functionName: string, message: string, ...args: any[]) {
    console.warn(`[${this.filename}]/[${functionName}]`, message, ...args);
  }

  error(functionName: string, message: string, ...args: any[]) {
    console.error(`[${this.filename}]/[${functionName}]`, message, ...args);
  }

  /** Logs only when isDebug is true. Tag is included in the log (e.g. "context", "tools"). */
  debug(tag: string, message: string, data?: unknown) {
    if (!isDebug) return;
    const payload = data !== undefined ? ` ${JSON.stringify(data)}` : "";
    this.log(`[DEBUG] ${tag}`, message + payload);
  }
}

// Helper function to create a logger instance for the current file
export function createLogger(filepath: string): Logger {
  return new Logger(filepath);
}
