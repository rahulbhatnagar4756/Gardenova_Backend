import { connectDB, disconnectDB, getDB } from "../src/core/config/db";

async function main(): Promise<void> {
  const userId = process.argv[2];
  if (!userId) {
    console.error("userId required");
    process.exit(1);
  }
  await connectDB();
  const db = getDB();

  const logs = await db.query(
    `
    SELECT level, message, method, url, "timestamp", source
    FROM logs
    WHERE "userId" = $1::uuid
       OR url ILIKE '%subscriptions/verify%'
    ORDER BY "timestamp" DESC
    LIMIT 40
    `,
    [userId]
  );
  console.log(JSON.stringify(logs.rows, null, 2));
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
