// src/models/KubernetesMetadata.ts

import { LabelSelector } from '../types';

export interface KubernetesMetadata {
  name: string;
  namespace?: string;
  labels?: LabelSelector;
  annotations?: LabelSelector;
  uid?: string;
  resourceVersion?: string;
  generation?: number;
  creationTimestamp?: string;
  deletionTimestamp?: string;
  ownerReferences?: OwnerReference[];
  [key: string]: any; // For any additional metadata fields
}

export interface OwnerReference {
  apiVersion: string;
  kind: string;
  name: string;
  uid: string;
  controller?: boolean;
  blockOwnerDeletion?: boolean;
}
