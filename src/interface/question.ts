export interface Question {
  id?: string;
  question_text: string;
  order?: number | null;
  is_deleted?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface QuestionOption {
  id?: string;
  question_id: string;
  option_text: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface QuestionWithOptions extends Question {
  options: QuestionOption[];
}
