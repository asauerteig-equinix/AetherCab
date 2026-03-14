import { findOverlaps, sortRackDevices, validateRackPlacement } from "../shared/rack.js";
import type { DeviceTemplate, RackCreateInput, RackDetail, RackDevice, RackDeviceInput, RackSummary } from "../shared/types.js";
import { pool } from "./db.js";

interface RackSummaryRow {
  id: number;
  name: string;
  total_units: number;
  room_id: number;
  room_name: string;
  site_id: number;
  site_name: string;
  notes: string | null;
}

interface RackDeviceRow {
  id: number;
  rack_id: number;
  placement_type: "rack" | "spare";
  start_unit: number | null;
  height_u: number;
  name: string;
  manufacturer: string;
  model: string;
  serial_number: string | null;
  hostname: string | null;
  notes: string | null;
  storage_location: string | null;
  created_at: string;
  updated_at: string;
}

interface DeviceTemplateRow {
  id: number;
  name: string;
  manufacturer: string;
  model: string;
  default_height_u: number;
}

function mapRackSummary(row: RackSummaryRow): RackSummary {
  return {
    id: row.id,
    name: row.name,
    totalUnits: row.total_units,
    roomId: row.room_id,
    roomName: row.room_name,
    siteId: row.site_id,
    siteName: row.site_name,
    notes: row.notes
  };
}

function mapRackDevice(row: RackDeviceRow): RackDevice {
  return {
    id: row.id,
    rackId: row.rack_id,
    placementType: row.placement_type,
    startUnit: row.start_unit,
    heightU: row.height_u,
    name: row.name,
    manufacturer: row.manufacturer,
    model: row.model,
    serialNumber: row.serial_number,
    hostname: row.hostname,
    notes: row.notes,
    storageLocation: row.storage_location,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeDeviceInput(input: RackDeviceInput): RackDeviceInput {
  const normalized: RackDeviceInput = {
    placementType: input.placementType,
    startUnit: input.startUnit,
    heightU: input.heightU,
    name: input.name.trim(),
    manufacturer: input.manufacturer.trim(),
    model: input.model.trim(),
    serialNumber: input.serialNumber?.trim() || null,
    hostname: input.hostname?.trim() || null,
    notes: input.notes?.trim() || null,
    storageLocation: input.storageLocation?.trim() || null
  };

  if (!normalized.name || !normalized.manufacturer || !normalized.model) {
    throw new Error("Name, manufacturer and model are required.");
  }

  return normalized;
}

async function validateRackDevice(rackId: number, input: RackDeviceInput, currentDeviceId?: number): Promise<void> {
  const rack = await getRack(rackId);
  if (!rack) {
    throw new Error("Rack not found.");
  }

  const placementIssues = validateRackPlacement(input, rack.totalUnits);
  if (placementIssues.length > 0) {
    throw new Error(placementIssues.join(" "));
  }

  const overlaps = findOverlaps(input, rack.devices, currentDeviceId);
  if (overlaps.length > 0) {
    throw new Error("Device placement overlaps an existing rack device.");
  }
}

export async function listRacks(): Promise<RackSummary[]> {
  const result = await pool.query<RackSummaryRow>(`
    SELECT
      racks.id,
      racks.name,
      racks.total_units,
      racks.notes,
      rooms.id AS room_id,
      rooms.name AS room_name,
      sites.id AS site_id,
      sites.name AS site_name
    FROM racks
    INNER JOIN rooms ON rooms.id = racks.room_id
    INNER JOIN sites ON sites.id = rooms.site_id
    ORDER BY sites.name, rooms.name, racks.name
  `);

  return result.rows.map(mapRackSummary);
}

export async function listDeviceTemplates(): Promise<DeviceTemplate[]> {
  const result = await pool.query<DeviceTemplateRow>(`
    SELECT id, name, manufacturer, model, default_height_u
    FROM device_templates
    ORDER BY manufacturer, model
  `);

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    manufacturer: row.manufacturer,
    model: row.model,
    defaultHeightU: row.default_height_u
  }));
}

