/**
 * Generic High-Performance Static Object Pool (Zero-GC)
 * Pre-allocates a fixed block of memory and uses an indexed stack to prevent
 * Garbage Collection pauses during 60 FPS animation render loops.
 */

export interface Poolable {
  reset(): void;
  isAlive(): boolean;
}

export class ObjectPool<T extends Poolable> {
  private pool: T[];
  private freeIndices: number[];
  private freeCount: number;
  public readonly capacity: number;

  constructor(factory: () => T, capacity: number) {
    this.capacity = capacity;
    this.pool = new Array(capacity);
    this.freeIndices = new Array(capacity);
    this.freeCount = capacity;

    // Pre-allocate all objects in memory once at startup
    for (let i = 0; i < capacity; i++) {
      this.pool[i] = factory();
      this.freeIndices[i] = i;
    }
  }

  /**
   * Acquires a recycled object from the pool.
   * Returns null if pool capacity is exhausted (prevents memory spikes on low-end hardware).
   */
  public acquire(): T | null {
    if (this.freeCount <= 0) {
      return null;
    }

    this.freeCount--;
    const index = this.freeIndices[this.freeCount];
    const item = this.pool[index];
    item.reset();
    return item;
  }

  /**
   * Releases an object back to the pool without deallocating.
   */
  public release(item: T): void {
    const index = this.pool.indexOf(item);
    if (index === -1) return;

    if (this.freeCount < this.capacity) {
      this.freeIndices[this.freeCount] = index;
      this.freeCount++;
    }
  }

  /**
   * Number of currently active objects in the pool.
   */
  public get activeCount(): number {
    return this.capacity - this.freeCount;
  }

  /**
   * Number of available idle objects in the pool.
   */
  public get availableCount(): number {
    return this.freeCount;
  }

  /**
   * Runs a callback on all allocated objects (used during engine tick).
   */
  public forEachAllocated(callback: (item: T, index: number) => void): void {
    for (let i = 0; i < this.capacity; i++) {
      callback(this.pool[i], i);
    }
  }
}

