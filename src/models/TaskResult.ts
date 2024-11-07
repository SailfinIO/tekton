// src/models/TaskResult.ts

export interface TaskResult {
  name: string;
  type?: 'string' | 'array' | 'object';
  description?: string;
}
