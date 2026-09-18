import { ChallengeCategory, ChallengeEventType } from "./challengeCatalog";

export interface UserGamificationRow {
  user_id: string;
  total_points: number;
  care_streak: number;
  last_care_date: string | null;
  landscape_count: number;
}

export interface UserDailyChallengeRow {
  id: string;
  user_id: string;
  challenge_code: string;
  challenge_date: string;
  title: string;
  description: string | null;
  category: string;
  points: number;
  target_count: number;
  progress_count: number;
  status: "active" | "completed" | "expired";
  metadata: Record<string, unknown>;
  completed_at: string | null;
  created_at: string;
}

export interface PlantAddedEvent {
  type: "plant_added";
  plantId: string | number;
  userPlantId?: string | undefined;
  indoor?: boolean | null;
  flowers?: boolean | null;
  leaf?: boolean | null;
  maintenance?: string | null;
  growthForm?: string | null;
}

export interface CareCompletedEvent {
  type: "care_completed";
  userPlantId: string;
  activityType: string;
}

export interface ScanCompletedEvent {
  type: "scan_completed";
  scanId?: string | null;
  plantName?: string | null;
  isHealthy?: boolean | null;
  predictedDisease?: string | null;
  matchedOwnedPlant?: boolean;
}

export interface CompareScanCompletedEvent {
  type: "compare_scan_completed";
  scanId?: string | null;
  plantName?: string | null;
  isHealthy?: boolean | null;
  predictedDisease?: string | null;
}

export interface LandscapeCreatedEvent {
  type: "landscape_created";
  spaceCategory?: string | null;
  spaceType?: string | null;
}

export interface CareRoutineViewedEvent {
  type: "care_routine_viewed";
}

export type GamificationEvent =
  | PlantAddedEvent
  | CareCompletedEvent
  | ScanCompletedEvent
  | CompareScanCompletedEvent
  | LandscapeCreatedEvent
  | CareRoutineViewedEvent;

export interface UserChallengeContext {
  plantCount: number;
  indoorPlantCount: number;
  outdoorPlantCount: number;
  floweringPlantCount: number;
  leafyPlantCount: number;
  lowMaintenancePlantCount: number;
  growthForms: string[];
  oldestUserPlantId: string | null;
  newestUserPlantId: string | null;
  neglectedUserPlantId: string | null;
  scanCount: number;
  scansToday: number;
  distinctScanPlantNames: number;
  hasUnhealthyDiagnosis: boolean;
  lastUnhealthyIssue: string | null;
  lastUnhealthyPlantName: string | null;
  hasScanOlderThan7Days: boolean;
  hasAnyPreviousScan: boolean;
  careCompletedCount: number;
  careCompletedToday: number;
  careStreak: number;
  landscapeCount: number;
  spaceLabel: string | null;
  wateringLabel: string | null;
  experienceLabel: string | null;
  isBeginner: boolean;
  isIndoorSpace: boolean;
  isBalconySpace: boolean;
  isOutdoorSpace: boolean;
  completedOnceCodes: Set<string>;
  /** True when user is on a paid (non-free) plan. */
  isPaid: boolean;
  /** Remaining diagnosis scans this month (-1 = unlimited). */
  diagnosisRemaining: number;
  diagnosisLimit: number;
  /** Remaining landscape generations this month (-1 = unlimited). */
  landscapeRemaining: number;
  landscapeLimit: number;
  canDiagnose: boolean;
  canLandscape: boolean;
}

export interface AssignedChallengeView {
  id: string;
  code: string;
  title: string;
  description: string | null;
  category: ChallengeCategory;
  points: number;
  targetCount: number;
  progressCount: number;
  status: "active" | "completed" | "expired";
  completedAt: string | null;
  metadata: Record<string, unknown>;
}

export interface GamificationSummary {
  totalPoints: number;
  careStreak: number;
  landscapeCount: number;
  challengesCompletedToday: number;
  pointsEarnedToday: number;
}

export interface PlanQuotaView {
  isPaid: boolean;
  diagnosisLimit: number;
  diagnosisRemaining: number;
  canDiagnose: boolean;
  landscapeLimit: number;
  landscapeRemaining: number;
  canLandscape: boolean;
}

export type ChallengeEvent = ChallengeEventType;
