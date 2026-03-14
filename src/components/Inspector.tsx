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
    rackFace: device.rackFace,
    blocksBothFaces: device.blocksBothFaces,
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
        <h2>Schnellbearbeitung</h2>
        <p>Waehle ein Geraet aus, um die Metadaten zu bearbeiten.</p>
      </section>
    );
  }

  const draft = toDeviceInput(device);

  function updateInput(
    key: keyof RackDeviceInput,
    transform?: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => RackDeviceInput[keyof RackDeviceInput]
  ) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
          Entfernen
        </button>
      </div>

      <div className="inspector-grid">
        <label>
          Name
          <input value={device.name} onChange={updateInput("name")} />
        </label>
        <label>
          Hersteller
          <input value={device.manufacturer} onChange={updateInput("manufacturer")} />
        </label>
        <label>
          Modell
          <input value={device.model} onChange={updateInput("model")} />
        </label>
        <label>
          Hoehe U
          <input
            min={1}
            type="number"
            value={device.heightU}
            onChange={updateInput("heightU", (event) => Number(event.target.value))}
          />
        </label>
        <label>
          Rack Seite
          <select
            value={device.rackFace ?? "front"}
            disabled={device.placementType === "spare" || device.blocksBothFaces}
            onChange={updateInput("rackFace", (event) => event.target.value as RackDeviceInput["rackFace"])}
          >
            <option value="front">Vorderseite</option>
            <option value="rear">Rueckseite</option>
          </select>
        </label>
        <label className="checkbox-field">
          Blockiert vorne und hinten
          <input
            checked={device.blocksBothFaces}
            disabled={device.placementType === "spare"}
            type="checkbox"
            onChange={(event) => {
              onChange({
                ...draft,
                blocksBothFaces: event.target.checked,
                rackFace: event.target.checked ? device.rackFace ?? "front" : device.rackFace ?? "front"
              });
            }}
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
          Lagerort
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
          Seriennummer
          <input
            value={device.serialNumber ?? ""}
            onChange={updateInput("serialNumber", (event) => normalizeValue(event.target.value))}
          />
        </label>
        <label className="full-width">
          Notizen
          <textarea rows={4} value={device.notes ?? ""} onChange={updateInput("notes", (event) => normalizeValue(event.target.value))} />
        </label>
      </div>
      <p className="muted">{saving ? "Aenderungen werden gespeichert..." : "Aenderungen werden direkt in der Datenbank gespeichert."}</p>
    </section>
  );
}
