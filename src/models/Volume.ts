// src/models/Volume.ts

export interface Volume {
  name: string;
  emptyDir?: {};
  configMap?: ConfigMapVolumeSource;
  secret?: SecretVolumeSource;
}

export interface ConfigMapVolumeSource {
  name: string;
  items?: KeyToPath[];
}

export interface SecretVolumeSource {
  secretName: string;
  items?: KeyToPath[];
}

export interface KeyToPath {
  key: string;
  path: string;
}
