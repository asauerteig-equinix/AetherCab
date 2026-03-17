import express, { type NextFunction, type Request, type Response } from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, timingSafeEqual } from "node:crypto";
import type {
  AuditCreateInput,
  AuditUpdateInput,
  DeviceTypeInput,
  DeviceTemplateInput,
  FeedbackInput,
  RackCreateInput,
  RackDeviceInput,
  RackUpdateInput
} from "../shared/types.js";
import { initializeDatabase } from "./db.js";
import { buildExcelExport, buildPdfExport } from "./exporters.js";
import { sendFeedbackEmail } from "./feedback.js";
import {
  cloneAudit,
  createAudit,
  createDeviceType,
  createRackInAudit,
  createRackDevice,
  createDeviceTemplate,
  deleteAudit,
  deleteDeviceType,
  deleteRack,
  deleteRackDevice,
  deleteDeviceTemplate,
  getAudit,
  getAuditExportDetail,
  getRack,
  listAudits,
  listDeviceTypes,
  listDeviceTemplates,
  reopenAudit,
  updateAudit,
  updateDeviceType,
  updateDeviceTemplate,
  updateRack,
  updateRackDevice
} from "./repository.js";

type AsyncRoute = (request: Request, response: Response, next: NextFunction) => Promise<void>;

const adminCookieName = "aethercad_admin_session";

function getAdminAccessKey(): string {
  return process.env.ADMIN_ACCESS_KEY ?? "aethercad-admin";
}

function getAdminSessionToken(): string {
  return createHash("sha256").update(getAdminAccessKey()).digest("hex");
}

