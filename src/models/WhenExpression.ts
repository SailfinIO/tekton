// src/models/WhenExpression.ts

export interface WhenExpression {
  input: string;
  operator: 'in' | 'notin';
  values: string[];
}
