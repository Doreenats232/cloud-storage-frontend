/**
 * A tiny concurrency limiter. Wrap any async call in the returned function and
 * at most `concurrency` of them will run at the same time; the rest wait in a
 * FIFO queue. This lets us fire lots of requests (scans, thumbnails, uploads)
 * without flooding the backend or the browser.
 */
export function createLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (active >= concurrency) return;
    const job = queue.shift();
    if (job) job();
  };

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        active++;
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      };
      queue.push(run);
      next();
    });
  };
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
