// src/models/Toleration.ts

export interface Toleration {
  key?: string;
  operator?: string; // 'Exists' or 'Equal'
  value?: string;
  effect?: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
  tolerationSeconds?: number;
}
