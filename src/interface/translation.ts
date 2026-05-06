export interface JsonResponseBody {
  message?: string;
  [key: string]: unknown;
}

export type TranslatableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | TranslatableObject
  | TranslatableArray;

export type TranslatableObject = { [key: string]: TranslatableValue };

export type TranslatableArray = TranslatableValue[];
