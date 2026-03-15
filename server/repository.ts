import {
  canPlaceRackDeviceAtStartUnit,
  findClosestAvailableStartUnit,
  findOverlaps,
  getEndUnit,
  getMountPositionFace,
  sortRackDevices,
  validateRackPlacement
} from "../shared/rack.js";
import { getDefaultIconKeyForTemplateType, normalizeDeviceIconKey } from "../shared/deviceIcons.js";
import type {
  AuditCreateInput,
  AuditDetail,
  AuditExportDetail,
  AuditSummary,
  AuditUpdateInput,
  DeviceTemplate,
  DeviceTemplateInput,
  RackCreateInput,
  RackDetail,
  RackDevice,
  RackDeviceInput,
  RackFace,
  RackSummary,
  RackUpdateInput
} from "../shared/types.js";
import { pool } from "./db.js";

interface AuditSummaryRow {
  id: number;
  name: string;
  room_id: number;
  room_name: string;
  site_id: number;
  site_name: string;
  sales_order: string | null;
  status: AuditSummary["status"];
  created_at: string;
  notes: string | null;
  rack_count: string | number;
}

interface RackSummaryRow {
  id: number;
  audit_id: number;
  audit_name: string;
  name: string;
  total_units: number;
}

interface RackDetailRow extends RackSummaryRow {
  room_id: number;
  room_name: string;
  site_id: number;
  site_name: string;
  sales_order: string | null;
  status: AuditSummary["status"];
  created_at: string;
  audit_notes: string | null;
}

interface RackDeviceRow {
  id: number;
  rack_id: number;
  template_id: number | null;
  placement_type: "rack" | "spare";
  rack_face: RackFace | null;
  mount_position: RackDevice["mountPosition"];
  blocks_both_faces: boolean;
  start_unit: number | null;
  height_u: number;
  icon_key: RackDevice["iconKey"];
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
  icon_key: DeviceTemplate["iconKey"];
  name: string;
  manufacturer: string;
  model: string;
  default_height_u: number;
  blocks_both_faces: boolean;
}

function mapAuditSummary(row: AuditSummaryRow): AuditSummary {
  return {
    id: row.id,
    name: row.name,
    roomId: row.room_id,
    roomName: row.room_name,
    siteId: row.site_id,
    siteName: row.site_name,
    salesOrder: row.sales_order,
    status: row.status,
    createdAt: row.created_at,
    notes: row.notes,
    rackCount: Number(row.rack_count)
  };
}

function mapRackSummary(row: RackSummaryRow): RackSummary {
  return {
    id: row.id,
    auditId: row.audit_id,
    auditName: row.audit_name,
    name: row.name,
    totalUnits: row.total_units
  };
}

function mapRackDevice(row: RackDeviceRow): RackDevice {
  return {
    id: row.id,
    rackId: row.rack_id,
    templateId: row.template_id,
    placementType: row.placement_type,
    rackFace: row.rack_face,
    mountPosition: row.mount_position,
    blocksBothFaces: row.blocks_both_faces,
    startUnit: row.start_unit,
    heightU: row.height_u,
    iconKey: row.icon_key,
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
    templateId: input.templateId ?? null,
    placementType: input.placementType,
    rackFace: input.rackFace,
    mountPosition: input.mountPosition,
    blocksBothFaces: input.blocksBothFaces,
    startUnit: input.startUnit,
    heightU: input.heightU,
    iconKey: input.iconKey ?? null,
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

function normalizeTemplateInput(input: DeviceTemplateInput): DeviceTemplateInput {
  const templateType = input.templateType.trim().toLowerCase();
  const normalized: DeviceTemplateInput = {
    templateType,
    mountStyle: input.mountStyle,
    iconKey: normalizeDeviceIconKey(input.iconKey, getDefaultIconKeyForTemplateType(templateType)),
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

async function getOrCreateSiteId(siteName: string): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `
      INSERT INTO sites (name)
      VALUES ($1)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `,
    [siteName]
  );
  return result.rows[0].id;
}

async function getOrCreateRoomId(siteId: number, roomName: string): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `
      INSERT INTO rooms (site_id, name)
      VALUES ($1, $2)
      ON CONFLICT (site_id, name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `,
    [siteId, roomName]
  );
  return result.rows[0].id;
}

