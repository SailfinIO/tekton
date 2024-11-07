// src/models/PipelineResourceSpec.ts

export interface PipelineResourceSpec {
  type: string;
  params?: ResourceParam[];
  secrets?: SecretParam[];
}

export interface ResourceParam {
  name: string;
  value: string;
}

export interface SecretParam {
  fieldName: string;
  secretKey: string;
  secretName: string;
}
