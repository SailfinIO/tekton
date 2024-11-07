// /models/ResourceRequirements.ts

export interface ResourceRequirements {
  limits?: {
    [resourceName: string]: string; // e.g., 'cpu': '1000m', 'memory': '512Mi'
  };
  requests?: {
    [resourceName: string]: string;
  };
}
