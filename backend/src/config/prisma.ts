// src/config/prisma.ts

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { pool } from "./db";

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
