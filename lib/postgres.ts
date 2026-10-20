import postgres from "postgres";

const connectionString = process.env.DATABASE_URL || "";

// For Neon/Aurora serverless, we use ssl="require".
// On Vercel serverless functions, cap max pool connections to 1 per lambda
// to avoid exhausting Postgres connection limits.
const sql = postgres(connectionString, {
  ssl: "require",
  max: process.env.VERCEL ? 1 : 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export default sql;
