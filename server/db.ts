import { Pool } from "pg";

const defaultDatabaseUrl = "postgresql://aethercad:aethercad@127.0.0.1:5496/aethercad";

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

    CREATE TABLE IF NOT EXISTS audits (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sales_order TEXT,
      status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'in-progress', 'completed')),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(room_id, name)
    );

    CREATE TABLE IF NOT EXISTS racks (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      audit_id INTEGER REFERENCES audits(id) ON DELETE CASCADE,
      room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      total_units INTEGER NOT NULL,
      width_mm INTEGER NOT NULL DEFAULT 600,
      depth_mm INTEGER NOT NULL DEFAULT 1000,
      height_mm INTEGER NOT NULL DEFAULT 2200,
      notes TEXT,
      UNIQUE(audit_id, name)
    );

    CREATE TABLE IF NOT EXISTS device_templates (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      template_type TEXT NOT NULL DEFAULT 'other',
      mount_style TEXT NOT NULL DEFAULT 'full' CHECK (mount_style IN ('full', 'vertical-pdu')),
      icon_key TEXT NOT NULL DEFAULT 'generic-device',
      has_power_spec BOOLEAN NOT NULL DEFAULT FALSE,
      power_phase TEXT CHECK (power_phase IN ('single-phase', 'three-phase', 'custom')),
      voltage_v INTEGER,
      current_a INTEGER,
      name TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      model TEXT NOT NULL,
      default_height_u INTEGER NOT NULL,
      blocks_both_faces BOOLEAN NOT NULL DEFAULT FALSE,
      allow_shared_depth BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE(name, manufacturer, model)
    );

    CREATE TABLE IF NOT EXISTS device_types (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rack_devices (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      rack_id INTEGER NOT NULL REFERENCES racks(id) ON DELETE CASCADE,
      template_id INTEGER REFERENCES device_templates(id) ON DELETE SET NULL,
      placement_type TEXT NOT NULL CHECK (placement_type IN ('rack', 'spare')),
      rack_face TEXT CHECK (rack_face IN ('front', 'rear')),
      mount_position TEXT NOT NULL DEFAULT 'full' CHECK (mount_position IN ('full', 'front-left-outer', 'front-left-inner', 'front-right-inner', 'front-right-outer', 'rear-left-outer', 'rear-left-inner', 'rear-right-inner', 'rear-right-outer')),
      blocks_both_faces BOOLEAN NOT NULL DEFAULT FALSE,
      allow_shared_depth BOOLEAN NOT NULL DEFAULT FALSE,
      start_unit INTEGER,
      height_u INTEGER NOT NULL,
      icon_key TEXT,
      has_power_spec BOOLEAN NOT NULL DEFAULT FALSE,
      power_phase TEXT CHECK (power_phase IN ('single-phase', 'three-phase', 'custom')),
      voltage_v INTEGER,
      current_a INTEGER,
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
    ALTER TABLE audits
    ADD COLUMN IF NOT EXISTS sales_order TEXT
  `);

  await pool.query(`
    ALTER TABLE audits
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'created'
  `);

  await pool.query(`
    ALTER TABLE audits
    DROP CONSTRAINT IF EXISTS audits_status_check
  `);

  await pool.query(`
    ALTER TABLE audits
    ADD CONSTRAINT audits_status_check
    CHECK (status IN ('created', 'in-progress', 'completed'))
  `);

  await pool.query(`
    ALTER TABLE audits
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  `);

  await pool.query(`
    UPDATE audits
    SET status = 'created'
    WHERE status IS NULL OR status = ''
  `);

  await pool.query(`
    ALTER TABLE racks
    ADD COLUMN IF NOT EXISTS audit_id INTEGER
  `);

  await pool.query(`
    ALTER TABLE racks
    ADD COLUMN IF NOT EXISTS width_mm INTEGER NOT NULL DEFAULT 600
  `);

  await pool.query(`
    ALTER TABLE racks
    ADD COLUMN IF NOT EXISTS depth_mm INTEGER NOT NULL DEFAULT 1000
  `);

  await pool.query(`
    ALTER TABLE racks
    ADD COLUMN IF NOT EXISTS height_mm INTEGER NOT NULL DEFAULT 2200
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'racks_audit_id_fkey'
          AND table_name = 'racks'
      ) THEN
        ALTER TABLE racks
        ADD CONSTRAINT racks_audit_id_fkey
        FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE;
      END IF;
    END $$;
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
    ADD COLUMN IF NOT EXISTS icon_key TEXT NOT NULL DEFAULT 'generic-device'
  `);

  await pool.query(`
    ALTER TABLE device_templates
    ADD COLUMN IF NOT EXISTS has_power_spec BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
    ALTER TABLE device_templates
    ADD COLUMN IF NOT EXISTS power_phase TEXT
  `);

  await pool.query(`
    ALTER TABLE device_templates
    ADD COLUMN IF NOT EXISTS voltage_v INTEGER
  `);

  await pool.query(`
    ALTER TABLE device_templates
    ADD COLUMN IF NOT EXISTS current_a INTEGER
  `);

  await pool.query(`
    ALTER TABLE device_templates
    ADD COLUMN IF NOT EXISTS blocks_both_faces BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
    ALTER TABLE device_templates
    ADD COLUMN IF NOT EXISTS allow_shared_depth BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS device_types (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL
    )
  `);

  await pool.query(`
    ALTER TABLE rack_devices
    ADD COLUMN IF NOT EXISTS template_id INTEGER
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'rack_devices_template_id_fkey'
          AND table_name = 'rack_devices'
      ) THEN
        ALTER TABLE rack_devices
        ADD CONSTRAINT rack_devices_template_id_fkey
        FOREIGN KEY (template_id) REFERENCES device_templates(id) ON DELETE SET NULL;
      END IF;
    END $$;
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
    DROP CONSTRAINT IF EXISTS rack_devices_mount_position_check
  `);

  await pool.query(`
    ALTER TABLE rack_devices
    ADD CONSTRAINT rack_devices_mount_position_check
    CHECK (mount_position IN ('full', 'front-left-outer', 'front-left-inner', 'front-right-inner', 'front-right-outer', 'rear-left-outer', 'rear-left-inner', 'rear-right-inner', 'rear-right-outer'))
  `);

  await pool.query(`
    ALTER TABLE rack_devices
    ADD COLUMN IF NOT EXISTS blocks_both_faces BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
    ALTER TABLE rack_devices
    ADD COLUMN IF NOT EXISTS allow_shared_depth BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
    ALTER TABLE rack_devices
    ADD COLUMN IF NOT EXISTS icon_key TEXT
  `);

  await pool.query(`
    ALTER TABLE rack_devices
    ADD COLUMN IF NOT EXISTS has_power_spec BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
    ALTER TABLE rack_devices
    ADD COLUMN IF NOT EXISTS power_phase TEXT
  `);

  await pool.query(`
    ALTER TABLE rack_devices
    ADD COLUMN IF NOT EXISTS voltage_v INTEGER
  `);

  await pool.query(`
    ALTER TABLE rack_devices
    ADD COLUMN IF NOT EXISTS current_a INTEGER
  `);

  await pool.query(`
    ALTER TABLE device_templates
    DROP CONSTRAINT IF EXISTS device_templates_power_phase_check
  `);

  await pool.query(`
    ALTER TABLE device_templates
    ADD CONSTRAINT device_templates_power_phase_check
    CHECK (power_phase IS NULL OR power_phase IN ('single-phase', 'three-phase', 'custom'))
  `);

  await pool.query(`
    ALTER TABLE rack_devices
    DROP CONSTRAINT IF EXISTS rack_devices_power_phase_check
  `);

  await pool.query(`
    ALTER TABLE rack_devices
    ADD CONSTRAINT rack_devices_power_phase_check
    CHECK (power_phase IS NULL OR power_phase IN ('single-phase', 'three-phase', 'custom'))
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
    UPDATE device_templates
    SET icon_key = CASE template_type
      WHEN 'server' THEN 'server'
      WHEN 'switch-router' THEN 'switch'
      WHEN 'patch-panel' THEN 'patch-panel'
      WHEN 'storage' THEN 'storage'
      WHEN 'ups' THEN 'ups'
      WHEN 'pdu' THEN 'pdu-vertical'
      ELSE 'generic-device'
    END
    WHERE icon_key IS NULL OR icon_key = ''
  `);

  await pool.query(`
    UPDATE device_templates
    SET allow_shared_depth = FALSE
    WHERE mount_style = 'vertical-pdu' OR blocks_both_faces = TRUE
  `);

  await pool.query(`
    UPDATE device_templates
    SET power_phase = NULL, voltage_v = NULL, current_a = NULL
    WHERE has_power_spec = FALSE
  `);

  await pool.query(`
    UPDATE rack_devices
    SET mount_position = 'full'
    WHERE mount_position IS NULL
  `);

  await pool.query(`
    UPDATE rack_devices
    SET icon_key = CASE
      WHEN mount_position <> 'full' THEN 'pdu-vertical'
      ELSE 'generic-device'
    END
    WHERE icon_key IS NULL OR icon_key = ''
  `);

  await pool.query(`
    UPDATE rack_devices
    SET allow_shared_depth = FALSE
    WHERE mount_position <> 'full' OR blocks_both_faces = TRUE
  `);

  await pool.query(`
    UPDATE rack_devices
    SET power_phase = NULL, voltage_v = NULL, current_a = NULL
    WHERE has_power_spec = FALSE
  `);

  await pool.query(`
    INSERT INTO device_types (key, label)
    SELECT DISTINCT template_type, INITCAP(REPLACE(template_type, '-', ' '))
    FROM device_templates
    WHERE template_type IS NOT NULL AND template_type <> ''
    ON CONFLICT (key) DO NOTHING
  `);

  await pool.query(`
    UPDATE device_types
    SET label = 'Patch Panel'
    WHERE key = 'patch-panel' AND label = 'Patchpanel'
  `);

  await pool.query(`
    UPDATE device_templates
    SET
      name = CASE WHEN name = 'Patchpanel 1U' THEN 'Patch Panel 1U' ELSE name END,
      model = CASE WHEN model = 'Patchpanel 1U' THEN 'Patch Panel 1U' ELSE model END
    WHERE template_type = 'patch-panel'
      AND (name = 'Patchpanel 1U' OR model = 'Patchpanel 1U')
  `);

  await pool.query(`
    INSERT INTO audits (room_id, name, notes)
    SELECT racks.room_id, racks.name, racks.notes
    FROM racks
    WHERE racks.audit_id IS NULL
    ON CONFLICT (room_id, name) DO NOTHING
  `);

  await pool.query(`
    ALTER TABLE racks
    DROP CONSTRAINT IF EXISTS racks_room_id_name_key
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'racks_audit_id_name_key'
          AND table_name = 'racks'
      ) THEN
        ALTER TABLE racks
        ADD CONSTRAINT racks_audit_id_name_key UNIQUE (audit_id, name);
      END IF;
    END $$;
  `);

  await pool.query(`
    UPDATE racks
    SET audit_id = audits.id
    FROM audits
    WHERE racks.audit_id IS NULL
      AND audits.room_id = racks.room_id
      AND audits.name = racks.name
  `);

  await pool.query(`
    UPDATE racks
    SET room_id = audits.room_id
    FROM audits
    WHERE racks.audit_id = audits.id
  `);

  await pool.query(`
    UPDATE racks
    SET width_mm = 600
    WHERE width_mm IS NULL OR width_mm < 1
  `);

  await pool.query(`
    UPDATE racks
    SET depth_mm = 1000
    WHERE depth_mm IS NULL OR depth_mm < 1
  `);

  await pool.query(`
    UPDATE racks
    SET height_mm = 2200
    WHERE height_mm IS NULL OR height_mm < 1
  `);

  await seedDatabase();
}

async function seedDatabase(): Promise<void> {
  await pool.query(
    `
      INSERT INTO device_types (key, label)
      VALUES
        ('server', 'Server'),
        ('switch-router', 'Switch/Router'),
        ('patch-panel', 'Patch Panel'),
        ('storage', 'Storage'),
        ('ups', 'UPS'),
        ('pdu', 'PDU'),
        ('other', 'Other')
      ON CONFLICT (key) DO UPDATE
      SET label = EXCLUDED.label
    `
  );

  await pool.query(
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
      VALUES
        ('server', 'full', 'server', FALSE, NULL, NULL, NULL, 'Server 1U', 'Generic', 'Rack Server 1U', 1, TRUE, FALSE),
        ('server', 'full', 'server', FALSE, NULL, NULL, NULL, 'Server 2U', 'Generic', 'Rack Server 2U', 2, TRUE, FALSE),
        ('switch-router', 'full', 'switch', FALSE, NULL, NULL, NULL, 'Switch/Router 1U', 'Generic', 'Network Device 1U', 1, FALSE, FALSE),
        ('switch-router', 'full', 'switch', FALSE, NULL, NULL, NULL, 'Switch/Router 2U', 'Generic', 'Network Device 2U', 2, TRUE, FALSE),
        ('patch-panel', 'full', 'patch-panel', FALSE, NULL, NULL, NULL, 'Patch Panel 1U', 'Generic', 'Patch Panel 1U', 1, FALSE, FALSE),
        ('storage', 'full', 'storage', FALSE, NULL, NULL, NULL, 'Storage 2U', 'Generic', 'Storage Shelf 2U', 2, TRUE, FALSE),
        ('ups', 'full', 'ups', FALSE, NULL, NULL, NULL, 'UPS 2U', 'Generic', 'UPS 2U', 2, TRUE, FALSE),
        ('pdu', 'vertical-pdu', 'pdu-vertical', TRUE, 'single-phase', 230, 32, 'Vertical PDU 31U', 'Generic', 'Vertical Rack PDU', 31, FALSE, FALSE)
      ON CONFLICT (name, manufacturer, model) DO NOTHING
    `
  );

  const auditCountResult = await pool.query<{ count: string }>("SELECT COUNT(*) AS count FROM audits");
  if (Number(auditCountResult.rows[0]?.count ?? 0) > 0) {
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

  const auditResult = await pool.query<{ id: number }>(
    "INSERT INTO audits (room_id, name, sales_order, status, notes) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [roomId, "Demo Customer / System", "SO-10001", "created", "Seed audit for the initial editor"]
  );
  const auditId = auditResult.rows[0].id;

  const rackResult = await pool.query<{ id: number }>(
    "INSERT INTO racks (audit_id, room_id, name, total_units, width_mm, depth_mm, height_mm, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
    [auditId, roomId, "Rack A1", 47, 600, 1000, 2200, null]
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
        storage_location
      ) VALUES
        ($1, 'rack', 'front', 'full', TRUE, 40, 2, 'storage', FALSE, NULL, NULL, NULL, 'Storage Shelf 01', 'Dell', 'EMC Unity Shelf', 'D-EMC-4401', 'unity-shelf-01', 'Primary storage shelf', NULL),
        ($1, 'rack', 'rear', 'full', FALSE, 38, 1, 'switch', FALSE, NULL, NULL, NULL, 'Core Switch 01', 'Cisco', 'Catalyst 9300', 'C9300-01', 'core-sw-01', 'Top of rack core switch', NULL),
        ($1, 'rack', 'rear', 'rear-left-outer', FALSE, 3, 31, 'pdu-vertical', TRUE, 'single-phase', 230, 32, 'PDU A', 'APC', 'Metered PDU', 'APC-PDU-A', NULL, 'Rear left vertical PDU', NULL),
        ($1, 'spare', NULL, 'full', FALSE, NULL, 1, 'generic-device', FALSE, NULL, NULL, NULL, 'SFP Module Kit', 'Cisco', 'SFP-10G-SR', NULL, NULL, 'Loose spare transceivers', 'Accessory box')
    `,
    [rackId]
  );
}
