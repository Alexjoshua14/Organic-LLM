const DEFAULT_TIMEOUT_MS = 5000;

export async function withTimeout<T>(
  ms: number,
  op: () => Promise<T>,
  onTimeout: () => T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      op(),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(onTimeout()), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const HEALTH_CHECK_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
