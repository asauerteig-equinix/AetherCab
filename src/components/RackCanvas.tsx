import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import {
  getAnchoredStartUnit,
  getEndUnit,
  getRackMountPositionLabel,
  getRackMountPositionShortLabel,
  getVerticalPduMountPositionsForFace,
  isVerticalPduMountPosition
} from "../../shared/rack";
import type { DeviceTemplate, RackDetail, RackDevice, RackFace, RackMountPosition } from "../../shared/types";

interface RackCanvasProps {
  rack: RackDetail;
  activeRackFace: RackFace;
  selectedDeviceId: number | null;
  onSelectDevice(deviceId: number): void;
  onRackFaceChange(nextFace: RackFace): void;
  onTemplateDrop(unit: number, mountPosition: RackMountPosition, templatePayload: string): void;
  onDeviceMove(device: RackDevice, nextStartUnit: number, nextMountPosition: RackMountPosition): void;
}

interface PreviewPlacement {
  startUnit: number;
  endUnit: number;
  mountPosition: RackMountPosition;
}

const slotHeight = 28;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function getRackLayout(width: number, reservePduColumns: boolean) {
  const labelWidth = clamp(width * 0.16, 56, 82);
  const sidePadding = clamp(width * 0.026, 10, 16);
  const pduLaneWidth = clamp(width * 0.06, 22, 30);
  const laneGap = clamp(width * 0.014, 4, 8);
  const centerGap = clamp(width * 0.026, 10, 18);
  const fullLeft = reservePduColumns ? labelWidth + sidePadding + pduLaneWidth * 2 + laneGap + centerGap : labelWidth + sidePadding;
  const fullRight = reservePduColumns ? sidePadding + pduLaneWidth * 2 + laneGap + centerGap : sidePadding;

  return {
    labelWidth,
    sidePadding,
    pduLaneWidth,
    laneGap,
    fullLeft,
    fullRight
  };
}

function getMountStyle(
  layout: ReturnType<typeof getRackLayout>,
  mountPosition: RackMountPosition,
  reservePduColumns: boolean
): CSSProperties {
  if (mountPosition === "full") {
    return {
      left: reservePduColumns ? layout.fullLeft : layout.labelWidth + layout.sidePadding,
      right: reservePduColumns ? layout.fullRight : layout.sidePadding
    };
  }

  if (mountPosition.endsWith("left-outer")) {
    return {
      left: layout.labelWidth + layout.sidePadding,
      width: layout.pduLaneWidth
    };
  }

  if (mountPosition.endsWith("left-inner")) {
    return {
      left: layout.labelWidth + layout.sidePadding + layout.pduLaneWidth + layout.laneGap,
      width: layout.pduLaneWidth
    };
  }

  if (mountPosition.endsWith("right-inner")) {
    return {
      right: layout.sidePadding + layout.pduLaneWidth + layout.laneGap,
      width: layout.pduLaneWidth
    };
  }

  return {
    right: layout.sidePadding,
    width: layout.pduLaneWidth
  };
}

function getMountHitbox(
  rackWidth: number,
  layout: ReturnType<typeof getRackLayout>,
  mountPosition: RackMountPosition,
  reservePduColumns: boolean
): { startX: number; endX: number } {
  const style = getMountStyle(layout, mountPosition, reservePduColumns);

  if (mountPosition === "full") {
    const left = Number(style.left ?? 0);
    const right = Number(style.right ?? 0);
    return { startX: left, endX: rackWidth - right };
  }

  const width = Number(style.width ?? layout.pduLaneWidth);
  if (style.left !== undefined) {
    return { startX: Number(style.left), endX: Number(style.left) + width };
  }

  const right = Number(style.right ?? 0);
  return { startX: rackWidth - right - width, endX: rackWidth - right };
}

function getPduLaneFromPointer(
  event: DragEvent<HTMLDivElement>,
  rackWidth: number,
  activeRackFace: RackFace
): RackMountPosition {
  const layout = getRackLayout(rackWidth, true);
  const rackBounds = event.currentTarget.getBoundingClientRect();
  const relativeX = clamp(event.clientX - rackBounds.left, 0, rackBounds.width - 1);
  const fullHitbox = getMountHitbox(rackBounds.width, layout, "full", true);

  if (relativeX >= fullHitbox.startX && relativeX <= fullHitbox.endX) {
    return "full";
  }

  return getVerticalPduMountPositionsForFace(activeRackFace).reduce<{
    mountPosition: RackMountPosition;
    distance: number;
  }>(
    (closest, mountPosition) => {
      const hitbox = getMountHitbox(rackBounds.width, layout, mountPosition, true);
      const center = (hitbox.startX + hitbox.endX) / 2;
      const distance = Math.abs(center - relativeX);

      if (distance < closest.distance) {
        return { mountPosition, distance };
      }

      return closest;
    },
    { mountPosition: getVerticalPduMountPositionsForFace(activeRackFace)[0], distance: Number.POSITIVE_INFINITY }
  ).mountPosition;
}