async function getRackBase(rackId: number): Promise<RackDetailRow | null> {
  const result = await pool.query<RackDetailRow>(
    `
      SELECT
        racks.id,
        racks.audit_id,
        racks.name,
        racks.total_units,
        audits.name AS audit_name,
        audits.sales_order,
        audits.status,
        audits.created_at,
        audits.notes AS audit_notes,
        rooms.id AS room_id,
        rooms.name AS room_name,
        sites.id AS site_id,
        sites.name AS site_name
      FROM racks
      INNER JOIN audits ON audits.id = racks.audit_id
      INNER JOIN rooms ON rooms.id = audits.room_id
      INNER JOIN sites ON sites.id = rooms.site_id
      WHERE racks.id = $1
    `,
    [rackId]
  );

  return result.rows[0] ?? null;
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

export async function listAudits(): Promise<AuditSummary[]> {
  const result = await pool.query<AuditSummaryRow>(
    `
      SELECT
        audits.id,
        audits.name,
        audits.sales_order,
        audits.status,
        audits.created_at,
        audits.notes,
        rooms.id AS room_id,
        rooms.name AS room_name,
        sites.id AS site_id,
        sites.name AS site_name,
        COUNT(racks.id) AS rack_count
      FROM audits
      INNER JOIN rooms ON rooms.id = audits.room_id
      INNER JOIN sites ON sites.id = rooms.site_id
      LEFT JOIN racks ON racks.audit_id = audits.id
      GROUP BY audits.id, rooms.id, sites.id
      ORDER BY sites.name, rooms.name, audits.name
    `
  );

  return result.rows.map(mapAuditSummary);
}

export async function getAudit(auditId: number): Promise<AuditDetail | null> {
  const auditResult = await pool.query<AuditSummaryRow>(
    `
      SELECT
        audits.id,
        audits.name,
        audits.sales_order,
        audits.status,
        audits.created_at,
        audits.notes,
        rooms.id AS room_id,
        rooms.name AS room_name,
        sites.id AS site_id,
        sites.name AS site_name,
        COUNT(racks.id) AS rack_count
      FROM audits
      INNER JOIN rooms ON rooms.id = audits.room_id
      INNER JOIN sites ON sites.id = rooms.site_id
      LEFT JOIN racks ON racks.audit_id = audits.id
      WHERE audits.id = $1
      GROUP BY audits.id, rooms.id, sites.id
    `,
    [auditId]
  );

  const auditRow = auditResult.rows[0];
  if (!auditRow) {
    return null;
  }

  const racksResult = await pool.query<RackSummaryRow>(
    `
      SELECT
        racks.id,
        racks.audit_id,
        audits.name AS audit_name,
        racks.name,
        racks.total_units
      FROM racks
      INNER JOIN audits ON audits.id = racks.audit_id
      WHERE racks.audit_id = $1
      ORDER BY racks.name
    `,
    [auditId]
  );

  return {
    ...mapAuditSummary(auditRow),
    racks: racksResult.rows.map(mapRackSummary)
  };
}

export async function getAuditExportDetail(auditId: number): Promise<AuditExportDetail | null> {
  const audit = await getAudit(auditId);
  if (!audit) {
    return null;
  }

  const rackDetails = await Promise.all(audit.racks.map((rack) => getRack(rack.id)));
  return {
    ...audit,
    racks: rackDetails.filter((rack): rack is RackDetail => rack !== null)
  };
}

export async function getRack(rackId: number): Promise<RackDetail | null> {
  const rackBase = await getRackBase(rackId);
  if (!rackBase) {
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
    id: rackBase.id,
    auditId: rackBase.audit_id,
    auditName: rackBase.audit_name,
    name: rackBase.name,
    totalUnits: rackBase.total_units,
    devices: sortRackDevices(deviceResult.rows.map(mapRackDevice))
  };
}

export async function createAudit(input: AuditCreateInput): Promise<AuditDetail> {
  const siteName = input.siteName.trim();
  const roomName = input.roomName.trim();
  const auditName = input.auditName.trim();
  const salesOrder = input.salesOrder.trim();
  const initialRackName = input.initialRackName.trim();

  if (!siteName || !roomName || !auditName || !salesOrder || !initialRackName) {
    throw new Error("Site, room, customer/system name, sales order and initial rack name are required.");
  }

  if (input.initialRackUnits < 1) {
    throw new Error("Rack must have at least 1U.");
  }

  const siteId = await getOrCreateSiteId(siteName);
  const roomId = await getOrCreateRoomId(siteId, roomName);

  const auditResult = await pool.query<{ id: number }>(
    `
      INSERT INTO audits (room_id, name, sales_order, status, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [roomId, auditName, salesOrder, input.status, input.notes?.trim() || null]
  );
  const auditId = auditResult.rows[0].id;

  await pool.query(
    `
      INSERT INTO racks (audit_id, room_id, name, total_units, notes)
      VALUES ($1, $2, $3, $4, NULL)
    `,
    [auditId, roomId, initialRackName, input.initialRackUnits]
  );

  const audit = await getAudit(auditId);
  if (!audit) {
    throw new Error("Failed to load created audit.");
  }

  return audit;
}

export async function updateAudit(auditId: number, input: AuditUpdateInput): Promise<AuditDetail> {
  const siteName = input.siteName.trim();
  const roomName = input.roomName.trim();
  const auditName = input.auditName.trim();
  const salesOrder = input.salesOrder.trim();

  if (!siteName || !roomName || !auditName || !salesOrder) {
    throw new Error("Site, room, customer/system name and sales order are required.");
  }

  const existingAudit = await getAudit(auditId);
  if (!existingAudit) {
    throw new Error("Audit not found.");
  }

  const siteId = await getOrCreateSiteId(siteName);
  const roomId = await getOrCreateRoomId(siteId, roomName);

  await pool.query(
    `
      UPDATE audits
      SET room_id = $1, name = $2, sales_order = $3, status = $4, notes = $5
      WHERE id = $6
    `,
    [roomId, auditName, salesOrder, input.status, input.notes?.trim() || null, auditId]
  );

  await pool.query("UPDATE racks SET room_id = $1 WHERE audit_id = $2", [roomId, auditId]);

  const updatedAudit = await getAudit(auditId);
  if (!updatedAudit) {
    throw new Error("Failed to load updated audit.");
  }

  return updatedAudit;
}

export async function createRackInAudit(auditId: number, input: RackCreateInput): Promise<RackDetail> {
  const audit = await getAudit(auditId);
  if (!audit) {
    throw new Error("Audit not found.");
  }

  const rackName = input.rackName.trim();
  if (!rackName) {
    throw new Error("Rack name is required.");
  }

  if (input.totalUnits < 1) {
    throw new Error("Rack must have at least 1U.");
  }

  const result = await pool.query<{ id: number }>(
    `
      INSERT INTO racks (audit_id, room_id, name, total_units, notes)
      VALUES ($1, $2, $3, $4, NULL)
      RETURNING id
    `,
    [auditId, audit.roomId, rackName, input.totalUnits]
  );

  const rack = await getRack(result.rows[0].id);
  if (!rack) {
    throw new Error("Failed to load created rack.");
  }

  return rack;
}

export async function updateRack(rackId: number, input: RackUpdateInput): Promise<RackDetail> {
  const rackName = input.rackName.trim();
  if (!rackName) {
    throw new Error("Rack name is required.");
  }

  if (input.totalUnits < 1) {
    throw new Error("Rack must have at least 1U.");
  }

  const existingRack = await getRack(rackId);
  if (!existingRack) {
    throw new Error("Rack not found.");
  }

  const highestOccupiedUnit = existingRack.devices.reduce((highest, device) => {
    if (device.placementType !== "rack" || device.startUnit === null) {
      return highest;
    }

    return Math.max(highest, device.startUnit + device.heightU - 1);
  }, 0);

  if (input.totalUnits < highestOccupiedUnit) {
    throw new Error(`Rack height cannot be reduced below ${highestOccupiedUnit}U because devices are already placed there.`);
  }

  await pool.query(
    `
      UPDATE racks
      SET name = $1, total_units = $2
      WHERE id = $3
    `,
    [rackName, input.totalUnits, rackId]
  );

  const updatedRack = await getRack(rackId);
  if (!updatedRack) {
    throw new Error("Failed to load updated rack.");
  }

  return updatedRack;
}

export async function deleteRack(rackId: number): Promise<void> {
  const auditResult = await pool.query<{ audit_id: number }>("SELECT audit_id FROM racks WHERE id = $1", [rackId]);
  const auditId = auditResult.rows[0]?.audit_id;
  if (!auditId) {
    throw new Error("Rack not found.");
  }

  const rackCountResult = await pool.query<{ count: string }>("SELECT COUNT(*) AS count FROM racks WHERE audit_id = $1", [auditId]);
  if (Number(rackCountResult.rows[0]?.count ?? 0) <= 1) {
    throw new Error("An audit must contain at least one rack.");
  }

  await pool.query("DELETE FROM racks WHERE id = $1", [rackId]);
}

export async function listDeviceTemplates(): Promise<DeviceTemplate[]> {
  const result = await pool.query<DeviceTemplateRow>(`
    SELECT id, template_type, mount_style, icon_key, name, manufacturer, model, default_height_u, blocks_both_faces
    FROM device_templates
    ORDER BY template_type, default_height_u, name
  `);

  return result.rows.map((row) => ({
    id: row.id,
    templateType: row.template_type,
    mountStyle: row.mount_style,
    iconKey: row.icon_key,
    name: row.name,
    manufacturer: row.manufacturer,
    model: row.model,
    defaultHeightU: row.default_height_u,
    blocksBothFaces: row.blocks_both_faces
  }));
}

export async function createDeviceTemplate(input: DeviceTemplateInput): Promise<DeviceTemplate> {
  const normalized = normalizeTemplateInput(input);

  const result = await pool.query<DeviceTemplateRow>(
    `
      INSERT INTO device_templates (template_type, mount_style, icon_key, name, manufacturer, model, default_height_u, blocks_both_faces)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, template_type, mount_style, icon_key, name, manufacturer, model, default_height_u, blocks_both_faces
    `,
    [
      normalized.templateType,
      normalized.mountStyle,
      normalized.iconKey,
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
    iconKey: row.icon_key,
    name: row.name,
    manufacturer: row.manufacturer,
    model: row.model,
    defaultHeightU: row.default_height_u,
    blocksBothFaces: row.blocks_both_faces
  };
}

export async function updateDeviceTemplate(templateId: number, input: DeviceTemplateInput): Promise<DeviceTemplate> {
  const normalized = normalizeTemplateInput(input);

  const result = await pool.query<DeviceTemplateRow>(
    `
      UPDATE device_templates
      SET
        template_type = $1,
        mount_style = $2,
        icon_key = $3,
        name = $4,
        manufacturer = $5,
        model = $6,
        default_height_u = $7,
        blocks_both_faces = $8
      WHERE id = $9
      RETURNING id, template_type, mount_style, icon_key, name, manufacturer, model, default_height_u, blocks_both_faces
    `,
    [
      normalized.templateType,
      normalized.mountStyle,
      normalized.iconKey,
      normalized.name,
      normalized.manufacturer,
      normalized.model,
      normalized.defaultHeightU,
      normalized.blocksBothFaces,
      templateId
    ]
  );

  if (result.rows.length === 0) {
    throw new Error("Device template not found.");
  }

  await pool.query("UPDATE rack_devices SET icon_key = $1 WHERE template_id = $2", [normalized.iconKey, templateId]);

  const row = result.rows[0];
  return {
    id: row.id,
    templateType: row.template_type,
    mountStyle: row.mount_style,
    iconKey: row.icon_key,
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

export async function createRackDevice(rackId: number, input: RackDeviceInput): Promise<RackDevice> {
  const normalized = normalizeDeviceInput(input);
  await validateRackDevice(rackId, normalized);

  const result = await pool.query<RackDeviceRow>(
    `
      INSERT INTO rack_devices (
        rack_id,
        template_id,
        placement_type,
        rack_face,
        mount_position,
        blocks_both_faces,
        start_unit,
        height_u,
        icon_key,
        name,
        manufacturer,
        model,
        serial_number,
        hostname,
        notes,
        storage_location,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
      RETURNING *
    `,
    [
      rackId,
      normalized.templateId ?? null,
      normalized.placementType,
      normalized.rackFace,
      normalized.mountPosition,
      normalized.blocksBothFaces,
      normalized.startUnit,
      normalized.heightU,
      normalized.iconKey ?? null,
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
  const existingResult = await pool.query<RackDeviceRow>(
    "SELECT * FROM rack_devices WHERE id = $1 AND rack_id = $2",
    [deviceId, rackId]
  );

  if (existingResult.rows.length === 0) {
    throw new Error("Rack device not found.");
  }

  const existingDevice = mapRackDevice(existingResult.rows[0]);
  const rack = await getRack(rackId);
  if (!rack) {
    throw new Error("Rack not found.");
  }

  const normalized = normalizeDeviceInput(input);
  let resolvedInput = normalized;

  if (normalized.placementType === "rack" && normalized.startUnit !== null && normalized.rackFace !== null) {
    const preserveCurrentStart = canPlaceRackDeviceAtStartUnit(
      normalized,
      normalized.startUnit,
      rack.totalUnits,
      rack.devices,
      deviceId
    );

    if (!preserveCurrentStart) {
      const candidateStarts: number[] = [];

      if (normalized.startUnit >= 1) {
        candidateStarts.push(normalized.startUnit);
      }

      if (
        existingDevice.placementType === "rack" &&
        existingDevice.startUnit !== null &&
        normalized.startUnit === existingDevice.startUnit &&
        normalized.heightU !== existingDevice.heightU
      ) {
        const preservedEndStartUnit = getEndUnit(existingDevice.startUnit, existingDevice.heightU) - normalized.heightU + 1;
        if (preservedEndStartUnit >= 1) {
          candidateStarts.push(preservedEndStartUnit);
        }
      }

      const firstValidStartUnit = [...new Set(candidateStarts)].find((startUnit) =>
        canPlaceRackDeviceAtStartUnit(normalized, startUnit, rack.totalUnits, rack.devices, deviceId)
      );

      if (firstValidStartUnit !== undefined) {
        resolvedInput = {
          ...normalized,
          startUnit: firstValidStartUnit
        };
      } else {
        const referenceStartUnit =
          existingDevice.placementType === "rack" &&
          existingDevice.startUnit !== null &&
          normalized.startUnit === existingDevice.startUnit
            ? existingDevice.startUnit
            : normalized.startUnit;
        const referenceEndUnit =
          existingDevice.placementType === "rack" &&
          existingDevice.startUnit !== null &&
          normalized.startUnit === existingDevice.startUnit
            ? getEndUnit(existingDevice.startUnit, existingDevice.heightU)
            : getEndUnit(normalized.startUnit, normalized.heightU);
        const relocatedStartUnit = findClosestAvailableStartUnit(
          normalized,
          rack.totalUnits,
          rack.devices,
          referenceStartUnit,
          referenceEndUnit,
          deviceId
        );

        if (relocatedStartUnit !== null) {
          resolvedInput = {
            ...normalized,
            startUnit: relocatedStartUnit
          };
        }
      }
    }
  }

  await validateRackDevice(rackId, resolvedInput, deviceId);

  const result = await pool.query<RackDeviceRow>(
    `
      UPDATE rack_devices
      SET
        placement_type = $1,
        template_id = $2,
        rack_face = $3,
        mount_position = $4,
        blocks_both_faces = $5,
        start_unit = $6,
        height_u = $7,
        icon_key = $8,
        name = $9,
        manufacturer = $10,
        model = $11,
        serial_number = $12,
        hostname = $13,
        notes = $14,
        storage_location = $15,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $16 AND rack_id = $17
      RETURNING *
    `,
    [
      resolvedInput.placementType,
      resolvedInput.templateId ?? null,
      resolvedInput.rackFace,
      resolvedInput.mountPosition,
      resolvedInput.blocksBothFaces,
      resolvedInput.startUnit,
      resolvedInput.heightU,
      resolvedInput.iconKey ?? null,
      resolvedInput.name,
      resolvedInput.manufacturer,
      resolvedInput.model,
      resolvedInput.serialNumber ?? null,
      resolvedInput.hostname ?? null,
      resolvedInput.notes ?? null,
      resolvedInput.storageLocation ?? null,
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
