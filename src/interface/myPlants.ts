// ─── Generic Option (JSONB array item) ───────────────────────────────────────
export interface GenericOption {
  name: string;
  frequency: number;
  preferred_time: string;       // "HH:MM:SS"
  notification_enabled: boolean;
}

// ─── Plant Species (live plant_table_final) ──────────────────────────────────
export interface Plant {
    // Identification
    plant_id: number;
    scientific_name: string | null;
    common_name: string | null;
    other_name: string | null;
    family: string | null;
    genus: string | null;
    species_epithet: string | null;
    hybrid: string | null;
    author: string | null; // maps from authority
    subspecies: string | null;
    cultivar: string | null;
    variety: string | null;
    origin: string | null;

    // Growth & Description
    plant_type: string | null; // maps from type
    type: string | null;
    description: string | null;
    cycle: string | null;
    growth_rate: string | null;
    dimension_type: string | null;
    dimension_min_value: string | null;
    dimension_max_value: string | null;
    dimension_unit: string | null;

    // Care Requirements
    watering: string | null;
    watering_benchmark_value: string | null;
    watering_benchmark_unit: string | null;
    sunlight: string | null;
    hardiness_min: string | null;
    hardiness_max: string | null;
    maintenance: string | null;
    care_level: string | null;
    soil: string | null;
    pruning_month: string | null;
    propagation: string | null;

    // Environmental & Traits
    attracts: string | null;
    pest_susceptibility: string | null;
    plant_anatomy: string | null;
    drought_tolerant: boolean | null;
    salt_tolerant: boolean | null;
    thorny: boolean | null;
    invasive: boolean | null;
    tropical: boolean | null;
    indoor: boolean | null;

    // Flowers & Fruits
    flowers: boolean | null;
    flowering_season: string | null;
    cones: boolean | null;
    fruits: boolean | null;
    edible_fruit: boolean | null;
    harvest_season: string | null;
    leaf: boolean | null;
    edible_leaf: boolean | null;
    seeds: boolean | null;

    // Usage & Safety
    cuisine: boolean | null;
    medicinal: boolean | null;
    poisonous_to_humans: boolean | null;
    poisonous_to_pets: boolean | null;

    // Media & Resources
    care_guides_url: string | null;
    image_original_url: string | null;
    image_regular_url: string | null;
    image_medium_url: string | null;
    image_small_url: string | null;
    image_thumbnail: string | null;
    image_license: string | null;
    image_url: string | null; // derived from local_image_path
}

export interface  AdminPlant extends Plant {
  plant_id: number;
}

// ─── Paginated response wrapper (/allplants) ──────────────────────────────────
export interface PaginatedPlants {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  plants: Plant[];
}

// ─── User's own plant (from /userplants) ─────────────────────────────────────
export interface UserPlant {
    user_plant_id: string;
    plant_id: string;
    common_name: string ;
    scientific_name: string;
    local_image_path: string | null;
    family: string | null;
    genus: string | null;
    image_url: string | null;
    health_status: string;
    watering_notification_enabled: boolean;
    watering_preferred_time: string | null;
    watering_reminder_frequency: number;
    last_watered_at: string | null;
    next_watered_at: string | null;
    fertilizer_notification_enabled: boolean;
    fertilizer_preferred_time: string | null;
    fertilizer_reminder_frequency: number;
    last_fertilized_at: string | null;
    next_fertilized_at: string | null;
    pruning_notification_enabled: boolean;
    pruning_reminder_frequency: number;
    pruning_preferred_time: string | null;
    last_pruned_at: string | null;
    next_pruned_at: string | null;
    generic_notification_enabled: boolean;
    generic_care_reminder_frequency: number;
    generic_care_preferred_time: string | null;
    last_generic_care_at: string | null;
    next_generic_care_at: string | null;
    added_at: string;
    created_at: string;
    updated_at: string;
}

export interface PaginatedUserPlants {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    plants: UserPlant[];
}

// ─── User plants response wrapper (/userplants) ───────────────────────────────
export interface UserPlantsResult {
  totalCount: number;
  plants: UserPlant[];
}

// ─── Add plant input ──────────────────────────────────────────────────────────
export type AddUserPlantInput = {
    plant_id: number;

    watering_notification_enabled?: boolean;
    watering_preferred_time?: string;
    watering_reminder_frequency?: number;
    watering_note?: string | null;

    fertilizer_notification_enabled?: boolean;
    fertilizer_preferred_time?: string;
    fertilizer_reminder_frequency?: number;
    fertilizer_note?: string | null;

    pruning_notification_enabled?: boolean;
    pruning_preferred_time?: string;
    pruning_reminder_frequency?: number;
    pruning_note?: string | null;

    generic_notification_enabled?: boolean;
    generic_care_preferred_time?: string;
    generic_care_reminder_frequency?: number;
    generic_care_note?: string | null;
};

