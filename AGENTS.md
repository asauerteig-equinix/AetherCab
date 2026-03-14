# AGENTS.md

## Project
Web application for visual rack inventory documentation.

Users must be able to:
- visually place devices into rack units
- document device name, manufacturer, model and optional metadata
- store rack layouts in a database
- reload and edit existing layouts
- export rack data to Excel and PDF

The application is NOT an audit/checklist system.  
It is a visual rack inventory editor.

---

## Core UX requirement
The rack editor is the central feature.

Rules:
- A rack is a vertical layout of rack units (U).
- Devices can occupy one or multiple units.
- Prevent overlapping devices.
- Multi-U devices must reserve all occupied units.
- Users must be able to drag and drop devices into the rack.
- After placement, allow quick editing of device metadata.

The UI must prioritize:
1. speed
2. clarity
3. minimal interaction steps

Avoid complex forms or workflows.

---

## Data model expectations
Core entities:

- sites
- rooms
- racks
- device_templates
- rack_devices

Each rack device must store:
- rack_id
- start_unit
- height_u
- name
- manufacturer
- model
- optional serial_number
- optional hostname
- optional notes

Rack layout must always be reconstructable from stored data.

---

## Persistence rules
- All rack layouts must be stored in the database.
- Existing layouts must be reloadable.
- Users must be able to edit existing layouts.
- Updates must not corrupt rack placement.

Never treat rack layouts as temporary UI state.

---

## Technical rules
- Use TypeScript.
- Prefer small focused components.
- Keep domain logic separate from UI.
- Avoid unnecessary dependencies.
- Follow existing project structure.

Make the smallest safe change needed to complete a task.

Do not modify unrelated files.

---

## Export requirements
Support two exports:

Excel:
- structured inventory list

PDF:
- readable rack documentation

Exports must reflect the current stored rack state.

---

## Validation
Always enforce:

- no overlapping devices
- no placement outside rack size
- correct multi-U allocation

Never allow invalid rack states.

---

## Code quality
Before completing a task:

- ensure code compiles
- ensure lint passes
- keep implementation simple
- avoid overengineering

---

## Done when
A task is complete only if:

- rack layout works visually
- device placement is valid
- layouts persist and reload correctly
- existing racks remain editable
- exports work
- no unrelated code was changed