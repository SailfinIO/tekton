// src/models/TimeoutFields.ts

export interface TimeoutFields {
  pipeline?: string; // e.g., '1h0m0s'
  tasks?: string; // e.g., '30m0s'
  finally?: string; // e.g., '15m0s'
}
