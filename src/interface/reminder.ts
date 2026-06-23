export type ReminderType = "water" | "fertilize" | "prune" | "generic";

export interface UserPlant {
    id:                              string;
    user_id:                         string;
    plant_id:                        number;
    common_name:                     string;

    watering_notification_enabled:   boolean;
    watering_reminder_frequency:     number;
    watering_preferred_time:         string | null;
    next_watered_at:                 Date | null;
    last_watered_at:                 Date | null;
    watering_note:                   string | null;

    fertilizer_notification_enabled: boolean;
    fertilizer_reminder_frequency:   number;
    fertilizer_preferred_time:       string | null;
    next_fertilized_at:              Date | null;
    last_fertilized_at:              Date | null;
    fertilizer_note:                 string | null;

    pruning_notification_enabled:    boolean;
    pruning_reminder_frequency:      number;
    pruning_preferred_time:          string | null;
    next_pruned_at:                  Date | null;
    last_pruned_at:                  Date | null;
    pruning_note:                    string | null;

    generic_notification_enabled:    boolean;
    generic_care_reminder_frequency: number;
    generic_care_preferred_time:     string | null;
    next_generic_care_at:            Date | null;
    last_generic_care_at:            Date | null;
    generic_care_note:               string | null;
}

export interface NotificationLog {
    id:                string;
    user_plant_id:     string;
    user_id:           string;
    reminder_type:     ReminderType;
    scheduled_for:     Date;
    sent_at:           Date;
    status:            "sent" | "completed";
    fcm_message_id:    string | null;
    created_at:        Date;
    updated_at:        Date;
}

export interface FcmToken {
  id: string;
  user_id: string;
  token: string;
}

export interface DueReminder {
    plant:        UserPlant;
    type:         ReminderType;
    scheduledFor: Date;
    note:         string | null;   // ← added
}