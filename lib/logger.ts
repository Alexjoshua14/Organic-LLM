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
}

// Helper function to create a logger instance for the current file
export function createLogger(filepath: string): Logger {
  return new Logger(filepath);
}
