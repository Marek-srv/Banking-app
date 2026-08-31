// src/server.ts

import "dotenv/config";
import { env } from "./config/env";
import app from "./app";
import { pool } from "./config/db";

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

void env;

async function startServer() {
  try {
    await pool.query("SELECT NOW()");

    console.log("PostgreSQL connected");

    app.listen(PORT, HOST, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
}

startServer();
