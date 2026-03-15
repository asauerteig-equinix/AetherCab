import type { ChangeEvent } from "react";
import { getRackMountPositionLabel, isVerticalPduMountPosition, verticalPduMountPositions } from "../../shared/rack";
import type { RackDevice, RackDeviceInput } from "../../shared/types";

interface InspectorProps {
  device: RackDevice | null;
  onChange(next: RackDeviceInput): void;
  onMoveToTray(): void;
  onDelete(): void;
  saving: boolean;
}

function normalizeValue(value: string): string | null {
  return value.trim() ? value : null;
}

function toDeviceInput(device: RackDevice): RackDeviceInput {
  return {
    templateId: device.templateId,
    placementType: device.placementType,
    rackFace: device.rackFace,
    mountPosition: device.mountPosition,
    blocksBothFaces: device.blocksBothFaces,
    startUnit: device.startUnit,
    heightU: device.heightU,
    iconKey: device.iconKey,
    name: device.name,
    manufacturer: device.manufacturer,
    model: device.model,
    serialNumber: device.serialNumber,
    hostname: device.hostname,
    notes: device.notes,
    storageLocation: device.storageLocation
  };
}

export function Inspector({ device, onChange, onMoveToTray, onDelete, saving }: InspectorProps) {
  if (!device) {
    return (
      <section className="panel inspector-panel empty">
        <p className="eyebrow">Inspector</p>
        <h2>Quick edit</h2>
        <p>Select a device to edit its metadata.</p>
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
          <h2>{device.hostname ?? device.name}</h2>
        </div>
      </div>

      <div className="inspector-grid">
        <label className="full-width">
          Hostname
          <input
            value={device.hostname ?? device.name}
            onChange={(event) => {
              const nextValue = event.target.value;
              onChange({
                ...draft,
                name: nextValue,
                hostname: normalizeValue(nextValue)
              });
            }}
          />
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
          Mount position
          <select
            value={device.mountPosition}
            disabled={device.placementType === "spare"}
            onChange={updateInput("mountPosition", (event) => event.target.value as RackDeviceInput["mountPosition"])}
          >
            <option value="full">{getRackMountPositionLabel("full")}</option>
            {verticalPduMountPositions.map((mountPosition) => (
              <option key={mountPosition} value={mountPosition}>
                {getRackMountPositionLabel(mountPosition)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rack face
          <select
            value={device.rackFace ?? "front"}
            disabled={device.placementType === "spare" || device.blocksBothFaces || isVerticalPduMountPosition(device.mountPosition)}
            onChange={updateInput("rackFace", (event) => event.target.value as RackDeviceInput["rackFace"])}
          >
            <option value="front">Front</option>
            <option value="rear">Rear</option>
          </select>
        </label>
        <label className="checkbox-field">
          Blocks front and rear
          <input
            checked={device.blocksBothFaces}
            disabled={device.placementType === "spare" || isVerticalPduMountPosition(device.mountPosition)}
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
        <label className="inspector-column-left">
          Serial number
          <input
            value={device.serialNumber ?? ""}
            onChange={updateInput("serialNumber", (event) => normalizeValue(event.target.value))}
          />
        </label>
        <label className="inspector-column-left">
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
          Storage location
          <input
            value={device.storageLocation ?? ""}
            disabled={device.placementType === "rack"}
            onChange={updateInput("storageLocation", (event) => normalizeValue(event.target.value))}
          />
        </label>
        <label className="full-width">
          Notes
          <textarea rows={4} value={device.notes ?? ""} onChange={updateInput("notes", (event) => normalizeValue(event.target.value))} />
        </label>
      </div>
      {isVerticalPduMountPosition(device.mountPosition) ? <p className="muted">Vertical PDUs use side lanes and do not block the main rack width.</p> : null}
      {device.placementType === "spare" ? (
        <p className="muted">This device is only parked temporarily and will not appear in exports.</p>
      ) : null}
      <div className={device.placementType === "rack" ? "inspector-actions split" : "inspector-actions"}>
        {device.placementType === "rack" ? (
          <button className="ghost-button inspector-action-button" disabled={saving} onClick={onMoveToTray} type="button">
            <span aria-hidden="true" className="inspector-action-icon">
              <svg fill="none" height="14" viewBox="0 0 16 14" width="16" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 7H11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
                <path d="M7.5 3.5L11 7L7.5 10.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                <path d="M12.5 2H15V12H12.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
              </svg>
            </span>
            <span>Move to Tray</span>
          </button>
        ) : null}
        <button className="ghost-button danger inspector-action-button" disabled={saving} onClick={onDelete} type="button">
          Delete
        </button>
      </div>
      <p className="muted">{saving ? "Saving changes..." : "Changes are written directly to the database."}</p>
    </section>
  );
}
