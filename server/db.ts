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
      name TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      model TEXT NOT NULL,
      default_height_u INTEGER NOT NULL,
      UNIQUE(name, manufacturer, model)
    );

    CREATE TABLE IF NOT EXISTS rack_devices (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      rack_id INTEGER NOT NULL REFERENCES racks(id) ON DELETE CASCADE,
      placement_type TEXT NOT NULL CHECK (placement_type IN ('rack', 'spare')),
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

  await seedDatabase();
}

async function seedDatabase(): Promise<void> {
  await pool.query(
    `
      INSERT INTO device_templates (template_type, name, manufacturer, model, default_height_u)
      VALUES
        ('server', 'Server 1U', 'Generic', 'Rack Server 1U', 1),
        ('server', 'Server 2U', 'Generic', 'Rack Server 2U', 2),
        ('switch-router', 'Switch/Router 1U', 'Generic', 'Network Device 1U', 1),
        ('switch-router', 'Switch/Router 2U', 'Generic', 'Network Device 2U', 2),
        ('patch-panel', 'Patchpanel 1U', 'Generic', 'Patchpanel 1U', 1),
        ('storage', 'Storage 2U', 'Generic', 'Storage Shelf 2U', 2),
        ('ups', 'UPS 2U', 'Generic', 'UPS 2U', 2)
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
        ($1, 'rack', 40, 2, 'Storage Shelf 01', 'Dell', 'EMC Unity Shelf', 'D-EMC-4401', 'unity-shelf-01', 'Primary storage shelf', NULL),
        ($1, 'rack', 38, 1, 'Core Switch 01', 'Cisco', 'Catalyst 9300', 'C9300-01', 'core-sw-01', 'Top of rack core switch', NULL),
        ($1, 'spare', NULL, 1, 'SFP Module Kit', 'Cisco', 'SFP-10G-SR', NULL, NULL, 'Loose spare transceivers', 'Accessory box')
    `,
    [rackId]
  );
}
