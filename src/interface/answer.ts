// Types for answers
export interface IAnswerType1or2 {
  type: 1 | 2;
  questionId: string;
  selectedOption: string;
}

export type ISubmitAnswer = IAnswerType1or2;

export interface IPartnerRecommendation {
  partnerId: string;
  email: string;
  mobileNumber: string;
  companyName?: string;
  speciality?: string[];
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
  website?: string;
  contactPerson?: string;
  projectImageUrl?: string;
  status?: string;
  rating: string;
  whyRecommended?: string;
}

// export interface ISelectedAddress {
//   state: string;
//   city: string;
// }

// export interface IUserAnswer {
//   questionId: string;
//   type: number; // 1 = option, 2 = address
//   selectedOption?: string;
//   selectedAddress?: ISelectedAddress;
// }
export interface IUserAnswer {
  questionId?: string;
  type?: string;
  selectedOption?: string;
  selectedAddress?: {
    state?: string;
    city?: string;
  } | undefined;
}

export interface IPlantRecommendation {
  /** Primary key from the plants table */
  id: number;
 
  /** Display name (common_name) — null if not available */
  commonName: string | null;
 
  /** Scientific / species name — always present */
  scientificName: string;
 
  /** Alternative common names */
  otherName: string | null;
 
  /** Botanical family (e.g. "Rosaceae") */
  family: string | null;
 
  /** Botanical genus (e.g. "Rosa") */
  genus: string | null;
 
  /** Plant category (e.g. "tree", "herb", "shrub") */
  type: string | null;
 
  /** Life cycle (e.g. "Perennial", "Annual") */
  cycle: string | null;
 
  /** Watering need (e.g. "Average", "Frequent", "Minimum") */
  watering: string | null;
 
  /** Pipe-separated sunlight values (e.g. "full sun|part shade") */
  sunlight: string | null;
 
  /** Overall care difficulty (e.g. "Low", "Medium", "High") */
  careLevel: string | null;
 
  /** Maintenance level (e.g. "Low", "Moderate", "High") */
  maintenance: string | null;
 
  /** Growth rate (e.g. "Slow", "Moderate", "High") */
  growthRate: string | null;
 
  /** True if the plant survives with little water */
  droughtTolerant: boolean | null;
 
  /** True if the plant tolerates salty soil or air */
  saltTolerant: boolean | null;
 
  /** True if the plant is tropical in origin or requirement */
  tropical: boolean | null;
 
  /** True if the plant can be grown indoors */
  indoor: boolean | null;
 
  /** True if the plant produces flowers */
  flowers: boolean | null;
 
  /** Season(s) when flowers appear (e.g. "Spring, Summer") */
  floweringSeason: string | null;
 
  /** True if the plant produces fruits */
  fruits: boolean | null;
 
  /** True if the fruit is safe to eat */
  edibleFruit: boolean | null;
 
  /** Season(s) when fruit can be harvested */
  harvestSeason: string | null;
 
  /** True if the plant has notable foliage / leaves */
  leaf: boolean | null;
 
  /** True if the leaves are safe to eat */
  edibleLeaf: boolean | null;
 
  /** True if the plant is used in cooking */
  cuisine: boolean | null;
 
  /** True if the plant has medicinal uses */
  medicinal: boolean | null;
 
  /** True if the plant is toxic to humans */
  poisonousToHumans: boolean | null;
 
  /** True if the plant is toxic to pets */
  poisonousToPets: boolean | null;
 
  /** Minimum USDA hardiness zone the plant survives in */
  hardinessMin: number | null;
 
  /** Maximum USDA hardiness zone the plant survives in */
  hardinessMax: number | null;
 
  /** Full prose description of the plant */
  description: string | null;
 
  /** image_original_url — full-resolution, use sparingly */
  imageOriginal: string | null;
 
  /** image_regular_url — best size for recommendation cards */
  image: string | null;
 
  /** image_medium_url */
  imageMedium: string | null;
 
  /** image_small_url */
  imageSmall: string | null;
 
  /** image_thumbnail — smallest, use for lists / grids */
  imageThumbnail: string | null;
  image_url: string | null;
 
  /** Computed score from the quiz (higher = better match) */
  matchScore: number;
 
  /** Human-readable bullet points explaining why this plant was recommended */
  whyRecommended: string[];
}
export interface IPartnerProfile {
  id: string;
  email: string;
  mobile_number: string;
  company_name: string | null;
  speciality_1: string | null;
  speciality_2: string | null;
  speciality_3: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip_code: string | null;
  website: string | null;
  contact_person: string | null;
  project_image_url: string | null;
  rating: number | null;
  status: string;
}

export interface ISelectedAddress {
  state: string;
  city: string;
}

export interface ISurveyAnswer {
  questionId: string;
  type: number;
  selectedOption?: string | null;
  selectedAddress?: ISelectedAddress | null;
}

//  For type=2 (address-based answer)
export interface ISelectedAddress {
  state: string;
  city: string;
}

//For each answer in the "answers" array
export interface ISurveyAnswerItem {
  questionId: string; // UUID of the question
  responseId?: string;
  type: 1 | 2; // 1 = option, 2 = address
  selectedOption?: string;
  selectedAddress?: ISelectedAddress;
}

//  Full survey response
export interface ISurveyResponse {
  answers: ISurveyAnswerItem[]; // Array of answer items
}
