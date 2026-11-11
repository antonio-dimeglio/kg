// Undo and redo as two stacks of snapshots. Snapshots are never changed after
// they are recorded, so keeping them is cheap.
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];

  constructor(private limit = 200) {}

  // Call with the state as it was before an edit.
  record(before: T): void {
    this.past.push(before);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  // Takes the state now; returns the one to go back to, or undefined.
  undo(now: T): T | undefined {
    const prev = this.past.pop();
    if (prev !== undefined) this.future.push(now);
    return prev;
  }

  redo(now: T): T | undefined {
    const next = this.future.pop();
    if (next !== undefined) this.past.push(now);
    return next;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}
