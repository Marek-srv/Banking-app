import { Request } from "express";
import { AuditContext } from "../services/audit.service";

export function getAuditContext(req: Request): AuditContext {
  const ipAddress = req.ip || req.socket.remoteAddress || "UNKNOWN";

  return {
    ipAddress: ipAddress.slice(0, 45),
  };
}
