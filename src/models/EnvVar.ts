// src/models/EnvVar.ts

export interface EnvVar {
  name: string;
  value?: string;
  valueFrom?: EnvVarSource;
}

export interface EnvVarSource {
  secretKeyRef?: SecretKeySelector;
  configMapKeyRef?: ConfigMapKeySelector;
  // Other sources can be added if needed
}

export interface SecretKeySelector {
  name: string;
  key: string;
  optional?: boolean;
}

export interface ConfigMapKeySelector {
  name: string;
  key: string;
  optional?: boolean;
}
