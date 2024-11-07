// src/models/Affinity.ts

export interface Affinity {
  nodeAffinity?: NodeAffinity;
  podAffinity?: PodAffinity;
  podAntiAffinity?: PodAntiAffinity;
}

export interface NodeAffinity {
  // Define node affinity properties
}

export interface PodAffinity {
  // Define pod affinity properties
}

export interface PodAntiAffinity {
  // Define pod anti-affinity properties
}
