// utils/polls.ts

export type CustomPollQuestionType = 'short_text' | 'multi_choice';

export interface CustomPollOption {
  id: string;      // e.g. "club"
  label: string;   // e.g. "Clubbing"
}

export interface CustomPollQuestion {
  id: string;                       // "q1", "vibe", etc. must be unique per trip
  label: string;                    // question text
  type: CustomPollQuestionType;
  options?: CustomPollOption[];     // only for multi_choice
  required?: boolean;               // optional, MVP can ignore
}

export type CustomPollAnswers = Record<string, string | string[]>;
// qid -> value ("mix") or array if we later support multi-select
