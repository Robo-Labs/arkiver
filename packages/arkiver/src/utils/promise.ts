export const retry = async <TReturnType>({
  callback,
  maxRetries,
  retryDelayMs,
}: {
  callback: () => Promise<TReturnType>;
  maxRetries: number;
  retryDelayMs: number;
}): Promise<TReturnType> => {
  let retries = 0;
  let exponentialDelay = retryDelayMs;
  let res: TReturnType;

  while (retries < maxRetries) {
    try {
      res = await callback();
      break;
    } catch (error) {
      retries++;

      if (retries >= maxRetries) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, exponentialDelay));

      exponentialDelay *= 2;
    }
  }

  return res!;
};
