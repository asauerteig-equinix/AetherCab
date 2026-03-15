import { useState, type DragEvent } from "react";
import { getRackMountPositionShortLabel, isVerticalPduMountPosition } from "../../shared/rack";
import type { RackDevice } from "../../shared/types";
import { getDeviceIconUrl } from "../deviceIcons";

interface StagingAreaProps {
  devices: RackDevice[];
  selectedDeviceId: number | null;
  saving: boolean;
  onSelectDevice(deviceId: number): void;
  onStageDevice(deviceId: number): void;
}

export function StagingArea({ devices, selectedDeviceId, saving, onSelectDevice, onStageDevice }: StagingAreaProps) {
  const [dragActive, setDragActive] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const deviceId = Number(event.dataTransfer.getData("application/x-aethercab-device"));
    if (!Number.isNaN(deviceId)) {
      onStageDevice(deviceId);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Staging Area</p>
          <h2>Temporary Device Tray</h2>
        </div>
        <span className="muted">{devices.length} stored</span>
      </div>

      <div
        className={dragActive ? "staging-dropzone active" : "staging-dropzone"}
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
        <span>Drag devices into the temporary tray to park them without losing their data.</span>
      </div>

      <div className="spare-list">
        {devices.length === 0 ? (
          <div className="empty-state">No parked devices right now.</div>
        ) : (
          devices.map((device) => (
            <article
              className={device.id === selectedDeviceId ? "spare-card selected" : "spare-card"}
              draggable
              key={device.id}
              onClick={() => onSelectDevice(device.id)}
              onDragStart={(event) => {
                event.dataTransfer.setData("application/x-aethercab-device", String(device.id));
                event.dataTransfer.effectAllowed = "move";
              }}
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
