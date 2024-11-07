// src/interfaces/ResolvedKubeConfig.ts

import { Cluster, User } from './KubeConfig';

export interface ResolvedKubeConfig {
  cluster: Cluster['cluster'];
  user: User['user'];
}
