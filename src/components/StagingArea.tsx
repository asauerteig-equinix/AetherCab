import { useState, type DragEvent } from "react";
import { getRackMountPositionShortLabel, isVerticalPduMountPosition } from "../../shared/rack";
import type { RackDevice } from "../../shared/types";
import { getDeviceIconUrl } from "../deviceIcons";
import { clearCurrentDragPayload, getDraggedDeviceId, setCurrentDeviceDrag, writeDeviceDragData } from "../dragPayload";

interface StagingAreaProps {
  devices: RackDevice[];
  selectedDeviceId: number | null;
  saving: boolean;
  disabled?: boolean;
  onSelectDevice(deviceId: number): void;
  onStageDevice(deviceId: number): void;
}

export function StagingArea({ devices, selectedDeviceId, saving, disabled = false, onSelectDevice, onStageDevice }: StagingAreaProps) {
  const [dragActive, setDragActive] = useState(false);
  const isCompact = devices.length === 0 && !dragActive;

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    if (disabled) {
      return;
    }
    const deviceId = getDraggedDeviceId(event.dataTransfer);
    if (deviceId !== null) {
      onStageDevice(deviceId);
    }
    clearCurrentDragPayload();
  }

  return (
    <section className={isCompact ? "panel tray-panel compact" : "panel tray-panel"}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Staging Area</p>
          <h2>Temporary Device Tray</h2>
        </div>
        <span className="muted">{devices.length} stored</span>
      </div>

      <div
        className={dragActive ? "staging-dropzone active" : isCompact ? "staging-dropzone compact" : "staging-dropzone"}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const outside =
            event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
          if (outside) {
            setDragActive(false);
          }
        }}
        onDrop={handleDrop}
      >
        <strong>Drop device here</strong>
        <span>
          {disabled
            ? "Completed audits are read-only."
            : isCompact
              ? "Park devices here temporarily."
              : "Drag devices into the temporary tray to park them without losing their data."}
        </span>
      </div>

      <div className={isCompact ? "spare-list hidden" : "spare-list"}>
        {devices.length === 0 ? (
          <div className="empty-state">No parked devices right now.</div>
        ) : (
          devices.map((device) => (
            <article
              data-device-selection="true"
              className={device.id === selectedDeviceId ? "spare-card selected" : "spare-card"}
              draggable={!disabled}
              key={device.id}
              onClick={() => onSelectDevice(device.id)}
              onDragStart={(event) => {
                if (disabled) {
                  event.preventDefault();
                  return;
                }
                setCurrentDeviceDrag(device.id);
                writeDeviceDragData(event.dataTransfer, device.id);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={clearCurrentDragPayload}
            >
              <img alt="" aria-hidden="true" className="template-icon" src={getDeviceIconUrl(device.iconKey)} />
              <strong>{device.hostname ?? device.name}</strong>
              <span>{device.manufacturer} {device.model}</span>
              <span>
                {device.heightU}U
                {isVerticalPduMountPosition(device.mountPosition) ? ` | ${getRackMountPositionShortLabel(device.mountPosition)}` : ""}
              </span>
              <span>{saving && device.id === selectedDeviceId ? "Saving..." : "Drag back into the rack when ready."}</span>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
