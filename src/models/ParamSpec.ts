// src/models/ParamSpec.ts

export interface ParamSpec {
  name: string;
  type?: 'string' | 'array' | 'object';
  default?: string | string[] | { [key: string]: any };
  description?: string;
}
