import { ISubscriptionPlan, SubscriptionPlanInput } from "../../interface/subscription";
import { getDB } from "../../core/config/db";

/**
 * Inserts a new subscription plan into the database.
 * 
 * @param {SubscriptionPlanInput} plan - The subscription plan data to create
 * @returns {Promise<ISubscriptionPlan>} The newly created subscription plan
 *
 * @example
 * const newPlan = await createSubscriptionPlan({
 *   plan_name: "Gold",
 *   description: "Best plan for professionals",
 *   monthly_price: 99.00,
 *   annual_price: 1188.00,
 *   lead_limit_per_month: 100,
 *   number_of_regions: 3,
 *   highlight_in_result: true,
 *   verification_badge: true,
 *   status: "active"
 * });
 */
export async function createSubscriptionPlan(
  plan: SubscriptionPlanInput 
): Promise<ISubscriptionPlan> {
  const client = await getDB();

  const query = `
    INSERT INTO subscrptionPlans (
      plan_name,
      description,
      price_monthly,
      price_annual,
      appear_in_search,
      leads_limit,
      cities_coverage,
      premium_profile_badge,
      priority_customer_support,
      status
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *;
  `;

  const values = [
    plan.plan_name,
    plan.description,
    plan.price_monthly,
    plan.price_annual,
    plan.appear_in_search,
    plan.leads_limit,
    plan.cities_coverage,
    plan.premium_profile_badge,
    plan.priority_customer_support,
    plan.status
  ];

  const result = await client.query<ISubscriptionPlan>(query, values);
  return result.rows[0]!;
}

/**
 * Fetches all subscription plans from the database, ordered by creation date descending.
 *
 * @returns {Promise<ISubscriptionPlan[]>} Array of subscription plans
 *
 * @example
 * const plans = await getAllSubscriptionPlans();
 * console.log(plans);
 */
export const getAllSubscriptionPlans = async (): Promise<ISubscriptionPlan[]> => {
  const client = await getDB();

  const query = `
    SELECT *
    FROM subscrptionPlans
    ORDER BY 
      CASE 
        WHEN plan_name = 'Silver' THEN 1
        WHEN plan_name = 'Gold' THEN 2
        WHEN plan_name = 'Diamante' THEN 3
        ELSE 4
      END;
  `;

  const result = await client.query<ISubscriptionPlan>(query);
  return result.rows;
};



/**
 * Updates an existing subscription plan by its ID.
 *
 * @param {string} planId - The ID of the subscription plan to update
 * @param {SubscriptionPlanInput} updates - The updated subscription plan data
 * @returns {Promise<ISubscriptionPlan | null>} The updated subscription plan, or null if not found
 *
 * @example
 * const updatedPlan = await updateSubscriptionPlan("uuid-of-plan", {
 *   plan_name: "Gold",
 *   description: "Updated description",
 *   monthly_price: 99.00,
 *   annual_price: 1188.00,
 *   lead_limit_per_month: 150,
 *   number_of_regions: 3,
 *   highlight_in_result: true,
 *   verification_badge: true,
 *   status: "active"
 * });
 */
export const updateSubscriptionPlan = async (
  planId: string,
  updates: SubscriptionPlanInput
): Promise<ISubscriptionPlan | null> => {
  const client = await getDB();

  const query = `
    UPDATE subscrptionPlans
    SET 
      plan_name = $1,
      description = $2,
      price_monthly = $3,
      price_annual = $4,
      leads_limit = $5,
      cities_coverage = $6,
      appear_in_search = $7,
      premium_profile_badge = $8,
      priority_customer_support=$9,
      status = $10,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $11
    RETURNING *;
  `;

  const values = [
    updates.plan_name,
    updates.description,
    updates.price_monthly,
    updates.price_annual,
    updates.leads_limit,
    updates.cities_coverage,
    updates.appear_in_search,
    updates.premium_profile_badge,
    updates.priority_customer_support,
    updates.status,
    planId,
  ];

  const result = await client.query<ISubscriptionPlan>(query, values);
  return result.rows[0] || null;
};


/**
 * Fetches a subscription plan by its ID.
 *
 * @param {string} planId - The ID of the subscription plan to retrieve
 * @returns {Promise<ISubscriptionPlan | null>} The subscription plan if found, otherwise null
 *
 * @example
 * const plan = await getSubscriptionPlanById("uuid-of-plan");
 * if (plan) {
 *   console.log(plan.plan_name);
 * }
 */
export const getSubscriptionPlanById = async (
  planId: string
): Promise<ISubscriptionPlan | null> => {
  const client = await getDB();

  const query = `
    SELECT
      id,
      plan_name,
      description,
      price_monthly,
      price_annual,
      appear_in_search,
      leads_limit,
      cities_coverage,
      premium_profile_badge,
      priority_customer_support,
      status,
      created_at,
      updated_at
    FROM subscrptionPlans
    WHERE id = $1
    LIMIT 1;
  `;

  const result = await client.query<ISubscriptionPlan>(query, [planId]);

  // Explicit type-safe conversion: undefined -> null
  const plan: ISubscriptionPlan | undefined = result.rows[0];
  return plan ?? null;
 // TS now sees this as ISubscriptionPlan
};


/**
 * Updates the status of a subscription plan by its ID.
 *
 * Currently supports partial updates for the `status` field only.
 *
 * @param planId - Unique ID of the subscription plan
 * @param updates - Object containing the new status value
 *
 * @returns The updated subscription plan if found, otherwise null
 */
export const updateSubscriptionPlanStatusById = async (
  planId: string,
  updates: Partial<Pick<ISubscriptionPlan, "status">> // currently only status for PATCH
): Promise<ISubscriptionPlan | null> => {
  const client = await getDB();

  const query = `
    UPDATE subscrptionPlans
    SET 
      status = $1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;

  const values = [updates.status, planId];

  const result = await client.query<ISubscriptionPlan>(query, values);
  return result.rows[0] || null;
};

