export type DocumentSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/** Serializes writes and keeps the latest edit made during an outstanding save. */
export class DocumentSaver<T> {
  private pending: { doc: T } | null = null;
  private running: Promise<number> | null = null;
  private version = 0;

  constructor(
    private readonly save: (doc: T, version: number) => Promise<number>,
    private readonly state: (state: DocumentSaveState) => void,
  ) {}

  setVersion(version: number) { this.version = version; }
  note(doc: T) { this.pending = { doc }; this.state('dirty'); }
  get dirty() { return this.pending !== null || this.running !== null; }

  flush(): Promise<number> {
    if (this.running) return this.running;
    if (!this.pending) return Promise.resolve(this.version);
    this.running = this.drain().finally(() => { this.running = null; });
    return this.running;
  }

  private async drain(): Promise<number> {
    while (this.pending) {
      const next = this.pending;
      this.pending = null;
      this.state('saving');
      try { this.version = await this.save(next.doc, this.version); }
      catch (error) {
        this.pending ??= next;
        this.state('error');
        throw error;
      }
    }
    this.state('saved');
    return this.version;
  }
}
