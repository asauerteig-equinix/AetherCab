import type { ChangeEvent } from "react";
import type { RackDevice, RackDeviceInput } from "../../shared/types";

interface InspectorProps {
  device: RackDevice | null;
  onChange(next: RackDeviceInput): void;
  onDelete(): void;
  saving: boolean;
}

function normalizeValue(value: string): string | null {
  return value.trim() ? value : null;
}

function toDeviceInput(device: RackDevice): RackDeviceInput {
  return {
    placementType: device.placementType,
    startUnit: device.startUnit,
    heightU: device.heightU,
    name: device.name,
    manufacturer: device.manufacturer,
    model: device.model,
    serialNumber: device.serialNumber,
    hostname: device.hostname,
    notes: device.notes,
    storageLocation: device.storageLocation
  };
}

export function Inspector({ device, onChange, onDelete, saving }: InspectorProps) {
  if (!device) {
    return (
      <section className="panel inspector-panel empty">
        <p className="eyebrow">Inspector</p>
        <h2>Quick edit</h2>
        <p>Select a rack device or spare part to edit metadata.</p>
      </section>
    );
  }

  const draft = toDeviceInput(device);

  function updateInput(
    key: keyof RackDeviceInput,
    transform?: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => RackDeviceInput[keyof RackDeviceInput]
  ) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange({
        ...draft,
        [key]: transform ? transform(event) : event.target.value
      });
    };
  }

  return (
    <section className="panel inspector-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Inspector</p>
          <h2>{device.name}</h2>
        </div>
        <button className="ghost-button" onClick={onDelete} type="button">
          Remove
        </button>
      </div>

      <div className="inspector-grid">
        <label>
          Name
          <input value={device.name} onChange={updateInput("name")} />
        </label>
        <label>
          Manufacturer
          <input value={device.manufacturer} onChange={updateInput("manufacturer")} />
        </label>
        <label>
          Model
          <input value={device.model} onChange={updateInput("model")} />
        </label>
        <label>
          Height U
          <input
            min={1}
            type="number"
            value={device.heightU}
            onChange={updateInput("heightU", (event) => Number(event.target.value))}
          />
        </label>
        <label>
          Start U
          <input
            min={1}
            type="number"
            value={device.startUnit ?? ""}
            disabled={device.placementType === "spare"}
            onChange={updateInput("startUnit", (event) => (event.target.value ? Number(event.target.value) : null))}
          />
        </label>
        <label>
          Storage
          <input
            value={device.storageLocation ?? ""}
            disabled={device.placementType === "rack"}
            onChange={updateInput("storageLocation", (event) => normalizeValue(event.target.value))}
          />
        </label>
        <label>
          Hostname
          <input value={device.hostname ?? ""} onChange={updateInput("hostname", (event) => normalizeValue(event.target.value))} />
        </label>
        <label>
          Serial
          <input
            value={device.serialNumber ?? ""}
            onChange={updateInput("serialNumber", (event) => normalizeValue(event.target.value))}
          />
        </label>
        <label className="full-width">
          Notes
          <textarea rows={4} value={device.notes ?? ""} onChange={updateInput("notes", (event) => normalizeValue(event.target.value))} />
        </label>
      </div>
      <p className="muted">{saving ? "Saving changes..." : "Changes save immediately to the database."}</p>
    </section>
  );
}
