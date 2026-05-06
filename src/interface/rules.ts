export interface ICondition {
  questionId: string; // UUID
  questionText?: string;
  operator: "equal" | "and" | "or";
  value: string; // string 
}

export interface IRule {
  id?: string;
  name?: string;
  conditions: ICondition[];
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
