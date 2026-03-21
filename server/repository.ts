import {
  canPlaceRackDeviceAtStartUnit,
  findClosestAvailableStartUnit,
  findOverlaps,
  getEndUnit,
  getMountPositionFace,
  sortRackDevices,
  validateRackPlacement
} from "../shared/rack.js";
import { normalizeDeviceIconKey } from "../shared/deviceIcons.js";
import { getVoltageForPowerPhase } from "../shared/power.js";
import type {
  AuditCreateInput,
  AuditDetail,
  AuditExportDetail,
  AuditSummary,
  AuditUpdateInput,
  DeviceType,
  DeviceTypeInput,
  DeviceTemplate,
  DeviceTemplateInput,
  RackCreateInput,
  RackDetail,
  RackDevice,
  RackDeviceInput,
  RackFace,
  PowerPhase,
  RackSummary,
  RackUpdateInput
} from "../shared/types.js";
import { pool } from "./db.js";
import type { PoolClient } from "pg";

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
  width_mm: number;
  depth_mm: number;
  height_mm: number;
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
  allow_shared_depth: boolean;
  start_unit: number | null;
  height_u: number;
  icon_key: RackDevice["iconKey"];
  has_power_spec: boolean;
  power_phase: PowerPhase | null;
  voltage_v: number | null;
  current_a: number | null;
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
  has_power_spec: boolean;
  power_phase: PowerPhase | null;
  voltage_v: number | null;
  current_a: number | null;
  name: string;
  manufacturer: string;
  model: string;
  default_height_u: number;
  blocks_both_faces: boolean;
  allow_shared_depth: boolean;
}

