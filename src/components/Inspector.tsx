import { useEffect, useState, type ChangeEvent } from "react";
import { getVerticalPduMountPositionsForFace, isVerticalPduMountPosition } from "../../shared/rack";
import type { RackDevice, RackDeviceInput } from "../../shared/types";

type InspectorMountStyle = "full" | "vertical";

interface InspectorProps {
  device: RackDevice | null;
  recentlyDeletedDeviceName: string | null;
  readOnly?: boolean;
  onChange(next: RackDeviceInput): void;
  onMoveToTray(): void;
  onDelete(): void;
  onUndoDelete(): void;
  saving: boolean;
}

function normalizeValue(value: string): string | null {
  return value.trim() ? value : null;
}

function getInspectorMountStyle(mountPosition: RackDeviceInput["mountPosition"]): InspectorMountStyle {
  return isVerticalPduMountPosition(mountPosition) ? "vertical" : "full";
}

function resolveVerticalMountPosition(
  rackFace: RackDeviceInput["rackFace"],
  currentMountPosition: RackDeviceInput["mountPosition"]
): RackDeviceInput["mountPosition"] {
  if (isVerticalPduMountPosition(currentMountPosition)) {
    return currentMountPosition;
  }

  return getVerticalPduMountPositionsForFace(rackFace ?? "front")[0];
}

function toDeviceInput(device: RackDevice): RackDeviceInput {
  return {
    templateId: device.templateId,
    placementType: device.placementType,
    rackFace: device.rackFace,
    mountPosition: device.mountPosition,
    blocksBothFaces: device.blocksBothFaces,
    allowSharedDepth: device.allowSharedDepth,
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
    left.allowSharedDepth !== right.allowSharedDepth ||
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

export function Inspector({ device, recentlyDeletedDeviceName, readOnly = false, onChange, onMoveToTray, onDelete, onUndoDelete, saving }: InspectorProps) {
  const [draft, setDraft] = useState<RackDeviceInput | null>(() => (device ? toDeviceInput(device) : null));

  useEffect(() => {
    setDraft(device ? toDeviceInput(device) : null);
  }, [device]);

  if (!device || !draft) {
    return (
      <section className="panel inspector-panel collapsed" data-device-selection="true">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Inspector</p>
            <h2>{readOnly ? "Details" : "Quick edit"}</h2>
          </div>
          <span className="muted">No device selected</span>
        </div>
        {recentlyDeletedDeviceName ? (
          <div className="inspector-undo-card">
            <span>{`${recentlyDeletedDeviceName} was deleted.`}</span>
            <button className="ghost-button" disabled={saving} onClick={onUndoDelete} type="button">
              Undo delete
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  const persistedDevice = toDeviceInput(device);

  function commitDraft(nextDraft: RackDeviceInput = draft) {
    if (!hasDraftChanges(nextDraft, persistedDevice)) {
      return;
    }

    if (readOnly) {
      return;
    }

    onChange(nextDraft);
  }

  function updateAndCommitImmediately(nextDraft: RackDeviceInput) {
    setDraft(nextDraft);

    if (!hasDraftChanges(nextDraft, persistedDevice) || readOnly) {
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
    <section className="panel inspector-panel" data-device-selection="true">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Inspector</p>
          <h2>{device.hostname ?? device.name}</h2>
        </div>
        {readOnly ? <span className="muted">Read-only</span> : null}
      </div>
      {recentlyDeletedDeviceName ? (
        <div className="inspector-undo-card">
          <span>{`${recentlyDeletedDeviceName} was deleted.`}</span>
          <button className="ghost-button" disabled={saving} onClick={onUndoDelete} type="button">
            Undo delete
          </button>
        </div>
      ) : null}
      <div className={device.placementType === "rack" ? "inspector-actions split top" : "inspector-actions top"}>
        {device.placementType === "rack" ? (
          <button className="ghost-button inspector-action-button" disabled={saving || readOnly} onClick={onMoveToTray} type="button">
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
        <button className="ghost-button danger inspector-action-button" disabled={saving || readOnly} onClick={onDelete} type="button">
          Delete
        </button>
      </div>

      <div className="inspector-grid">
        <label className="full-width">
          Hostname
          <input
            disabled={readOnly}
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
            disabled={readOnly}
            value={draft.serialNumber ?? ""}
            onBlur={() => commitDraft()}
            onChange={updateInput("serialNumber", (event) => normalizeValue(event.target.value))}
          />
        </label>
        <label>
          Manufacturer
          <input disabled={readOnly} value={draft.manufacturer} onBlur={() => commitDraft()} onChange={updateInput("manufacturer")} />
        </label>
        <label>
          Model
          <input disabled={readOnly} value={draft.model} onBlur={() => commitDraft()} onChange={updateInput("model")} />
        </label>
        <label>
          Mount style
          <select
            value={getInspectorMountStyle(draft.mountPosition)}
            disabled={readOnly || device.placementType === "spare"}
            onChange={(event) => {
              const nextMountStyle = event.target.value as InspectorMountStyle;

              setDraft({
                ...draft,
                rackFace: draft.rackFace ?? "front",
                blocksBothFaces: nextMountStyle === "vertical" ? false : draft.blocksBothFaces,
                allowSharedDepth: nextMountStyle === "vertical" ? false : draft.allowSharedDepth,
                mountPosition:
                  nextMountStyle === "vertical" ? resolveVerticalMountPosition(draft.rackFace, draft.mountPosition) : "full"
              });
            }}
            onBlur={() => commitDraft()}
          >
            <option value="full">Standard rack device</option>
            <option value="vertical">Vertical side device</option>
          </select>
        </label>
        <label className="checkbox-field">
          Blocks front and rear
          <input
            checked={draft.blocksBothFaces}
            disabled={readOnly || device.placementType === "spare" || isVerticalPduMountPosition(draft.mountPosition)}
            type="checkbox"
            onChange={(event) => {
              updateAndCommitImmediately({
                ...draft,
                blocksBothFaces: event.target.checked,
                allowSharedDepth: event.target.checked ? false : draft.allowSharedDepth,
                rackFace: draft.rackFace ?? "front"
              });
            }}
          />
        </label>
        <label className="checkbox-field full-width">
          Allow shared depth shelf placement
          <input
            checked={draft.allowSharedDepth}
            disabled={readOnly || isVerticalPduMountPosition(draft.mountPosition) || draft.blocksBothFaces}
            type="checkbox"
            onChange={(event) => {
              updateAndCommitImmediately({
                ...draft,
                allowSharedDepth: event.target.checked,
                rackFace: draft.rackFace ?? "front"
              });
            }}
          />
        </label>
        <label>
          Height U
          <input
            disabled={readOnly}
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
            disabled={readOnly}
            rows={4}
            value={draft.notes ?? ""}
            onBlur={() => commitDraft()}
            onChange={updateInput("notes", (event) => normalizeValue(event.target.value))}
          />
        </label>
      </div>
      {isVerticalPduMountPosition(draft.mountPosition) ? <p className="muted">Vertical PDUs use side lanes and do not block the main rack width.</p> : null}
      {draft.allowSharedDepth ? (
        <p className="muted">This device may share the same U-range with a full-depth device on the opposite rack face.</p>
      ) : null}
      {device.placementType === "spare" ? (
        <p className="muted">This device is only parked temporarily and will not appear in exports.</p>
      ) : null}
      <p className="muted">{readOnly ? "Completed audits can only be viewed." : saving ? "Saving changes..." : "Changes are written directly to the database."}</p>
    </section>
  );
}
