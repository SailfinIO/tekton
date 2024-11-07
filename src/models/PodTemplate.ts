// src/models/PodTemplate.ts

import { Toleration } from './Toleration';
import { Affinity } from './Affinity';
import { SecurityContext } from './SecurityContext';
import { Volume } from './Volume';
import { LabelSelector } from '../types';

export interface PodTemplate {
  nodeSelector?: LabelSelector;
  tolerations?: Toleration[];
  affinity?: Affinity;
  securityContext?: SecurityContext;
  volumes?: Volume[];
  dnsPolicy?: string;
  automountServiceAccountToken?: boolean;
  enableServiceLinks?: boolean;
}
