export interface SimilarImage {
  id?: string;
  url: string;
  url_small: string;
  similarity: number;
  license_name: string;
  license_url?: string;
  citation?: string;
}
export interface IAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}
export interface ISocialLinks {
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  instagram?: string;
}

export enum FieldIndex {
  space_types = 0,
  area_sizes = 1,
  challenges = 2,
  tech_preferences = 3,
  locations = 4,
}

export interface AppError extends Error {
  code?: string;
}