export interface PlantRow {
  common_name?: string;
  scientific_name?: string;
  family?: string;
  genus?: string;
  light?: string;
  ground_humidity?: string;
  atmospheric_humidity?: string;
  soil_nutriments?: string;
  soil_salinity?: string;
  ph_minimum?: string;
  ph_maximum?: string;
  growth_rate?: string;
  growth_habit?: string;
  average_height_cm?: string;
  maximum_height_cm?: string;
  minimum_root_depth_cm?: string;
  edible?: string;
  vegetable?: string;
  flower_color?: string;
  foliage_color?: string;
  foliage_texture?: string;
  bloom_months?: string;
  growth_months?: string;
  fruit_months?: string;
  image_url?: string;
  common_names?: string;
  distributions?: string;
  growth_rate_pt?: string;
  gowth_habit_pt?: string;
  edible_pt?: string;
  vegetable_pt?: string;
  flower_color_pt?: string;
  foliage_color_pt?: string;
  foliage_texture_pt?: string;
}
 
export interface ImportResult {
  success: boolean;
  total: number;
  inserted: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}
 



export interface PlantDetails {
  id: number;
  common_name: string |null;
  scientific_name: string;
  family: string | null;
  genus: string | null;
  watering: string | null;
  sunlight: string | null;
  care_level: string | null;
  growth_rate: string | null;
  indoor: boolean | null;
  temperature_min: number | null;
  temperature_max: number | null;
  humidity_min: number | null;
  humidity_max: number | null;
  light_min: number | null;
  light_max: number | null;
  soil_moisture_min: number | null;
  soil_moisture_max: number | null;
  poisonous_to_humans: boolean | null;
  poisonous_to_pets: boolean | null;
  drought_tolerant: boolean | null;
  tropical: boolean | null;
  medical: boolean | null;
  edible: boolean | null;
  soil: string | null;
  fertilizer: string | null;
  pruning: string | null;
  cycle: string | null;
  pest: string | null;
  diseases: string | null;
  origin: string | null;
  category: string | null;
  climate: string | null;
  color: string | null;
  blooming: string | null;
  description: string | null;
  image_url: string | null;
  source: string | null;
  Water_reminder_frequency: number | null;
  
}

export interface Reminder{
  watering_reminder_frequency: number | null;
  watering_preferred_time: string | null;
  watering_notification_enabled: boolean | null;
  fertilizer_reminder_frequency: number | null;
  fertilizer_preferred_time: string | null;
  fertilizer_notification_enabled: boolean | null;
  pruning_reminder_frequency: number | null;
  puring_notification_enabled: boolean | null;
  generic_care_reminder_frequency: number | null;
  generic_notification_enabled: boolean | null;                                                     
}

export interface PlantResponse{
  plant: PlantDetails;
  care: {
    watering: string | null;
    sunlight: string | null;
    pruning:  string | null;
} | null;
disease: {
  host: string | null;
  description: string | null;
  solution: string | null;
  local_image_disease_path: string | null;
} | null;
  AlreadyAdded: boolean;
  reminder: Reminder;
}



export interface ReminderSettings {
  frequency?: number;        // days between reminders (0 = disabled)
  notificationEnabled?: boolean;
  preferredTime?: string;    // "HH:MM:SS" — only for watering & fertilizer
  lastDoneAt?: string;       // ISO timestamp — triggers next_*_at recalculation
}

export interface UpdateUserPlantRemindersInput {
  // userId: string;
  plantId: number;
  watering?: ReminderSettings;
  fertilizer?: ReminderSettings;
  pruning?: ReminderSettings;
  genericCare?: ReminderSettings;
  healthStatus?: "healthy" | "sick" | "recovering" | "dormant";
}

export interface UpdateUserPlantRemindersResult {
  success: boolean;
  message: string;
  updatedAt?: string;
}

// export interface CareNotificationInput {
//     notification_enabled: boolean;
//     preferred_time?: string | null;   // required when enabled
//     reminder_frequency?: number | null; // required when enabled
//     // recalculate_next?: boolean; // only used for update, forces next_*_at recalculation based on last_*_at when true
// }

// export interface UpdateUserPlantInput {
//     watering?:   CareNotificationInput;
//     fertilizer?: CareNotificationInput;
//     pruning?:    CareNotificationInput;
//     generic?:    CareNotificationInput;
// }

export type CareUpdateFields = {
    notification_enabled: boolean;
    preferred_time: string | null;
    reminder_frequency: number;
    next_at:Date | null;
    recalculate_next: boolean;
    note: string | null;
};



