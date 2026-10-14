import * as schema from "@geo/db";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const client = postgres(databaseUrl, {
  max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  prepare: false
});

export const db = drizzle(client, { schema });
