import { Pool } from "pg";

const defaultDatabaseUrl = "postgresql://aethercab:aethercab@127.0.0.1:5496/aethercab";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? defaultDatabaseUrl
});

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForDatabase(): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (error) {
      lastError = error;
      await sleep(1500);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Database is not reachable.");
}

export async function initializeDatabase(): Promise<void> {
  await waitForDatabase();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      UNIQUE(site_id, name)
    );

    CREATE TABLE IF NOT EXISTS racks (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      total_units INTEGER NOT NULL,
      notes TEXT,
      UNIQUE(room_id, name)
    );

    CREATE TABLE IF NOT EXISTS device_templates (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      template_type TEXT NOT NULL DEFAULT 'other',
      mount_style TEXT NOT NULL DEFAULT 'full' CHECK (mount_style IN ('full', 'vertical-pdu')),
      name TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      model TEXT NOT NULL,
      default_height_u INTEGER NOT NULL,
      blocks_both_faces BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE(name, manufacturer, model)
    );

    CREATE TABLE IF NOT EXISTS rack_devices (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      rack_id INTEGER NOT NULL REFERENCES racks(id) ON DELETE CASCADE,
      placement_type TEXT NOT NULL CHECK (placement_type IN ('rack', 'spare')),
      rack_face TEXT CHECK (rack_face IN ('front', 'rear')),
      mount_position TEXT NOT NULL DEFAULT 'full' CHECK (mount_position IN ('full', 'rear-left-outer', 'rear-left-inner', 'rear-right-inner', 'rear-right-outer')),
      blocks_both_faces BOOLEAN NOT NULL DEFAULT FALSE,
      start_unit INTEGER,
      height_u INTEGER NOT NULL,
      name TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      model TEXT NOT NULL,
      serial_number TEXT,
      hostname TEXT,
      notes TEXT,
      storage_location TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    ALTER TABLE device_templates
    ADD COLUMN IF NOT EXISTS template_type TEXT NOT NULL DEFAULT 'other'
  `);

  await pool.query(`
    ALTER TABLE device_templates
    ADD COLUMN IF NOT EXISTS mount_style TEXT NOT NULL DEFAULT 'full'
  `);

  await pool.query(`
    ALTER TABLE device_templates
    ADD COLUMN IF NOT EXISTS blocks_both_faces BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
    ALTER TABLE rack_devices
    ADD COLUMN IF NOT EXISTS rack_face TEXT CHECK (rack_face IN ('front', 'rear'))
  `);

  await pool.query(`
    ALTER TABLE rack_devices
    ADD COLUMN IF NOT EXISTS mount_position TEXT NOT NULL DEFAULT 'full'
  `);

  await pool.query(`
    ALTER TABLE rack_devices
    ADD COLUMN IF NOT EXISTS blocks_both_faces BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
    UPDATE rack_devices
    SET rack_face = 'front'
    WHERE placement_type = 'rack' AND rack_face IS NULL
  `);

  await pool.query(`
    UPDATE device_templates
    SET mount_style = 'full'
    WHERE mount_style IS NULL
  `);

  await pool.query(`
    UPDATE rack_devices
    SET mount_position = 'full'
    WHERE mount_position IS NULL
  `);

  await seedDatabase();
}

async function seedDatabase(): Promise<void> {
  await pool.query(
    `
      INSERT INTO device_templates (template_type, mount_style, name, manufacturer, model, default_height_u, blocks_both_faces)
      VALUES
        ('server', 'full', 'Server 1U', 'Generic', 'Rack Server 1U', 1, TRUE),
        ('server', 'full', 'Server 2U', 'Generic', 'Rack Server 2U', 2, TRUE),
        ('switch-router', 'full', 'Switch/Router 1U', 'Generic', 'Network Device 1U', 1, FALSE),
        ('switch-router', 'full', 'Switch/Router 2U', 'Generic', 'Network Device 2U', 2, TRUE),
        ('patch-panel', 'full', 'Patchpanel 1U', 'Generic', 'Patchpanel 1U', 1, FALSE),
        ('storage', 'full', 'Storage 2U', 'Generic', 'Storage Shelf 2U', 2, TRUE),
        ('ups', 'full', 'UPS 2U', 'Generic', 'UPS 2U', 2, TRUE),
        ('pdu', 'vertical-pdu', 'Vertical PDU 31U', 'Generic', 'Vertical Rack PDU', 31, FALSE)
      ON CONFLICT (name, manufacturer, model) DO NOTHING
    `
  );

  const rackCountResult = await pool.query<{ count: string }>("SELECT COUNT(*) AS count FROM racks");
  if (Number(rackCountResult.rows[0]?.count ?? 0) > 0) {
    return;
  }

  const siteResult = await pool.query<{ id: number }>(
    "INSERT INTO sites (name) VALUES ($1) RETURNING id",
    ["Demo Campus"]
  );
  const siteId = siteResult.rows[0].id;

  const roomResult = await pool.query<{ id: number }>(
    "INSERT INTO rooms (site_id, name) VALUES ($1, $2) RETURNING id",
    [siteId, "Server Room A"]
  );
  const roomId = roomResult.rows[0].id;

  const rackResult = await pool.query<{ id: number }>(
    "INSERT INTO racks (room_id, name, total_units, notes) VALUES ($1, $2, $3, $4) RETURNING id",
    [roomId, "Rack A1", 42, "Seed rack for the initial editor"]
  );
  const rackId = rackResult.rows[0].id;

  await pool.query(
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
        storage_location
      ) VALUES
        ($1, 'rack', 'front', 'full', TRUE, 40, 2, 'Storage Shelf 01', 'Dell', 'EMC Unity Shelf', 'D-EMC-4401', 'unity-shelf-01', 'Primary storage shelf', NULL),
        ($1, 'rack', 'rear', 'full', FALSE, 38, 1, 'Core Switch 01', 'Cisco', 'Catalyst 9300', 'C9300-01', 'core-sw-01', 'Top of rack core switch', NULL),
        ($1, 'rack', 'rear', 'rear-left-outer', FALSE, 3, 31, 'PDU A', 'APC', 'Metered PDU', 'APC-PDU-A', NULL, 'Rear left vertical PDU', NULL),
        ($1, 'spare', NULL, 'full', FALSE, NULL, 1, 'SFP Module Kit', 'Cisco', 'SFP-10G-SR', NULL, NULL, 'Loose spare transceivers', 'Accessory box')
    `,
    [rackId]
  );
}
