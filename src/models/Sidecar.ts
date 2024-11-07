// src/models/Sidecar.ts

import { EnvVar } from './EnvVar';
import { Volume } from './Volume';

export interface Sidecar {
  name: string;
  image: string;
  command?: string[];
  args?: string[];
  env?: EnvVar[];
  volumeMounts?: Volume[];
}
