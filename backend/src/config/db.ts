// src/config/db.ts

import "dotenv/config";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();

export const pool = new Pool(
  databaseUrl
    ? { connectionString: databaseUrl }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      }
);
