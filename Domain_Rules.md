# Domain Rules — Rack Inventory

## Rack model
A rack is a vertical stack of rack units (U).

Typical rack size:
- 47U
- 50U

Units are numbered from bottom (1U) to top.

---

## Device placement

Each device has:

- start_unit
- height_u

Example:

start_unit = 10  
height_u = 2

Device occupies:

10U and 11U

---

## Placement constraints

Devices must not:

- overlap other devices
- exceed rack height
- start below 1U

Invalid example:

start_unit = 41
height_u = 4
rack = 42U

Valid example:

start_unit = 39
height_u = 4

---

## Overlap detection

Two devices overlap if:

deviceA.start_unit <= deviceB.end_unit
AND
deviceB.start_unit <= deviceA.end_unit

Where:

end_unit = start_unit + height_u - 1

---

## Drag and drop rules

When placing a device:

1. Determine target start unit
2. Calculate end unit
3. Validate rack boundary
4. Check overlap
5. Commit placement

Reject placement if invalid.

---

## Editing rules

Users must be able to:

- move devices
- resize device height
- edit metadata
- remove devices

Changes must revalidate placement.

---

## Persistence

Rack layout must always be reconstructable from stored data.

The UI must never be the single source of truth.

Database must store:

- rack_devices
- start_unit
- height_u