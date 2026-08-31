import { pool } from "../src/config/db";
import { cleanupStressFixture } from "./fixture";

async function main() {
  try {
    await cleanupStressFixture();
    console.log("Synthetic Artillery fixture removed.");
  } finally {
    await pool.end();
  }
}

void main();