interface DeviceTypeRow {
  id: number;
  key: string;
  label: string;
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
    totalUnits: row.total_units,
    widthMm: row.width_mm,
    depthMm: row.depth_mm,
    heightMm: row.height_mm
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
    allowSharedDepth: row.allow_shared_depth,
    startUnit: row.start_unit,
    heightU: row.height_u,
    iconKey: row.icon_key,
    hasPowerSpec: row.has_power_spec,
    powerPhase: row.power_phase,
    voltageV: row.voltage_v,
    currentA: row.current_a,
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

function mapDeviceType(row: DeviceTypeRow): DeviceType {
  return {
    id: row.id,
    key: row.key,
    label: row.label
  };
}

function normalizeDeviceTypeInput(input: DeviceTypeInput): DeviceTypeInput {
  const key = input.key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const label = input.label.trim();

  if (!key || !label) {
    throw new Error("Device type key and label are required.");
  }

  return {
    key,
    label
  };
}

function normalizeDeviceInput(input: RackDeviceInput): RackDeviceInput {
  const hasPowerSpec = input.hasPowerSpec ?? false;
  const powerPhase = hasPowerSpec ? input.powerPhase ?? null : null;
  const voltageV =
    !hasPowerSpec
      ? null
      : powerPhase === "custom"
        ? input.voltageV ?? null
        : getVoltageForPowerPhase(powerPhase);
  const currentA = hasPowerSpec ? input.currentA ?? null : null;
  const normalized: RackDeviceInput = {
    templateId: input.templateId ?? null,
    placementType: input.placementType,
    rackFace: input.rackFace,
    mountPosition: input.mountPosition,
    blocksBothFaces: input.blocksBothFaces ?? false,
    allowSharedDepth: input.allowSharedDepth ?? false,
    startUnit: input.startUnit,
    heightU: input.heightU,
    iconKey: input.iconKey ?? null,
    hasPowerSpec,
    powerPhase,
    voltageV,
    currentA,
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
    normalized.allowSharedDepth = false;
  }

  if (normalized.blocksBothFaces) {
    normalized.allowSharedDepth = false;
  }

  if (!normalized.name || !normalized.manufacturer || !normalized.model) {
    throw new Error("Name, manufacturer and model are required.");
  }

  if (normalized.hasPowerSpec) {
    if (normalized.powerPhase === null) {
      throw new Error("Power phase is required when power input specs are enabled.");
    }

    if (voltageV === null || voltageV < 1) {
      throw new Error("Voltage must be greater than 0 when power input specs are enabled.");
    }

    if (currentA === null || currentA < 1) {
      throw new Error("Current must be greater than 0 when power input specs are enabled.");
    }
  }

  if (normalized.placementType === "rack" && normalized.rackFace === null) {
    throw new Error("Rack face is required for rack devices.");
  }

  return normalized;
}

function normalizeTemplateInput(input: DeviceTemplateInput): DeviceTemplateInput {
  const templateType = input.templateType.trim().toLowerCase();
  const hasPowerSpec = input.hasPowerSpec ?? false;
  const powerPhase = hasPowerSpec ? input.powerPhase ?? null : null;
  const voltageV =
    !hasPowerSpec
      ? null
      : powerPhase === "custom"
        ? input.voltageV ?? null
        : getVoltageForPowerPhase(powerPhase);
  const currentA = hasPowerSpec ? input.currentA ?? null : null;
  const normalized: DeviceTemplateInput = {
    templateType,
    mountStyle: input.mountStyle,
    iconKey: normalizeDeviceIconKey(input.iconKey),
    hasPowerSpec,
    powerPhase,
    voltageV,
    currentA,
    name: input.name.trim(),
    manufacturer: input.manufacturer.trim(),
    model: input.model.trim(),
    defaultHeightU: input.defaultHeightU,
    blocksBothFaces: input.blocksBothFaces ?? false,
    allowSharedDepth: input.allowSharedDepth ?? false
  };

  if (!normalized.templateType || !normalized.name || !normalized.manufacturer || !normalized.model) {
    throw new Error("Template type, name, manufacturer and model are required.");
  }

  if (normalized.hasPowerSpec) {
    if (normalized.powerPhase === null) {
      throw new Error("Power phase is required when power input specs are enabled.");
    }

    if (normalized.voltageV === null || normalized.voltageV < 1) {
      throw new Error("Voltage must be greater than 0 when power input specs are enabled.");
    }

    if (normalized.currentA === null || normalized.currentA < 1) {
      throw new Error("Current must be greater than 0 when power input specs are enabled.");
    }
  }

  if (normalized.mountStyle === "vertical-pdu") {
    normalized.blocksBothFaces = false;
    normalized.allowSharedDepth = false;
  }

  if (normalized.blocksBothFaces) {
    normalized.allowSharedDepth = false;
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
        racks.width_mm,
        racks.depth_mm,
        racks.height_mm,
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

async function getAuditBase(auditId: number): Promise<AuditSummaryRow | null> {
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
      WHERE audits.id = $1
      GROUP BY audits.id, rooms.id, sites.id
    `,
    [auditId]
  );

  return result.rows[0] ?? null;
}

async function getAuditStatus(auditId: number): Promise<AuditSummary["status"] | null> {
  const result = await pool.query<{ status: AuditSummary["status"] }>("SELECT status FROM audits WHERE id = $1", [auditId]);
  return result.rows[0]?.status ?? null;
}

async function markAuditInProgressWhenFirstRackDeviceIsPlaced(auditId: number): Promise<void> {
  const status = await getAuditStatus(auditId);
  if (status !== "created") {
    return;
  }

  const placedDeviceResult = await pool.query<{ id: number }>(
    `
      SELECT rack_devices.id
      FROM rack_devices
      INNER JOIN racks ON racks.id = rack_devices.rack_id
      WHERE racks.audit_id = $1
        AND rack_devices.placement_type = 'rack'
      LIMIT 1
    `,
    [auditId]
  );

  if (placedDeviceResult.rows.length === 0) {
    return;
  }

  await pool.query("UPDATE audits SET status = 'in-progress' WHERE id = $1 AND status = 'created'", [auditId]);
}

async function getAuditIdForRack(rackId: number): Promise<number | null> {
  const result = await pool.query<{ audit_id: number }>("SELECT audit_id FROM racks WHERE id = $1", [rackId]);
  return result.rows[0]?.audit_id ?? null;
}

async function assertAuditEditable(auditId: number): Promise<void> {
  const status = await getAuditStatus(auditId);
  if (status === null) {
    throw new Error("Audit not found.");
  }

  if (status === "completed") {
    throw new Error("Completed audits are read-only. Create a new audit based on this audit to continue.");
  }
}

async function duplicateAuditData(client: PoolClient, sourceAudit: AuditDetail, nextAuditId: number, roomId: number): Promise<void> {
  const rackIdMap = new Map<number, number>();

  for (const rack of sourceAudit.racks) {
    const sourceRack = await getRack(rack.id);
    if (!sourceRack) {
      continue;
    }

    const rackResult = await client.query<{ id: number }>(
      `
        INSERT INTO racks (audit_id, room_id, name, total_units, width_mm, depth_mm, height_mm, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)
        RETURNING id
      `,
      [nextAuditId, roomId, sourceRack.name, sourceRack.totalUnits, sourceRack.widthMm, sourceRack.depthMm, sourceRack.heightMm]
    );

    rackIdMap.set(sourceRack.id, rackResult.rows[0].id);
  }

  for (const rack of sourceAudit.racks) {
    const sourceRack = await getRack(rack.id);
    const nextRackId = rackIdMap.get(rack.id);
    if (!sourceRack || nextRackId === undefined) {
      continue;
    }

    for (const device of sourceRack.devices) {
      await client.query(
        `
          INSERT INTO rack_devices (
            rack_id,
            template_id,
            placement_type,
            rack_face,
            mount_position,
            blocks_both_faces,
            allow_shared_depth,
            start_unit,
            height_u,
            icon_key,
            has_power_spec,
            power_phase,
            voltage_v,
            current_a,
            name,
            manufacturer,
            model,
            serial_number,
            hostname,
            notes,
            storage_location,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP)
        `,
        [
          nextRackId,
          device.templateId,
          device.placementType,
          device.rackFace,
          device.mountPosition,
          device.blocksBothFaces,
          device.allowSharedDepth,
          device.startUnit,
          device.heightU,
          device.iconKey,
          device.hasPowerSpec,
          device.powerPhase,
          device.voltageV,
          device.currentA,
          device.name,
          device.manufacturer,
          device.model,
          device.serialNumber,
          device.hostname,
          device.notes,
          device.storageLocation
        ]
      );
    }
  }
}

async function getNextClonedAuditName(roomId: number, baseName: string): Promise<string> {
  const candidateBase = `${baseName} Copy`;
  const existing = await pool.query<{ name: string }>("SELECT name FROM audits WHERE room_id = $1", [roomId]);
  const existingNames = new Set(existing.rows.map((row) => row.name));

  if (!existingNames.has(candidateBase)) {
    return candidateBase;
  }

  let suffix = 2;
  while (existingNames.has(`${candidateBase} ${suffix}`)) {
    suffix += 1;
  }

  return `${candidateBase} ${suffix}`;
}

async function deviceTypeExists(key: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>("SELECT EXISTS(SELECT 1 FROM device_types WHERE key = $1) AS exists", [key]);
  return result.rows[0]?.exists ?? false;
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
  const auditRow = await getAuditBase(auditId);
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
        racks.total_units,
        racks.width_mm,
        racks.depth_mm,
        racks.height_mm
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
    widthMm: rackBase.width_mm,
    depthMm: rackBase.depth_mm,
    heightMm: rackBase.height_mm,
    devices: sortRackDevices(deviceResult.rows.map(mapRackDevice))
  };
}

export async function createAudit(input: AuditCreateInput): Promise<AuditDetail> {
  const siteName = input.siteName.trim();
  const roomName = input.roomName.trim();
  const auditName = input.auditName.trim();
  const salesOrder = input.salesOrder.trim();
  const initialRackName = input.initialRackName.trim() || "0101";

  if (!siteName || !roomName || !auditName || !salesOrder) {
    throw new Error("Site, room, customer/system name and sales order are required.");
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
      INSERT INTO racks (audit_id, room_id, name, total_units, width_mm, depth_mm, height_mm, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)
    `,
    [auditId, roomId, initialRackName, input.initialRackUnits, 600, 1000, 2200]
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

  if (existingAudit.status === "completed") {
    throw new Error("Completed audits are read-only. Create a new audit based on this audit to continue.");
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

export async function deleteAudit(auditId: number): Promise<void> {
  await assertAuditEditable(auditId);
  const result = await pool.query<{ id: number }>("DELETE FROM audits WHERE id = $1 RETURNING id", [auditId]);

  if (result.rows.length === 0) {
    throw new Error("Audit not found.");
  }
}

export async function createRackInAudit(auditId: number, input: RackCreateInput): Promise<RackDetail> {
  await assertAuditEditable(auditId);
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

  if (input.widthMm < 1 || input.depthMm < 1 || input.heightMm < 1) {
    throw new Error("Rack dimensions must be greater than 0 mm.");
  }

  const result = await pool.query<{ id: number }>(
    `
      INSERT INTO racks (audit_id, room_id, name, total_units, width_mm, depth_mm, height_mm, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)
      RETURNING id
    `,
    [auditId, audit.roomId, rackName, input.totalUnits, input.widthMm, input.depthMm, input.heightMm]
  );

  const rack = await getRack(result.rows[0].id);
  if (!rack) {
    throw new Error("Failed to load created rack.");
  }

  return rack;
}

export async function updateRack(rackId: number, input: RackUpdateInput): Promise<RackDetail> {
  const auditId = await getAuditIdForRack(rackId);
  if (auditId === null) {
    throw new Error("Rack not found.");
  }

  await assertAuditEditable(auditId);
  const rackName = input.rackName.trim();
  if (!rackName) {
    throw new Error("Rack name is required.");
  }

  if (input.totalUnits < 1) {
    throw new Error("Rack must have at least 1U.");
  }

  if (input.widthMm < 1 || input.depthMm < 1 || input.heightMm < 1) {
    throw new Error("Rack dimensions must be greater than 0 mm.");
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
      SET name = $1, total_units = $2, width_mm = $3, depth_mm = $4, height_mm = $5
      WHERE id = $6
    `,
    [rackName, input.totalUnits, input.widthMm, input.depthMm, input.heightMm, rackId]
  );

  const updatedRack = await getRack(rackId);
  if (!updatedRack) {
    throw new Error("Failed to load updated rack.");
  }

  return updatedRack;
}

export async function deleteRack(rackId: number): Promise<void> {
  const auditId = await getAuditIdForRack(rackId);
  if (!auditId) {
    throw new Error("Rack not found.");
  }

  await assertAuditEditable(auditId);

  const rackCountResult = await pool.query<{ count: string }>("SELECT COUNT(*) AS count FROM racks WHERE audit_id = $1", [auditId]);
  if (Number(rackCountResult.rows[0]?.count ?? 0) <= 1) {
    throw new Error("An audit must contain at least one rack.");
  }

  await pool.query("DELETE FROM racks WHERE id = $1", [rackId]);
}

export async function listDeviceTypes(): Promise<DeviceType[]> {
  const result = await pool.query<DeviceTypeRow>(
    `
      SELECT id, key, label
      FROM device_types
      ORDER BY label, key
    `
  );

  return result.rows.map(mapDeviceType);
}

export async function createDeviceType(input: DeviceTypeInput): Promise<DeviceType> {
  const normalized = normalizeDeviceTypeInput(input);
  const result = await pool.query<DeviceTypeRow>(
    `
      INSERT INTO device_types (key, label)
      VALUES ($1, $2)
      RETURNING id, key, label
    `,
    [normalized.key, normalized.label]
  );

  return mapDeviceType(result.rows[0]);
}

export async function updateDeviceType(deviceTypeId: number, input: DeviceTypeInput): Promise<DeviceType> {
  const normalized = normalizeDeviceTypeInput(input);
  const existingResult = await pool.query<DeviceTypeRow>("SELECT id, key, label FROM device_types WHERE id = $1", [deviceTypeId]);
  const existing = existingResult.rows[0];
  if (!existing) {
    throw new Error("Device type not found.");
  }

  await pool.query(
    `
      UPDATE device_types
      SET key = $1, label = $2
      WHERE id = $3
    `,
    [normalized.key, normalized.label, deviceTypeId]
  );

  if (existing.key !== normalized.key) {
    await pool.query("UPDATE device_templates SET template_type = $1 WHERE template_type = $2", [normalized.key, existing.key]);
  }

  const updatedResult = await pool.query<DeviceTypeRow>("SELECT id, key, label FROM device_types WHERE id = $1", [deviceTypeId]);
  return mapDeviceType(updatedResult.rows[0]);
}

export async function deleteDeviceType(deviceTypeId: number): Promise<void> {
  const existingResult = await pool.query<DeviceTypeRow>("SELECT id, key, label FROM device_types WHERE id = $1", [deviceTypeId]);
  const existing = existingResult.rows[0];
  if (!existing) {
    throw new Error("Device type not found.");
  }

  const usageResult = await pool.query<{ count: string }>("SELECT COUNT(*) AS count FROM device_templates WHERE template_type = $1", [existing.key]);
  if (Number(usageResult.rows[0]?.count ?? 0) > 0) {
    throw new Error("Device type cannot be deleted while templates still use it.");
  }

  await pool.query("DELETE FROM device_types WHERE id = $1", [deviceTypeId]);
}

export async function listDeviceTemplates(): Promise<DeviceTemplate[]> {
  const result = await pool.query<DeviceTemplateRow>(`
    SELECT id, template_type, mount_style, icon_key, has_power_spec, power_phase, voltage_v, current_a, name, manufacturer, model, default_height_u, blocks_both_faces, allow_shared_depth
    FROM device_templates
    ORDER BY template_type, default_height_u, name
  `);

  return result.rows.map((row) => ({
    id: row.id,
    templateType: row.template_type,
    mountStyle: row.mount_style,
    iconKey: row.icon_key,
    hasPowerSpec: row.has_power_spec,
    powerPhase: row.power_phase,
    voltageV: row.voltage_v,
    currentA: row.current_a,
    name: row.name,
    manufacturer: row.manufacturer,
    model: row.model,
    defaultHeightU: row.default_height_u,
    blocksBothFaces: row.blocks_both_faces,
    allowSharedDepth: row.allow_shared_depth
  }));
}

export async function createDeviceTemplate(input: DeviceTemplateInput): Promise<DeviceTemplate> {
  const normalized = normalizeTemplateInput(input);
  if (!(await deviceTypeExists(normalized.templateType))) {
    throw new Error("Selected device type does not exist.");
  }

  const result = await pool.query<DeviceTemplateRow>(
    `
      INSERT INTO device_templates (
        template_type,
        mount_style,
        icon_key,
        has_power_spec,
        power_phase,
        voltage_v,
        current_a,
        name,
        manufacturer,
        model,
        default_height_u,
        blocks_both_faces,
        allow_shared_depth
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, template_type, mount_style, icon_key, has_power_spec, power_phase, voltage_v, current_a, name, manufacturer, model, default_height_u, blocks_both_faces, allow_shared_depth
    `,
    [
      normalized.templateType,
      normalized.mountStyle,
      normalized.iconKey,
      normalized.hasPowerSpec,
      normalized.powerPhase,
      normalized.voltageV,
      normalized.currentA,
      normalized.name,
      normalized.manufacturer,
      normalized.model,
      normalized.defaultHeightU,
      normalized.blocksBothFaces,
      normalized.allowSharedDepth
    ]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    templateType: row.template_type,
    mountStyle: row.mount_style,
    iconKey: row.icon_key,
    hasPowerSpec: row.has_power_spec,
    powerPhase: row.power_phase,
    voltageV: row.voltage_v,
    currentA: row.current_a,
    name: row.name,
    manufacturer: row.manufacturer,
    model: row.model,
    defaultHeightU: row.default_height_u,
    blocksBothFaces: row.blocks_both_faces,
    allowSharedDepth: row.allow_shared_depth
  };
}

export async function updateDeviceTemplate(templateId: number, input: DeviceTemplateInput): Promise<DeviceTemplate> {
  const normalized = normalizeTemplateInput(input);
  if (!(await deviceTypeExists(normalized.templateType))) {
    throw new Error("Selected device type does not exist.");
  }

  const result = await pool.query<DeviceTemplateRow>(
    `
      UPDATE device_templates
      SET
        template_type = $1,
        mount_style = $2,
        icon_key = $3,
        has_power_spec = $4,
        power_phase = $5,
        voltage_v = $6,
        current_a = $7,
        name = $8,
        manufacturer = $9,
        model = $10,
        default_height_u = $11,
        blocks_both_faces = $12,
        allow_shared_depth = $13
      WHERE id = $14
      RETURNING id, template_type, mount_style, icon_key, has_power_spec, power_phase, voltage_v, current_a, name, manufacturer, model, default_height_u, blocks_both_faces, allow_shared_depth
    `,
    [
      normalized.templateType,
      normalized.mountStyle,
      normalized.iconKey,
      normalized.hasPowerSpec,
      normalized.powerPhase,
      normalized.voltageV,
      normalized.currentA,
      normalized.name,
      normalized.manufacturer,
      normalized.model,
      normalized.defaultHeightU,
      normalized.blocksBothFaces,
      normalized.allowSharedDepth,
      templateId
    ]
  );

  if (result.rows.length === 0) {
    throw new Error("Device template not found.");
  }

  await pool.query(
    `
      UPDATE rack_devices
      SET
        icon_key = $1,
        has_power_spec = $2,
        power_phase = $3,
        voltage_v = $4,
        current_a = $5
      WHERE template_id = $6
    `,
    [normalized.iconKey, normalized.hasPowerSpec, normalized.powerPhase, normalized.voltageV, normalized.currentA, templateId]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    templateType: row.template_type,
    mountStyle: row.mount_style,
    iconKey: row.icon_key,
    hasPowerSpec: row.has_power_spec,
    powerPhase: row.power_phase,
    voltageV: row.voltage_v,
    currentA: row.current_a,
    name: row.name,
    manufacturer: row.manufacturer,
    model: row.model,
    defaultHeightU: row.default_height_u,
    blocksBothFaces: row.blocks_both_faces,
    allowSharedDepth: row.allow_shared_depth
  };
}

export async function deleteDeviceTemplate(templateId: number): Promise<void> {
  const result = await pool.query("DELETE FROM device_templates WHERE id = $1", [templateId]);
  if ((result.rowCount ?? 0) === 0) {
    throw new Error("Device template not found.");
  }
}

export async function createRackDevice(rackId: number, input: RackDeviceInput): Promise<RackDevice> {
  const auditId = await getAuditIdForRack(rackId);
  if (auditId === null) {
    throw new Error("Rack not found.");
  }

  await assertAuditEditable(auditId);
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
        allow_shared_depth,
        start_unit,
        height_u,
        icon_key,
        has_power_spec,
        power_phase,
        voltage_v,
        current_a,
        name,
        manufacturer,
        model,
        serial_number,
        hostname,
        notes,
        storage_location,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP)
      RETURNING *
    `,
    [
      rackId,
      normalized.templateId ?? null,
      normalized.placementType,
      normalized.rackFace,
      normalized.mountPosition,
      normalized.blocksBothFaces,
      normalized.allowSharedDepth,
      normalized.startUnit,
      normalized.heightU,
      normalized.iconKey ?? null,
      normalized.hasPowerSpec,
      normalized.powerPhase,
      normalized.voltageV,
      normalized.currentA,
      normalized.name,
      normalized.manufacturer,
      normalized.model,
      normalized.serialNumber ?? null,
      normalized.hostname ?? null,
      normalized.notes ?? null,
      normalized.storageLocation ?? null
    ]
  );

  if (normalized.placementType === "rack") {
    await markAuditInProgressWhenFirstRackDeviceIsPlaced(auditId);
  }

  return mapRackDevice(result.rows[0]);
}

export async function updateRackDevice(rackId: number, deviceId: number, input: RackDeviceInput): Promise<RackDevice> {
  const auditId = await getAuditIdForRack(rackId);
  if (auditId === null) {
    throw new Error("Rack not found.");
  }

  await assertAuditEditable(auditId);
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
        allow_shared_depth = $6,
        start_unit = $7,
        height_u = $8,
        icon_key = $9,
        has_power_spec = $10,
        power_phase = $11,
        voltage_v = $12,
        current_a = $13,
        name = $14,
        manufacturer = $15,
        model = $16,
        serial_number = $17,
        hostname = $18,
        notes = $19,
        storage_location = $20,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $21 AND rack_id = $22
      RETURNING *
    `,
    [
      resolvedInput.placementType,
      resolvedInput.templateId ?? null,
      resolvedInput.rackFace,
      resolvedInput.mountPosition,
      resolvedInput.blocksBothFaces,
      resolvedInput.allowSharedDepth,
      resolvedInput.startUnit,
      resolvedInput.heightU,
      resolvedInput.iconKey ?? null,
      resolvedInput.hasPowerSpec,
      resolvedInput.powerPhase,
      resolvedInput.voltageV,
      resolvedInput.currentA,
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

  if (resolvedInput.placementType === "rack") {
    await markAuditInProgressWhenFirstRackDeviceIsPlaced(auditId);
  }

  return mapRackDevice(result.rows[0]);
}

export async function deleteRackDevice(rackId: number, deviceId: number): Promise<void> {
  const auditId = await getAuditIdForRack(rackId);
  if (auditId === null) {
    throw new Error("Rack not found.");
  }

  await assertAuditEditable(auditId);
  const result = await pool.query("DELETE FROM rack_devices WHERE id = $1 AND rack_id = $2", [deviceId, rackId]);
  if ((result.rowCount ?? 0) === 0) {
    throw new Error("Rack device not found.");
  }
}

export async function cloneAudit(auditId: number): Promise<AuditDetail> {
  const sourceAudit = await getAudit(auditId);
  if (!sourceAudit) {
    throw new Error("Audit not found.");
  }

  const roomId = sourceAudit.roomId;
  const nextAuditName = await getNextClonedAuditName(roomId, sourceAudit.name);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const auditResult = await client.query<{ id: number }>(
      `
        INSERT INTO audits (room_id, name, sales_order, status, notes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [
        roomId,
        nextAuditName,
        sourceAudit.salesOrder,
        "created",
        sourceAudit.notes ? `Based on ${sourceAudit.name}. ${sourceAudit.notes}` : `Based on ${sourceAudit.name}.`
      ]
    );

    const nextAuditId = auditResult.rows[0].id;
    await duplicateAuditData(client, sourceAudit, nextAuditId, roomId);
    await client.query("COMMIT");

    const clonedAudit = await getAudit(nextAuditId);
    if (!clonedAudit) {
      throw new Error("Failed to load cloned audit.");
    }

    return clonedAudit;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function reopenAudit(auditId: number): Promise<AuditDetail> {
  const audit = await getAuditBase(auditId);
  if (!audit) {
    throw new Error("Audit not found.");
  }

  if (audit.status !== "completed") {
    throw new Error("Only completed audits can be reopened.");
  }

  await pool.query("UPDATE audits SET status = 'in-progress' WHERE id = $1", [auditId]);
  const reopenedAudit = await getAudit(auditId);
  if (!reopenedAudit) {
    throw new Error("Failed to load reopened audit.");
  }

  return reopenedAudit;
}
