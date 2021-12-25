export default class Locksmith {
  private count: number;
  private queue: Array<{ next: () => void }>;
  private lockSet: WeakSet<Promise<void>> = new WeakSet();
  constructor(initCount = 1) {
    this.count = initCount;
    this.queue = [];
  }
  lock(): Promise<void> {
    const ret = new Promise<void>((f) => {
      const { count } = this;
      if (count > 0) {
        --this.count;
        f();
        return;
      }
      this.queue.push({
        next: f,
      });
    });
    this.lockSet.add(ret);
    return ret;
  }
    release(lock: Promise<void>) {
    if (this.lockSet.has(lock)) {
      this.lockSet.delete(lock);
      const front = this.queue.shift();
      if (front) {
        front.next();
      } else {
          ++this.count;
      }
    }
  }
}
