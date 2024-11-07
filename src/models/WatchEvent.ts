// src/models/WatchEvent.ts
export interface WatchEvent<T> {
  type: 'ADDED' | 'MODIFIED' | 'DELETED' | 'ERROR';
  object: T;
}
