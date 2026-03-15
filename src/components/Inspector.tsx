import { useEffect, useState, type ChangeEvent } from "react";
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

function hasDraftChanges(left: RackDeviceInput, right: RackDeviceInput): boolean {
  return (
    left.templateId !== right.templateId ||
    left.placementType !== right.placementType ||
    left.rackFace !== right.rackFace ||
    left.mountPosition !== right.mountPosition ||
    left.blocksBothFaces !== right.blocksBothFaces ||
    left.startUnit !== right.startUnit ||
    left.heightU !== right.heightU ||
    left.iconKey !== right.iconKey ||
    left.name !== right.name ||
    left.manufacturer !== right.manufacturer ||
    left.model !== right.model ||
    left.serialNumber !== right.serialNumber ||
    left.hostname !== right.hostname ||
    left.notes !== right.notes ||
    left.storageLocation !== right.storageLocation
  );
}

export function Inspector({ device, onChange, onMoveToTray, onDelete, saving }: InspectorProps) {
  const [draft, setDraft] = useState<RackDeviceInput | null>(() => (device ? toDeviceInput(device) : null));

  useEffect(() => {
    setDraft(device ? toDeviceInput(device) : null);
  }, [device]);

  if (!device || !draft) {
    return (
      <section className="panel inspector-panel empty">
        <p className="eyebrow">Inspector</p>
        <h2>Quick edit</h2>
        <p>Select a device to edit its metadata.</p>
      </section>
    );
  }

  const persistedDevice = toDeviceInput(device);

  function commitDraft(nextDraft: RackDeviceInput = draft) {
    if (!hasDraftChanges(nextDraft, persistedDevice)) {
      return;
    }

    onChange(nextDraft);
  }

  function updateInput(
    key: keyof RackDeviceInput,
    transform?: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => RackDeviceInput[keyof RackDeviceInput]
  ) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setDraft({
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
      <div className={device.placementType === "rack" ? "inspector-actions split top" : "inspector-actions top"}>
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

      <div className="inspector-grid">
        <label className="full-width">
          Hostname
          <input
            value={draft.hostname ?? draft.name}
            onChange={(event) => {
              const nextValue = event.target.value;
              setDraft({
                ...draft,
                name: nextValue,
                hostname: normalizeValue(nextValue)
              });
            }}
            onBlur={() => commitDraft()}
          />
        </label>
        <label className="full-width">
          Serial number
          <input
            value={draft.serialNumber ?? ""}
            onBlur={() => commitDraft()}
            onChange={updateInput("serialNumber", (event) => normalizeValue(event.target.value))}
          />
        </label>
        <label>
          Manufacturer
          <input value={draft.manufacturer} onBlur={() => commitDraft()} onChange={updateInput("manufacturer")} />
        </label>
        <label>
          Model
          <input value={draft.model} onBlur={() => commitDraft()} onChange={updateInput("model")} />
        </label>
        <label>
          Mount position
          <select
            value={draft.mountPosition}
            disabled={device.placementType === "spare"}
            onChange={updateInput("mountPosition", (event) => event.target.value as RackDeviceInput["mountPosition"])}
            onBlur={() => commitDraft()}
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
            value={draft.rackFace ?? "front"}
            disabled={device.placementType === "spare" || draft.blocksBothFaces || isVerticalPduMountPosition(draft.mountPosition)}
            onChange={updateInput("rackFace", (event) => event.target.value as RackDeviceInput["rackFace"])}
            onBlur={() => commitDraft()}
          >
            <option value="front">Front</option>
            <option value="rear">Rear</option>
          </select>
        </label>
        <label className="checkbox-field">
          Blocks front and rear
          <input
            checked={draft.blocksBothFaces}
            disabled={device.placementType === "spare" || isVerticalPduMountPosition(draft.mountPosition)}
            type="checkbox"
            onChange={(event) => {
              setDraft({
                ...draft,
                blocksBothFaces: event.target.checked,
                rackFace: draft.rackFace ?? "front"
              });
            }}
            onBlur={() => commitDraft()}
          />
        </label>
        <label>
          Height U
          <input
            min={1}
            type="number"
            value={draft.heightU}
            onBlur={() => commitDraft()}
            onChange={updateInput("heightU", (event) => Number(event.target.value))}
          />
        </label>
        <label className="full-width">
          Notes
          <textarea
            rows={4}
            value={draft.notes ?? ""}
            onBlur={() => commitDraft()}
            onChange={updateInput("notes", (event) => normalizeValue(event.target.value))}
          />
        </label>
      </div>
      {isVerticalPduMountPosition(device.mountPosition) ? <p className="muted">Vertical PDUs use side lanes and do not block the main rack width.</p> : null}
      {device.placementType === "spare" ? (
        <p className="muted">This device is only parked temporarily and will not appear in exports.</p>
      ) : null}
      <p className="muted">{saving ? "Saving changes..." : "Changes are written directly to the database."}</p>
    </section>
  );
}
