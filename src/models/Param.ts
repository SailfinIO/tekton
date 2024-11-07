// src/models/Param.ts

export interface Param {
  name: string;
  value: string | string[] | { [key: string]: any };
}
