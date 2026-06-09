export type ReminderType = 'watering' | 'fertilizer' | 'pruning' | 'generic_care';

export interface UserPlant {
  id: string;
  user_id: string;
  plant_id: number;

  watering_notification_enabled: boolean;
  watering_reminder_frequency: number;
  last_watered_at: Date | null;
  next_watered_at: Date | null;
  watering_preferred_time: string | null; // "08:00:00"
  watering_snooze_minutes: number;

  fertilizer_notification_enabled: boolean;
  fertilizer_reminder_frequency: number;
  last_fertilized_at: Date | null;
  next_fertilized_at: Date | null;
  fertilizer_preferred_time: string | null;
  fertilizer_snooze_minutes: number;

  pruning_notification_enabled: boolean;
  pruning_reminder_frequency: number;
  last_pruned_at: Date | null;
  next_pruned_at: Date | null;
  pruning_preferred_time: string | null;
  pruning_snooze_minutes: number;

  generic_notification_enabled: boolean;
  generic_care_reminder_frequency: number;
  last_generic_care_at: Date | null;
  next_generic_care_at: Date | null;
  generic_care_preferred_time: string | null;
  generic_care_snooze_minutes: number;
}

export interface NotificationLog {
  id: string;
  user_plant_id: string;
  user_id: string;
  reminder_type: ReminderType;
  scheduled_for: Date;
  sent_at: Date;
  status: 'sent' | 'snoozed' | 'completed';
  snoozed_until: Date | null;
  fcm_message_id: string | null;
}

export interface FcmToken {
  id: string;
  user_id: string;
  token: string;
}

export interface DueReminder {
  plant: UserPlant;
  type: ReminderType;
  scheduledFor: Date;
}