export type FlatUpdateUserPlantInput = {
    watering_notification_enabled?: boolean;
    watering_preferred_time?: string | null;
    watering_reminder_frequency?: number;
    watering_note?: string | null;

    fertilizer_notification_enabled?: boolean;
    fertilizer_preferred_time?: string | null;
    fertilizer_reminder_frequency?: number;
    fertilizer_note?: string | null;

    pruning_notification_enabled?: boolean;
    pruning_preferred_time?: string | null;
    pruning_reminder_frequency?: number;
    pruning_note?: string | null;

    generic_notification_enabled?: boolean;
    generic_care_preferred_time?: string | null;
    generic_care_reminder_frequency?: number;
    generic_care_note?: string | null;
};
 

// ── Existing nested shape (keep as-is, service uses this) ────────────────────
export type CareNotificationInput = {
    notification_enabled: boolean;
    preferred_time?: string | null;
    reminder_frequency?: number;
    note?: string | null;
};

export type UpdateUserPlantInput = {
    watering?: CareNotificationInput;
    fertilizer?: CareNotificationInput;
    pruning?: CareNotificationInput;
    generic?: CareNotificationInput;
    note?: string | null;
};
export interface ReminderforUserPlant {
    watering_notification_enabled: boolean | null;
    watering_reminder_frequency: number | null;
    watering_preferred_time: string | null;
    next_watered_at: string | null;
    last_watered_at: string | null;
    watering_note: string | null;

    fertilizer_notification_enabled: boolean | null;
    fertilizer_reminder_frequency: number | null;
    fertilizer_preferred_time: string | null;
    next_fertilized_at: string | null;
    last_fertilized_at: string | null;
    fertilizer_note: string | null;

    pruning_notification_enabled: boolean | null;   // ← fixed typo: was puring_
    pruning_reminder_frequency: number | null;
    pruning_preferred_time: string | null;
    next_pruned_at: string | null;
    last_pruned_at: string | null;
    pruning_note: string | null;

    generic_notification_enabled: boolean | null;
    generic_care_reminder_frequency: number | null;
    generic_care_preferred_time: string | null;
    last_generic_care_at: string | null;
    next_generic_care_at: string | null;
    generic_care_note: string | null;
}
export type PlantDetailsResponse = {
    user_plant_id?: number;     
    plant: Plant;
    care: {
    watering: string | null;
    sunlight: string | null;
    pruning:  string | null;
} | null;
disease: {
  host: string | null;
  description: string | null;
  solution: string | null;
  local_image_disease_path: string | null;
} | null;
    reminder: ReminderforUserPlant;
};

export interface PaginatedPlantsResponse {
    data: AdminPlant[];
    currentPage: number;
    totalPages: number;
    totalItems: number;
}


export interface NotificationDetail {
  id: string;
  user_id: string;
  added_at: Date;
  watering_reminder_frequency: number;
  last_watered_at: Date | null;
  next_watered_at: Date | null;
  watering_notification_enabled: boolean;
  watering_preferred_time: string | null;

  fertilizer_reminder_frequency: number;
  last_fertilized_at: Date | null;
  next_fertilized_at: Date | null;
  fertilizer_notification_enabled: boolean;
  fertilizer_preferred_time: string | null;

  pruning_reminder_frequency: number;
  last_pruned_at: Date | null;
  next_pruned_at: Date | null;
  pruning_notification_enabled: boolean;
  pruning_preferred_time: string | null;

  generic_care_reminder_frequency: number;
  last_generic_care_at: Date | null;
  next_generic_care_at: Date | null;
  generic_notification_enabled: boolean;
  generic_care_preferred_time: string | null;

  health_status: string;

  created_at: Date;
  updated_at: Date;

  plant_id: number;

  watering_snooze_minutes: number;
  fertilizer_snooze_minutes: number;
  pruning_snooze_minutes: number;
  generic_care_snooze_minutes: number;

  common_name: string;
  scientific_name: string;
}
interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}
export type ActivityType = "watering" | "fertilizing" | "pruning" | "generic";
export type EventType = "upcoming" | "missed" | "completed" | "all";
 
export interface NotificationRow {
  user_plant_id: string;
  plant_id: number;
  common_name: string;
  scientific_name: string;
  activity_type: ActivityType;
  next_at: Date | null;
  last_at: Date | null;
  frequency_days: number;
  snooze_minutes: number;
  preferred_time: string | null;
  event_type: "upcoming" | "missed" | "completed";
  is_upcoming_in_5_hours: boolean;
}
 
export interface NotificationCounts {
  all: number;
  upcoming: number;
  missed: number;
  completed: number;
}
 
export interface NotificationResponse {
  counts: NotificationCounts;
  upcoming_in_5_hours: {
    count: number;
    tasks: NotificationRow[];
  };
  tasks: NotificationRow[];
  pagination: Pagination;   // ← new

}


