import type { DragEvent } from "react";
import { getEndUnit } from "../../shared/rack";
import type { RackDetail, RackDevice } from "../../shared/types";

interface RackCanvasProps {
  rack: RackDetail;
  selectedDeviceId: number | null;
  onSelectDevice(deviceId: number): void;
  onTemplateDrop(unit: number, templatePayload: string): void;
  onDeviceMove(device: RackDevice, nextStartUnit: number): void;
}

const slotHeight = 28;

export function RackCanvas({
  rack,
  selectedDeviceId,
  onSelectDevice,
  onTemplateDrop,
  onDeviceMove
}: RackCanvasProps) {
  const placedDevices = rack.devices.filter((device) => device.placementType === "rack" && device.startUnit !== null);

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handleDrop(unit: number, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const templatePayload = event.dataTransfer.getData("application/x-aethercab-template");
    const devicePayload = event.dataTransfer.getData("application/x-aethercab-device");

    if (templatePayload) {
      onTemplateDrop(unit, templatePayload);
      return;
    }

    if (devicePayload) {
      const device = placedDevices.find((entry) => String(entry.id) === devicePayload);
      if (device) {
        onDeviceMove(device, unit);
      }
    }
  }

  return (
    <section className="panel rack-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Rack editor</p>
          <h2>{rack.name}</h2>
        </div>
        <div className="rack-meta">
          <span>{rack.siteName}</span>
          <span>{rack.roomName}</span>
          <span>{rack.totalUnits}U</span>
        </div>
      </div>
      <div className="rack-frame">
        <div className="rack-units" style={{ height: rack.totalUnits * slotHeight }}>
          {Array.from({ length: rack.totalUnits }, (_, index) => {
            const unit = rack.totalUnits - index;
            return (
              <div
                className="rack-slot"
                key={unit}
                onDragOver={handleDragOver}
                onDrop={(event) => handleDrop(unit, event)}
              >
                <span className="slot-label">{unit}U</span>
              </div>
            );
          })}

          {placedDevices.map((device) => {
            const startUnit = device.startUnit!;
            const endUnit = getEndUnit(startUnit, device.heightU);
            const bottom = (startUnit - 1) * slotHeight;
            const height = device.heightU * slotHeight - 4;
            const top = rack.totalUnits * slotHeight - bottom - height - 2;

            return (
              <button
                key={device.id}
                className={device.id === selectedDeviceId ? "rack-device selected" : "rack-device"}
                style={{ top, height }}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("application/x-aethercab-device", String(device.id));
                }}
                onClick={() => onSelectDevice(device.id)}
                type="button"
              >
                <strong>{device.name}</strong>
                <span>{device.manufacturer}</span>
                <span>
                  {startUnit}U - {endUnit}U
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
