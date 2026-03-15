import { findOverlaps, getMountPositionFace, sortRackDevices, validateRackPlacement } from "../shared/rack.js";
import type {
  DeviceTemplate,
  DeviceTemplateInput,
  RackCreateInput,
  RackDetail,
  RackDevice,
  RackDeviceInput,
  RackFace,
  RackSummary
} from "../shared/types.js";
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
  rack_face: RackFace | null;
  mount_position: RackDevice["mountPosition"];
  blocks_both_faces: boolean;
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
  template_type: string;
  mount_style: DeviceTemplate["mountStyle"];
  name: string;
  manufacturer: string;
  model: string;
  default_height_u: number;
  blocks_both_faces: boolean;
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
    rackFace: row.rack_face,
    mountPosition: row.mount_position,
    blocksBothFaces: row.blocks_both_faces,
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
    rackFace: input.rackFace,
    mountPosition: input.mountPosition,
    blocksBothFaces: input.blocksBothFaces,
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

  if (normalized.placementType === "spare") {
    return {
      ...normalized,
      rackFace: null,
      mountPosition: "full",
      blocksBothFaces: false,
      startUnit: null
    };
  }

  if (normalized.mountPosition !== "full") {
    normalized.rackFace = getMountPositionFace(normalized.mountPosition);
    normalized.blocksBothFaces = false;
  }

  if (!normalized.name || !normalized.manufacturer || !normalized.model) {
    throw new Error("Name, manufacturer and model are required.");
  }

  if (normalized.placementType === "rack" && normalized.rackFace === null) {
    throw new Error("Rack face is required for rack devices.");
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
    SELECT id, template_type, mount_style, name, manufacturer, model, default_height_u, blocks_both_faces
    FROM device_templates
    ORDER BY template_type, default_height_u, name
  `);

  return result.rows.map((row) => ({
    id: row.id,
    templateType: row.template_type,
    mountStyle: row.mount_style,
    name: row.name,
    manufacturer: row.manufacturer,
    model: row.model,
    defaultHeightU: row.default_height_u,
    blocksBothFaces: row.blocks_both_faces
  }));
}

function normalizeTemplateInput(input: DeviceTemplateInput): DeviceTemplateInput {
  const normalized: DeviceTemplateInput = {
    templateType: input.templateType.trim().toLowerCase(),
    mountStyle: input.mountStyle,
    name: input.name.trim(),
    manufacturer: input.manufacturer.trim(),
    model: input.model.trim(),
    defaultHeightU: input.defaultHeightU,
    blocksBothFaces: input.blocksBothFaces
  };

  if (!normalized.templateType || !normalized.name || !normalized.manufacturer || !normalized.model) {
    throw new Error("Template type, name, manufacturer and model are required.");
  }

  if (normalized.mountStyle === "vertical-pdu") {
    normalized.blocksBothFaces = false;
  }

  if (normalized.defaultHeightU < 1) {
    throw new Error("Template height must be at least 1U.");
  }

  return normalized;
}

export async function createDeviceTemplate(input: DeviceTemplateInput): Promise<DeviceTemplate> {
  const normalized = normalizeTemplateInput(input);

  const result = await pool.query<DeviceTemplateRow>(
    `
      INSERT INTO device_templates (template_type, mount_style, name, manufacturer, model, default_height_u, blocks_both_faces)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, template_type, mount_style, name, manufacturer, model, default_height_u, blocks_both_faces
    `,
    [
      normalized.templateType,
      normalized.mountStyle,
      normalized.name,
      normalized.manufacturer,
      normalized.model,
      normalized.defaultHeightU,
      normalized.blocksBothFaces
    ]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    templateType: row.template_type,
    mountStyle: row.mount_style,
    name: row.name,
    manufacturer: row.manufacturer,
    model: row.model,
    defaultHeightU: row.default_height_u,
    blocksBothFaces: row.blocks_both_faces
  };
}

export async function deleteDeviceTemplate(templateId: number): Promise<void> {
  const result = await pool.query("DELETE FROM device_templates WHERE id = $1", [templateId]);
  if ((result.rowCount ?? 0) === 0) {
    throw new Error("Device template not found.");
  }
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
        rack_face,
        mount_position,
        blocks_both_faces,
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
      RETURNING *
    `,
    [
      rackId,
      normalized.placementType,
      normalized.rackFace,
      normalized.mountPosition,
      normalized.blocksBothFaces,
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
        rack_face = $2,
        mount_position = $3,
        blocks_both_faces = $4,
        start_unit = $5,
        height_u = $6,
        name = $7,
        manufacturer = $8,
        model = $9,
        serial_number = $10,
        hostname = $11,
        notes = $12,
        storage_location = $13,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $14 AND rack_id = $15
      RETURNING *
    `,
    [
      normalized.placementType,
      normalized.rackFace,
      normalized.mountPosition,
      normalized.blocksBothFaces,
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
