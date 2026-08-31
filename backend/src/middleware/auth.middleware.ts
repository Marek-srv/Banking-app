// src/middleware/auth.middleware.ts

import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../errors/app-error";
import { prisma } from "../config/prisma";

interface AuthTokenPayload extends JwtPayload {
  userId: string;
  role: string;
  tokenVersion: number;
}

function isAuthTokenPayload(
  payload: string | JwtPayload
): payload is AuthTokenPayload {
  return (
    typeof payload !== "string" &&
    typeof payload.userId === "string" &&
    typeof payload.role === "string" &&
    typeof payload.tokenVersion === "number"
  );
}

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
    return;
  }

  try {
    const token = header.slice("Bearer ".length).trim();

    if (!token) {
      throw new Error("EMPTY_TOKEN");
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (!isAuthTokenPayload(decoded)) {
      throw new Error("INVALID_TOKEN_PAYLOAD");
    }

    const user = await prisma.users.findUnique({
      where: { user_id: BigInt(decoded.userId) },
      select: { status: true, role: true, token_version: true, email_verified: true },
    });

    if (
      !user ||
      user.status !== "ACTIVE" ||
      !user.email_verified ||
      user.role !== decoded.role ||
      user.token_version !== decoded.tokenVersion
    ) {
      throw new Error("INVALID_TOKEN_STATE");
    }

    req.user = {
      userId: decoded.userId,
      role: user.role,
    };

    next();
  } catch {
    next(new AppError(401, "INVALID_TOKEN", "Invalid or expired token"));
  }
}

export function authorizeRoles(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new AppError(401, "UNAUTHORIZED", "Authentication required"));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new AppError(403, "FORBIDDEN", "Access denied"));
      return;
    }

    next();
  };
}
