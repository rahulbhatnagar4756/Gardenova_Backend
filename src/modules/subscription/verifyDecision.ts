import { comparePlanChange, PlanChangeKind, SubscriptionPlan } from "../../interface/subscription";

export type VerifyMode = "activate" | "defer";

export interface VerifyDecisionInput {
  hasPaidCurrent: boolean;
  currentPlan: Pick<SubscriptionPlan, "id" | "code" | "tier" | "price_inr">;
  activeLinePlan: Pick<SubscriptionPlan, "id" | "code" | "tier" | "price_inr">;
  pendingTargetPlan: Pick<SubscriptionPlan, "id" | "code" | "tier" | "price_inr"> | null;
  deferredFromPlay: boolean;
  bodyMappedPlan: Pick<SubscriptionPlan, "id" | "code" | "tier" | "price_inr"> | null;
}

export interface VerifyDecision {
  changeKind: PlanChangeKind;
  mode: VerifyMode;
  /** Plan that should be active now */
  keepOrActivatePlan: Pick<SubscriptionPlan, "id" | "code" | "tier" | "price_inr">;
  /** Pending plan when mode === defer */
  pendingPlan: Pick<SubscriptionPlan, "id" | "code" | "tier" | "price_inr"> | null;
  playAlreadyOnLower: boolean;
}

/**
 * Pure upgrade / downgrade decision used by verify (no I/O).
 *
 * Rules:
 * - First paid purchase / upgrade → activate Play line plan now
 * - Downgrade (tier/price) → keep CURRENT paid plan, pending = lower plan
 *   even if Play already shows the lower SKU (immediate replacement)
 * - Play deferredItemReplacement → always defer
 *
 * @param {VerifyDecisionInput} input - Current + Play + body plan signals.
 * @returns {VerifyDecision} Activate vs defer decision.
 */
export function decideVerifyChange(input: VerifyDecisionInput): VerifyDecision {
  const {
    hasPaidCurrent,
    currentPlan,
    activeLinePlan,
    pendingTargetPlan,
    deferredFromPlay,
    bodyMappedPlan,
  } = input;

  const candidate = pendingTargetPlan ?? activeLinePlan;
  const changeKind: PlanChangeKind = hasPaidCurrent
    ? comparePlanChange(currentPlan, candidate)
    : "upgrade";

  const deferredPlan =
    pendingTargetPlan ??
    (changeKind === "downgrade" && hasPaidCurrent ? bodyMappedPlan : null);

  const playAlreadyOnLower =
    hasPaidCurrent &&
    changeKind === "downgrade" &&
    !deferredFromPlay &&
    activeLinePlan.id !== currentPlan.id &&
    activeLinePlan.id === candidate.id;

  const shouldDefer =
    !!deferredFromPlay ||
    (changeKind === "downgrade" && hasPaidCurrent && !!deferredPlan);

  if (shouldDefer && deferredPlan) {
    // Always keep the higher/current entitlement until period end.
    return {
      changeKind,
      mode: "defer",
      keepOrActivatePlan: hasPaidCurrent ? currentPlan : activeLinePlan,
      pendingPlan: deferredPlan,
      playAlreadyOnLower,
    };
  }

  return {
    changeKind,
    mode: "activate",
    keepOrActivatePlan: activeLinePlan,
    pendingPlan: null,
    playAlreadyOnLower,
  };
}