function parseCookies(request: Request): Record<string, string> {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce<Record<string, string>>((cookies, entry) => {
    const [rawKey, ...rawValue] = entry.trim().split("=");
    if (!rawKey) {
      return cookies;
    }

    cookies[rawKey] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}

function isAdminAuthenticated(request: Request): boolean {
  const token = parseCookies(request)[adminCookieName];
  if (!token) {
    return false;
  }

  const expectedToken = getAdminSessionToken();
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expectedToken);

  if (tokenBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(tokenBuffer, expectedBuffer);
}

function setAdminCookie(response: Response): void {
  response.setHeader(
    "Set-Cookie",
    `${adminCookieName}=${encodeURIComponent(getAdminSessionToken())}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`
  );
}

function clearAdminCookie(response: Response): void {
  response.setHeader("Set-Cookie", `${adminCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function requireAdmin(request: Request, response: Response, next: NextFunction): void {
  if (!isAdminAuthenticated(request)) {
    response.status(403).json({ error: "Admin access required." });
    return;
  }

  next();
}

function asyncRoute(handler: AsyncRoute) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response, next).catch(next);
  };
}

function getFeedbackIpAddress(request: Request): string | null {
  const forwardedFor = request.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0]?.split(",")[0]?.trim() ?? null;
  }

  return request.socket.remoteAddress ?? null;
}

async function bootstrap(): Promise<void> {
  await initializeDatabase();

  const app = express();
  const clientDistPath = resolve(process.cwd(), "dist", "client");

  app.use(express.json());

  app.get("/api/admin/session", (request, response) => {
    response.json({ authenticated: isAdminAuthenticated(request) });
  });

  app.post(
    "/api/admin/session",
    (request, response) => {
      const body = request.body as { accessKey?: unknown };
      const accessKey = typeof body.accessKey === "string" ? body.accessKey : "";
      if (accessKey !== getAdminAccessKey()) {
        response.status(401).json({ error: "Invalid admin access key." });
        return;
      }

      setAdminCookie(response);
      response.status(204).send();
    }
  );

  app.delete("/api/admin/session", (_request, response) => {
    clearAdminCookie(response);
    response.status(204).send();
  });

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.post(
    "/api/feedback",
    asyncRoute(async (request, response) => {
      await sendFeedbackEmail(request.body as FeedbackInput, {
        ipAddress: getFeedbackIpAddress(request),
        browserUserAgent: typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : null
      });
      response.status(204).send();
    })
  );

  app.get(
    "/api/audits",
    asyncRoute(async (_request, response) => {
      response.json(await listAudits());
    })
  );

  app.post(
    "/api/audits",
    asyncRoute(async (request, response) => {
      response.status(201).json(await createAudit(request.body as AuditCreateInput));
    })
  );

  app.get(
    "/api/audits/:auditId",
    asyncRoute(async (request, response) => {
      const audit = await getAudit(Number(request.params.auditId));
      if (!audit) {
        response.status(404).json({ error: "Audit not found" });
        return;
      }

      response.json(audit);
    })
  );

  app.put(
    "/api/audits/:auditId",
    asyncRoute(async (request, response) => {
      response.json(await updateAudit(Number(request.params.auditId), request.body as AuditUpdateInput));
    })
  );

  app.post(
    "/api/audits/:auditId/clone",
    asyncRoute(async (request, response) => {
      response.status(201).json(await cloneAudit(Number(request.params.auditId)));
    })
  );

  app.delete(
    "/api/audits/:auditId",
    asyncRoute(async (request, response) => {
      await deleteAudit(Number(request.params.auditId));
      response.status(204).send();
    })
  );

  app.post(
    "/api/audits/:auditId/racks",
    asyncRoute(async (request, response) => {
      response.status(201).json(await createRackInAudit(Number(request.params.auditId), request.body as RackCreateInput));
    })
  );

  app.get(
    "/api/racks/:rackId",
    asyncRoute(async (request, response) => {
      const rack = await getRack(Number(request.params.rackId));
      if (!rack) {
        response.status(404).json({ error: "Rack not found" });
        return;
      }

      response.json(rack);
    })
  );

  app.put(
    "/api/racks/:rackId",
    asyncRoute(async (request, response) => {
      response.json(await updateRack(Number(request.params.rackId), request.body as RackUpdateInput));
    })
  );

  app.delete(
    "/api/racks/:rackId",
    asyncRoute(async (request, response) => {
      await deleteRack(Number(request.params.rackId));
      response.status(204).send();
    })
  );

  app.get(
    "/api/device-types",
    asyncRoute(async (_request, response) => {
      response.json(await listDeviceTypes());
    })
  );

  app.post(
    "/api/device-types",
    requireAdmin,
    asyncRoute(async (request, response) => {
      response.status(201).json(await createDeviceType(request.body as DeviceTypeInput));
    })
  );

  app.put(
    "/api/device-types/:deviceTypeId",
    requireAdmin,
    asyncRoute(async (request, response) => {
      response.json(await updateDeviceType(Number(request.params.deviceTypeId), request.body as DeviceTypeInput));
    })
  );

  app.delete(
    "/api/device-types/:deviceTypeId",
    requireAdmin,
    asyncRoute(async (request, response) => {
      await deleteDeviceType(Number(request.params.deviceTypeId));
      response.status(204).send();
    })
  );

  app.get(
    "/api/device-templates",
    asyncRoute(async (_request, response) => {
      response.json(await listDeviceTemplates());
    })
  );

  app.post(
    "/api/device-templates",
    requireAdmin,
    asyncRoute(async (request, response) => {
      response.status(201).json(await createDeviceTemplate(request.body as DeviceTemplateInput));
    })
  );

  app.put(
    "/api/device-templates/:templateId",
    requireAdmin,
    asyncRoute(async (request, response) => {
      response.json(await updateDeviceTemplate(Number(request.params.templateId), request.body as DeviceTemplateInput));
    })
  );

  app.delete(
    "/api/device-templates/:templateId",
    requireAdmin,
    asyncRoute(async (request, response) => {
      await deleteDeviceTemplate(Number(request.params.templateId));
      response.status(204).send();
    })
  );

  app.post(
    "/api/admin/audits/:auditId/reopen",
    requireAdmin,
    asyncRoute(async (request, response) => {
      response.json(await reopenAudit(Number(request.params.auditId)));
    })
  );

  app.post(
    "/api/racks/:rackId/devices",
    asyncRoute(async (request, response) => {
      response.status(201).json(await createRackDevice(Number(request.params.rackId), request.body as RackDeviceInput));
    })
  );

  app.put(
    "/api/racks/:rackId/devices/:deviceId",
    asyncRoute(async (request, response) => {
      response.json(
        await updateRackDevice(
          Number(request.params.rackId),
          Number(request.params.deviceId),
          request.body as RackDeviceInput
        )
      );
    })
  );

  app.delete(
    "/api/racks/:rackId/devices/:deviceId",
    asyncRoute(async (request, response) => {
      await deleteRackDevice(Number(request.params.rackId), Number(request.params.deviceId));
      response.status(204).send();
    })
  );

  app.get(
    "/api/audits/:auditId/export.xlsx",
    asyncRoute(async (request, response) => {
      const audit = await getAuditExportDetail(Number(request.params.auditId));
      if (!audit) {
        response.status(404).json({ error: "Audit not found" });
        return;
      }

      const file = await buildExcelExport(audit);
      response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      response.setHeader("Content-Disposition", `attachment; filename="${audit.name}-inventory.xlsx"`);
      response.send(file);
    })
  );

  app.get(
    "/api/audits/:auditId/export.pdf",
    asyncRoute(async (request, response) => {
      const audit = await getAuditExportDetail(Number(request.params.auditId));
      if (!audit) {
        response.status(404).json({ error: "Audit not found" });
        return;
      }

      const file = await buildPdfExport(audit);
      response.setHeader("Content-Type", "application/pdf");
      response.setHeader("Content-Disposition", `attachment; filename="${audit.name}-documentation.pdf"`);
      response.send(file);
    })
  );

  if (existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get(/^(?!\/api).*$/, (_request, response) => {
      response.sendFile(resolve(clientDistPath, "index.html"));
    });
  }

  app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    void next;
    const message = error instanceof Error ? error.message : "Unknown error";
    const lowerMessage = message.toLowerCase();
    const statusCode =
      lowerMessage.includes("not found")
        ? 404
        : lowerMessage.includes("admin access")
          ? 403
        : lowerMessage.includes("overlap") ||
            lowerMessage.includes("required") ||
            lowerMessage.includes("at least") ||
            lowerMessage.includes("cannot") ||
            lowerMessage.includes("read-only") ||
            lowerMessage.includes("greater than 0")
          ? 400
          : 500;

    response.status(statusCode).json({ error: message });
  });

  const port = Number(process.env.PORT ?? 5500);
  app.listen(port, () => {
    console.log(`Aether C.A.D server listening on http://localhost:${port}`);
  });
}

void bootstrap().catch((error) => {
  console.error("Failed to start Aether C.A.D", error);
  process.exit(1);
});
