// ─── Generic Option (JSONB array item) ───────────────────────────────────────
export interface GenericOption {
  name: string;
  frequency: number;
  preferred_time: string;       // "HH:MM:SS"
  notification_enabled: boolean;
}

// ─── Plant Species (from /allplants) ─────────────────────────────────────────
export interface Plant {
  id: string;
  scientific_name: string;
  common_name: string;
  description: string | null;
  image_url: string | null;

  water_reminder_frequency: number;
  water_notification_enabled: boolean;

  fertilizer_schedule: number;
  fertilizer_notification_enabled: boolean;

  pruning_alert: number;
  pruning_notification_enabled: boolean;

  generic_options: GenericOption[];

  created_at: string;           // ISO date string
  updated_at: string;
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
    plant_id: number;
    common_name: string | null;
    scientific_name: string;
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
    last_pruned_at: string | null;
    next_pruned_at: string | null;
    generic_notification_enabled: boolean;
    generic_care_reminder_frequency: number;
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
export interface AddUserPlantInput {
  plant_id: number;
 

  watering_notification_enabled?: boolean;
  watering_preferred_time?: string; 

  fertilizer_notification_enabled?: boolean;
  fertilizer_preferred_time?: string;

  pruning_notification_enabled?: boolean;
  pruning_preferred_time?: string;

  generic_care_preferred_time?:string       // "HH:MM:SS"
  generic_notification_enabled?: boolean;

  watering_reminder_frequency: number;
  fertilizer_reminder_frequency: number;
  pruning_reminder_frequency: number;
  generic_care_reminder_frequency: number;
}


// export interface PaginatedUserPlants {
//     currentPage: number;
//     totalPages: number;
//     totalCount: number;
//     limit: number;
//     plants: UserPlant[];
// }



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

export interface UpdateUserPlantInput {
    watering?: CareNotificationInput;
    fertilizer?: CareNotificationInput;
    pruning?: CareNotificationInput;
    generic?: CareNotificationInput;
}


export interface CareUpdateFields {
    notification_enabled: boolean;
    preferred_time: string | null;
    reminder_frequency: number;
    next_at: Date | null;
    recalculate_next: boolean;
}


export interface FlatUpdateUserPlantInput {
    plant_id?: number; // ignored by update, but accepted so clients can send same body
    watering_notification_enabled?: boolean;
    watering_preferred_time?: string | null;
    watering_reminder_frequency?: number;
    fertilizer_notification_enabled?: boolean;
    fertilizer_preferred_time?: string | null;
    fertilizer_reminder_frequency?: number;
    pruning_notification_enabled?: boolean;
    pruning_reminder_frequency?: number;
    generic_notification_enabled?: boolean;
    generic_care_reminder_frequency?: number;
}

// ── Existing nested shape (keep as-is, service uses this) ────────────────────
export interface CareNotificationInput {
    notification_enabled: boolean;
    preferred_time?: string | null;
    reminder_frequency?: number;
}

export interface UpdateUserPlantInput {
    watering?: CareNotificationInput;
    fertilizer?: CareNotificationInput;
    pruning?: CareNotificationInput;
    generic?: CareNotificationInput;
}

export interface ReminderforUserPlant{
  watering_reminder_frequency: number | null;
  watering_preferred_time: string | null;
  watering_notification_enabled: boolean | null;
  next_watered_at: string | null;
  last_watered_at: string | null;
  fertilizer_reminder_frequency: number | null;
  fertilizer_preferred_time: string | null;
  fertilizer_notification_enabled: boolean | null;
  next_fertilized_at: string | null;
  last_fertilized_at: string | null;
  pruning_reminder_frequency: number | null;
  puring_notification_enabled: boolean | null;
  next_pruned_at: string | null;
  last_pruned_at: string | null;
  generic_care_reminder_frequency: number | null;
  generic_notification_enabled: boolean | null;
  last_generic_care_at: string | null;
  next_generic_care_at: string | null;                                                     
}
export type PlantDetailsResponse = {
    user_plant_id?: string;     
    plant: Plant;
    reminder: ReminderforUserPlant;
};