function getDeviceStyle(
  rack: RackDetail,
  device: Pick<RackDevice, "startUnit" | "heightU" | "mountPosition">,
  rackWidth: number,
  reservePduColumns: boolean
): CSSProperties {
  const startUnit = device.startUnit ?? 1;
  const bottom = (startUnit - 1) * slotHeight;
  const height = device.heightU * slotHeight - 4;
  const top = rack.totalUnits * slotHeight - bottom - height - 2;

  return {
    top,
    height,
    ...getMountStyle(getRackLayout(rackWidth, reservePduColumns), device.mountPosition, reservePduColumns)
  };
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
  const rackUnitsRef = useRef<HTMLDivElement | null>(null);
  const [rackWidth, setRackWidth] = useState(480);
  const [previewPlacement, setPreviewPlacement] = useState<PreviewPlacement | null>(null);
  const [draggingDevice, setDraggingDevice] = useState<{ deviceId: number; offsetUnitsFromTop: number } | null>(null);
  const [pduGuideVisible, setPduGuideVisible] = useState(false);
  const [pduGuideMountPosition, setPduGuideMountPosition] = useState<RackMountPosition | null>(null);
  const faceLabel = activeRackFace === "front" ? "Front" : "Rear";
  const placedDevices = rack.devices.filter(
    (device) =>
      device.placementType === "rack" &&
      device.startUnit !== null &&
      (device.blocksBothFaces || device.rackFace === activeRackFace)
  );
  const facePduLanePositions = getVerticalPduMountPositionsForFace(activeRackFace);
  const reservePduColumns = pduGuideVisible || placedDevices.some((device) => isVerticalPduMountPosition(device.mountPosition));

  useEffect(() => {
    const rackUnits = rackUnitsRef.current;
    if (!rackUnits) {
      return;
    }

    setRackWidth(rackUnits.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width;
      if (nextWidth) {
        setRackWidth(nextWidth);
      }
    });

    observer.observe(rackUnits);
    return () => observer.disconnect();
  }, []);

  function resetDragGuides() {
    setPreviewPlacement(null);
    setPduGuideVisible(false);
    setPduGuideMountPosition(null);
  }

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
      const isPdu = template.mountStyle === "vertical-pdu";
      const mountPosition = isPdu ? getPduLaneFromPointer(event, rackWidth, activeRackFace) : "full";

      setPduGuideVisible(isPdu);
      setPduGuideMountPosition(isPdu && mountPosition !== "full" ? mountPosition : null);

      if (isPdu && mountPosition === "full") {
        setPreviewPlacement(null);
        return;
      }

      const startUnit = getAnchoredStartUnit(
        hoveredUnit,
        template.defaultHeightU,
        rack.totalUnits,
        isPdu ? activeRackFace : activeRackFace,
        mountPosition,
        isPdu ? false : template.blocksBothFaces,
        rack.devices
      );

      setPreviewPlacement(startUnit === null ? null : { startUnit, endUnit: getEndUnit(startUnit, template.defaultHeightU), mountPosition });
      return;
    }

    if (devicePayload) {
      const device = placedDevices.find((entry) => String(entry.id) === devicePayload);
      if (!device) {
        resetDragGuides();
        return;
      }

      const isPdu = isVerticalPduMountPosition(device.mountPosition);
      const offsetUnitsFromTop = draggingDevice?.deviceId === device.id ? draggingDevice.offsetUnitsFromTop : device.heightU - 1;
      const startUnit = clamp(hoveredUnit - (device.heightU - 1 - offsetUnitsFromTop), 1, rack.totalUnits - device.heightU + 1);
      const hoveredMountPosition = isPdu ? getPduLaneFromPointer(event, rackWidth, activeRackFace) : "full";
      const mountPosition = isPdu && hoveredMountPosition === "full" ? device.mountPosition : hoveredMountPosition;

      setPduGuideVisible(isPdu);
      setPduGuideMountPosition(isPdu ? mountPosition : null);
      setPreviewPlacement({ startUnit, endUnit: getEndUnit(startUnit, device.heightU), mountPosition });
      return;
    }

    resetDragGuides();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const hoveredUnit = getUnitFromPointer(event);
    const templatePayload = event.dataTransfer.getData("application/x-aethercab-template");
    const devicePayload = event.dataTransfer.getData("application/x-aethercab-device");

    if (templatePayload) {
      const template = JSON.parse(templatePayload) as DeviceTemplate;
      const mountPosition = template.mountStyle === "vertical-pdu" ? getPduLaneFromPointer(event, rackWidth, activeRackFace) : "full";
      resetDragGuides();
      onTemplateDrop(hoveredUnit, mountPosition, templatePayload);
      return;
    }

    if (devicePayload) {
      const device = placedDevices.find((entry) => String(entry.id) === devicePayload);
      if (device) {
        const offsetUnitsFromTop = draggingDevice?.deviceId === device.id ? draggingDevice.offsetUnitsFromTop : device.heightU - 1;
        const nextStartUnit = clamp(hoveredUnit - (device.heightU - 1 - offsetUnitsFromTop), 1, rack.totalUnits - device.heightU + 1);
        const hoveredMountPosition = isVerticalPduMountPosition(device.mountPosition)
          ? getPduLaneFromPointer(event, rackWidth, activeRackFace)
          : "full";
        const nextMountPosition =
          isVerticalPduMountPosition(device.mountPosition) && hoveredMountPosition === "full"
            ? device.mountPosition
            : hoveredMountPosition;
        resetDragGuides();
        onDeviceMove(device, nextStartUnit, nextMountPosition);
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
      resetDragGuides();
    }
  }

  const layout = getRackLayout(rackWidth, reservePduColumns);

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
          ref={rackUnitsRef}
          className={draggingDevice || previewPlacement !== null ? "rack-units drag-active" : "rack-units"}
          style={{ height: rack.totalUnits * slotHeight }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragLeave={handleDragLeave}
        >
          {pduGuideVisible ? (
            <>
              <div className="rack-pdu-guide-banner">
                <strong>Vertical PDU</strong>
                <span>{`Drop on one of the highlighted ${faceLabel.toLowerCase()} side lanes.`}</span>
              </div>
              {facePduLanePositions.map((mountPosition) => (
                <div
                  key={mountPosition}
                  className={pduGuideMountPosition === mountPosition ? "rack-pdu-lane active" : "rack-pdu-lane"}
                  style={{ ...getMountStyle(layout, mountPosition, true), height: rack.totalUnits * slotHeight - 2 }}
                >
                  <span>{getRackMountPositionShortLabel(mountPosition)}</span>
                </div>
              ))}
            </>
          ) : null}

          {Array.from({ length: rack.totalUnits }, (_, index) => {
            const unit = rack.totalUnits - index;
            const isPreviewUnit =
              previewPlacement !== null &&
              previewPlacement.mountPosition === "full" &&
              unit >= previewPlacement.startUnit &&
              unit <= previewPlacement.endUnit;
            return (
              <div className={isPreviewUnit ? "rack-slot drop-target" : "rack-slot"} key={unit}>
                <span className="slot-label">{unit}U</span>
              </div>
            );
          })}

          {previewPlacement ? (
            <div
              className={previewPlacement.mountPosition === "full" ? "rack-preview" : "rack-preview pdu"}
              style={getDeviceStyle(rack, previewPlacement, rackWidth, reservePduColumns)}
            />
          ) : null}

          {placedDevices.map((device) => {
            const startUnit = device.startUnit!;
            const endUnit = getEndUnit(startUnit, device.heightU);
            const detailLine = `${device.manufacturer} ${device.model}`;
            const positionLine = `${startUnit}U - ${endUnit}U`;
            const faceLine =
              device.mountPosition === "full"
                ? device.blocksBothFaces
                  ? "Front + Rear"
                  : device.rackFace === "rear"
                    ? "Rear"
                    : "Front"
                : getRackMountPositionLabel(device.mountPosition);
            const contentClassName = isVerticalPduMountPosition(device.mountPosition)
              ? "rack-device-content pdu"
              : device.heightU === 1
                ? "rack-device-content compact"
                : device.heightU === 2
                  ? "rack-device-content medium"
                  : "rack-device-content large";

            return (
              <button
                key={device.id}
                className={device.id === selectedDeviceId ? "rack-device selected" : "rack-device"}
                style={getDeviceStyle(rack, device, rackWidth, reservePduColumns)}
                draggable
                onDragStart={(event) => {
                  const deviceBounds = event.currentTarget.getBoundingClientRect();
                  const pointerOffsetY = clamp(event.clientY - deviceBounds.top, 0, deviceBounds.height - 1);
                  const offsetUnitsFromTop = clamp(Math.floor(pointerOffsetY / slotHeight), 0, device.heightU - 1);
                  const isPdu = isVerticalPduMountPosition(device.mountPosition);

                  event.dataTransfer.setData("application/x-aethercab-device", String(device.id));
                  event.dataTransfer.effectAllowed = "move";
                  setDraggingDevice({ deviceId: device.id, offsetUnitsFromTop });
                  setPduGuideVisible(isPdu);
                  setPduGuideMountPosition(isPdu ? device.mountPosition : null);
                  setPreviewPlacement({ startUnit, endUnit, mountPosition: device.mountPosition });
                }}
                onDragEnd={() => {
                  setDraggingDevice(null);
                  resetDragGuides();
                }}
                onClick={() => onSelectDevice(device.id)}
                type="button"
                title={`${device.name} | ${detailLine} | ${positionLine} | ${faceLine}`}
              >
                <span className={contentClassName}>
                  <strong>{device.name}</strong>
                  {isVerticalPduMountPosition(device.mountPosition) ? (
                    <>
                      <span>{detailLine}</span>
                      <span>{positionLine}</span>
                    </>
                  ) : device.heightU === 1 ? (
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
