export interface DataSource {
  start(): Promise<void>;
  onSynced(callback: () => void): void;
  onError(callback: (err: unknown) => void): void;
}
