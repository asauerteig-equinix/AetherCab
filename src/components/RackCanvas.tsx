import { useState, type DragEvent } from "react";
import { getAnchoredStartUnit, getEndUnit } from "../../shared/rack";
import type { DeviceTemplate, RackDetail, RackDevice, RackFace } from "../../shared/types";

interface RackCanvasProps {
  rack: RackDetail;
  activeRackFace: RackFace;
  selectedDeviceId: number | null;
  onSelectDevice(deviceId: number): void;
  onRackFaceChange(nextFace: RackFace): void;
  onTemplateDrop(unit: number, templatePayload: string): void;
  onDeviceMove(device: RackDevice, nextStartUnit: number): void;
}

const slotHeight = 28;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function RackCanvas({
  rack,
  activeRackFace,
  selectedDeviceId,
  onSelectDevice,
  onRackFaceChange,
  onTemplateDrop,
  onDeviceMove
}: RackCanvasProps) {
  const [previewPlacement, setPreviewPlacement] = useState<{ startUnit: number; endUnit: number } | null>(null);
  const [draggingDevice, setDraggingDevice] = useState<{ deviceId: number; offsetUnitsFromTop: number } | null>(null);
  const faceLabel = activeRackFace === "front" ? "Front" : "Rear";
  const placedDevices = rack.devices.filter(
    (device) =>
      device.placementType === "rack" &&
      device.startUnit !== null &&
      (device.blocksBothFaces || device.rackFace === activeRackFace)
  );

  function getUnitFromPointer(event: DragEvent<HTMLDivElement>): number {
    const rackBounds = event.currentTarget.getBoundingClientRect();
    const pointerY = clamp(event.clientY - rackBounds.top, 0, rackBounds.height - 1);
    const slotIndexFromTop = clamp(Math.floor(pointerY / slotHeight), 0, rack.totalUnits - 1);

    return rack.totalUnits - slotIndexFromTop;
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = draggingDevice ? "move" : "copy";
    const hoveredUnit = getUnitFromPointer(event);
    const templatePayload = event.dataTransfer.getData("application/x-aethercab-template");
    const devicePayload = event.dataTransfer.getData("application/x-aethercab-device");

    if (templatePayload) {
      const template = JSON.parse(templatePayload) as DeviceTemplate;
      const startUnit =
        template.defaultHeightU > 1
          ? getAnchoredStartUnit(
              hoveredUnit,
              template.defaultHeightU,
              rack.totalUnits,
              activeRackFace,
              template.blocksBothFaces,
              rack.devices
            )
          : hoveredUnit;

      setPreviewPlacement(startUnit === null ? null : { startUnit, endUnit: getEndUnit(startUnit, template.defaultHeightU) });
      return;
    }

    if (devicePayload) {
      const device = placedDevices.find((entry) => String(entry.id) === devicePayload);
      if (!device) {
        setPreviewPlacement(null);
        return;
      }

      const offsetUnitsFromTop = draggingDevice?.deviceId === device.id ? draggingDevice.offsetUnitsFromTop : device.heightU - 1;
      const startUnit = clamp(hoveredUnit - (device.heightU - 1 - offsetUnitsFromTop), 1, rack.totalUnits - device.heightU + 1);
      setPreviewPlacement({ startUnit, endUnit: getEndUnit(startUnit, device.heightU) });
      return;
    }

    setPreviewPlacement(null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const hoveredUnit = getUnitFromPointer(event);
    const templatePayload = event.dataTransfer.getData("application/x-aethercab-template");
    const devicePayload = event.dataTransfer.getData("application/x-aethercab-device");

    setPreviewPlacement(null);

    if (templatePayload) {
      onTemplateDrop(hoveredUnit, templatePayload);
      return;
    }

    if (devicePayload) {
      const device = placedDevices.find((entry) => String(entry.id) === devicePayload);
      if (device) {
        const offsetUnitsFromTop = draggingDevice?.deviceId === device.id ? draggingDevice.offsetUnitsFromTop : device.heightU - 1;
        const nextStartUnit = clamp(hoveredUnit - (device.heightU - 1 - offsetUnitsFromTop), 1, rack.totalUnits - device.heightU + 1);
        onDeviceMove(device, nextStartUnit);
      }
    }

    setDraggingDevice(null);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    const rackBounds = event.currentTarget.getBoundingClientRect();
    const isOutsideRack =
      event.clientX < rackBounds.left ||
      event.clientX > rackBounds.right ||
      event.clientY < rackBounds.top ||
      event.clientY > rackBounds.bottom;

    if (isOutsideRack) {
      setPreviewPlacement(null);
    }
  }

  return (
    <section className="panel rack-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Rack Editor</p>
          <h2>Rack View</h2>
        </div>
        <div className="rack-toolbar">
          <span className="toolbar-label">View</span>
          <div className="rack-face-toggle">
            <button
              className={activeRackFace === "front" ? "face-toggle selected" : "face-toggle"}
              onClick={() => onRackFaceChange("front")}
              type="button"
            >
              Front
            </button>
            <button
              className={activeRackFace === "rear" ? "face-toggle selected" : "face-toggle"}
              onClick={() => onRackFaceChange("rear")}
              type="button"
            >
              Rear
            </button>
          </div>
        </div>
      </div>
      <div className="rack-face-banner">{`-- ${faceLabel} --`}</div>
      <div className="rack-frame">
        <div
          className={draggingDevice || previewPlacement !== null ? "rack-units drag-active" : "rack-units"}
          style={{ height: rack.totalUnits * slotHeight }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragLeave={handleDragLeave}
        >
          {Array.from({ length: rack.totalUnits }, (_, index) => {
            const unit = rack.totalUnits - index;
            return (
              <div
                className={
                  previewPlacement && unit >= previewPlacement.startUnit && unit <= previewPlacement.endUnit
                    ? "rack-slot drop-target"
                    : "rack-slot"
                }
                key={unit}
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
            const detailLine = `${device.manufacturer} ${device.model}`;
            const positionLine = `${startUnit}U - ${endUnit}U`;
            const faceLine = device.blocksBothFaces ? "Front + Rear" : device.rackFace === "rear" ? "Rear" : "Front";
            const contentClassName =
              device.heightU === 1
                ? "rack-device-content compact"
                : device.heightU === 2
                  ? "rack-device-content medium"
                  : "rack-device-content large";

            return (
              <button
                key={device.id}
                className={device.id === selectedDeviceId ? "rack-device selected" : "rack-device"}
                style={{ top, height }}
                draggable
                onDragStart={(event) => {
                  const deviceBounds = event.currentTarget.getBoundingClientRect();
                  const pointerOffsetY = clamp(event.clientY - deviceBounds.top, 0, deviceBounds.height - 1);
                  const offsetUnitsFromTop = clamp(Math.floor(pointerOffsetY / slotHeight), 0, device.heightU - 1);

                  event.dataTransfer.setData("application/x-aethercab-device", String(device.id));
                  event.dataTransfer.effectAllowed = "move";
                  setDraggingDevice({ deviceId: device.id, offsetUnitsFromTop });
                  setPreviewPlacement({ startUnit, endUnit });
                }}
                onDragEnd={() => {
                  setDraggingDevice(null);
                  setPreviewPlacement(null);
                }}
                onClick={() => onSelectDevice(device.id)}
                type="button"
                title={`${device.name} | ${detailLine} | ${positionLine}`}
              >
                <span className={contentClassName}>
                  <strong>{device.name}</strong>
                  {device.heightU === 1 ? (
                    <span>{detailLine}</span>
                  ) : (
                    <>
                      <span>{detailLine}</span>
                      <span>{`${positionLine} | ${faceLine}`}</span>
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="rack-face-banner bottom">{`-- ${faceLabel} --`}</div>
    </section>
  );
}
