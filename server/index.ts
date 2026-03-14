import express, { type NextFunction, type Request, type Response } from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { RackCreateInput, RackDeviceInput } from "../shared/types.js";
import { initializeDatabase } from "./db.js";
import { buildExcelExport, buildPdfExport } from "./exporters.js";
import {
  createRack,
  createRackDevice,
  deleteRackDevice,
  getRack,
  listDeviceTemplates,
  listRacks,
  updateRackDevice
} from "./repository.js";

type AsyncRoute = (request: Request, response: Response, next: NextFunction) => Promise<void>;

function asyncRoute(handler: AsyncRoute) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response, next).catch(next);
  };
}

async function bootstrap(): Promise<void> {
  await initializeDatabase();

  const app = express();
  const clientDistPath = resolve(process.cwd(), "dist", "client");

  app.use(express.json());

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get(
    "/api/racks",
    asyncRoute(async (_request, response) => {
      response.json(await listRacks());
    })
  );

  app.post(
    "/api/racks",
    asyncRoute(async (request, response) => {
      response.status(201).json(await createRack(request.body as RackCreateInput));
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

  app.get(
    "/api/device-templates",
    asyncRoute(async (_request, response) => {
      response.json(await listDeviceTemplates());
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
    "/api/racks/:rackId/export.xlsx",
    asyncRoute(async (request, response) => {
      const rack = await getRack(Number(request.params.rackId));
      if (!rack) {
        response.status(404).json({ error: "Rack not found" });
        return;
      }

      const file = await buildExcelExport(rack);
      response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      response.setHeader("Content-Disposition", `attachment; filename="${rack.name}-inventory.xlsx"`);
      response.send(file);
    })
  );

  app.get(
    "/api/racks/:rackId/export.pdf",
    asyncRoute(async (request, response) => {
      const rack = await getRack(Number(request.params.rackId));
      if (!rack) {
        response.status(404).json({ error: "Rack not found" });
        return;
      }

      const file = await buildPdfExport(rack);
      response.setHeader("Content-Type", "application/pdf");
      response.setHeader("Content-Disposition", `attachment; filename="${rack.name}-documentation.pdf"`);
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
      lowerMessage.includes("not found") ? 404 : lowerMessage.includes("overlap") || lowerMessage.includes("required") ? 400 : 500;

    response.status(statusCode).json({ error: message });
  });

  const port = Number(process.env.PORT ?? 5500);
  app.listen(port, () => {
    console.log(`AetherCab server listening on http://localhost:${port}`);
  });
}

void bootstrap().catch((error) => {
  console.error("Failed to start AetherCab", error);
  process.exit(1);
});
