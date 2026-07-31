import { connectDB, disconnectDB, getDB } from "../src/core/config/db";

async function main(): Promise<void> {
  await connectDB();
  const db = getDB();
  const ids = [
    "5b424a7f-d67e-46e4-b26b-06d171fa2907",
    "5b424a7f-d67e-46e4-b98b-06d171fa2907",
  ];
  const users = await db.query(
    `SELECT id, email FROM users WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  const sub = await db.query(
    `SELECT us.user_id, sp.code AS plan, psp.code AS pending, us.status, us.current_period_end
     FROM user_subscriptions us
     JOIN subscription_plans sp ON sp.id = us.plan_id
     LEFT JOIN subscription_plans psp ON psp.id = us.pending_plan_id
     WHERE us.user_id = ANY($1::uuid[])`,
    [ids]
  );
  console.log("users", users.rows);
  console.log("subs", sub.rows);
  await disconnectDB();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await disconnectDB();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
