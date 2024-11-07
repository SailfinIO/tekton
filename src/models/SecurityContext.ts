// /models/SecurityContext.ts

export interface SecurityContext {
  runAsUser?: number;
  runAsGroup?: number;
  fsGroup?: number;
}