export async function getRack(rackId: number): Promise<RackDetail | null> {
  const rackResult = await pool.query<RackSummaryRow>(
    `
      SELECT
        racks.id,
        racks.name,
        racks.total_units,
        racks.notes,
        rooms.id AS room_id,
        rooms.name AS room_name,
        sites.id AS site_id,
        sites.name AS site_name
      FROM racks
      INNER JOIN rooms ON rooms.id = racks.room_id
      INNER JOIN sites ON sites.id = rooms.site_id
      WHERE racks.id = $1
    `,
    [rackId]
  );

  const rackRow = rackResult.rows[0];
  if (!rackRow) {
    return null;
  }

  const deviceResult = await pool.query<RackDeviceRow>(
    `
      SELECT *
      FROM rack_devices
      WHERE rack_id = $1
      ORDER BY placement_type, start_unit DESC NULLS LAST, name
    `,
    [rackId]
  );

  return {
    ...mapRackSummary(rackRow),
    devices: sortRackDevices(deviceResult.rows.map(mapRackDevice))
  };
}

export async function createRack(input: RackCreateInput): Promise<RackSummary> {
  const siteName = input.siteName.trim();
  const roomName = input.roomName.trim();
  const rackName = input.rackName.trim();

  if (!siteName || !roomName || !rackName) {
    throw new Error("Site, room and rack names are required.");
  }

  if (input.totalUnits < 1) {
    throw new Error("Rack must have at least 1U.");
  }

  const siteResult = await pool.query<{ id: number }>(
    `
      INSERT INTO sites (name)
      VALUES ($1)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `,
    [siteName]
  );
  const siteId = siteResult.rows[0].id;

  const roomResult = await pool.query<{ id: number }>(
    `
      INSERT INTO rooms (site_id, name)
      VALUES ($1, $2)
      ON CONFLICT (site_id, name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `,
    [siteId, roomName]
  );
  const roomId = roomResult.rows[0].id;

  const rackResult = await pool.query<{ id: number }>(
    `
      INSERT INTO racks (room_id, name, total_units, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [roomId, rackName, input.totalUnits, input.notes?.trim() || null]
  );

  const rack = await getRack(rackResult.rows[0].id);
  if (!rack) {
    throw new Error("Failed to load created rack.");
  }

  return rack;
}

export async function createRackDevice(rackId: number, input: RackDeviceInput): Promise<RackDevice> {
  const normalized = normalizeDeviceInput(input);
  await validateRackDevice(rackId, normalized);

  const result = await pool.query<RackDeviceRow>(
    `
      INSERT INTO rack_devices (
        rack_id,
        placement_type,
        start_unit,
        height_u,
        name,
        manufacturer,
        model,
        serial_number,
        hostname,
        notes,
        storage_location,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      RETURNING *
    `,
    [
      rackId,
      normalized.placementType,
      normalized.startUnit,
      normalized.heightU,
      normalized.name,
      normalized.manufacturer,
      normalized.model,
      normalized.serialNumber ?? null,
      normalized.hostname ?? null,
      normalized.notes ?? null,
      normalized.storageLocation ?? null
    ]
  );

  return mapRackDevice(result.rows[0]);
}

export async function updateRackDevice(rackId: number, deviceId: number, input: RackDeviceInput): Promise<RackDevice> {
  const existingResult = await pool.query<{ id: number }>(
    "SELECT id FROM rack_devices WHERE id = $1 AND rack_id = $2",
    [deviceId, rackId]
  );

  if (existingResult.rows.length === 0) {
    throw new Error("Rack device not found.");
  }

  const normalized = normalizeDeviceInput(input);
  await validateRackDevice(rackId, normalized, deviceId);

  const result = await pool.query<RackDeviceRow>(
    `
      UPDATE rack_devices
      SET
        placement_type = $1,
        start_unit = $2,
        height_u = $3,
        name = $4,
        manufacturer = $5,
        model = $6,
        serial_number = $7,
        hostname = $8,
        notes = $9,
        storage_location = $10,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $11 AND rack_id = $12
      RETURNING *
    `,
    [
      normalized.placementType,
      normalized.startUnit,
      normalized.heightU,
      normalized.name,
      normalized.manufacturer,
      normalized.model,
      normalized.serialNumber ?? null,
      normalized.hostname ?? null,
      normalized.notes ?? null,
      normalized.storageLocation ?? null,
      deviceId,
      rackId
    ]
  );

  return mapRackDevice(result.rows[0]);
}

export async function deleteRackDevice(rackId: number, deviceId: number): Promise<void> {
  const result = await pool.query("DELETE FROM rack_devices WHERE id = $1 AND rack_id = $2", [deviceId, rackId]);
  if ((result.rowCount ?? 0) === 0) {
    throw new Error("Rack device not found.");
  }
}
