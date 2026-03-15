import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import {
  canPlaceRackDeviceAtStartUnit,
  getAnchoredStartUnit,
  getEndUnit,
  getMountPositionFace,
  getRackCapacitySummary,
  getRackMountPositionLabel,
  getRackMountPositionShortLabel,
  getVerticalPduMountPositionsForFace,
  isVerticalPduMountPosition
} from "../../shared/rack";
import type { DeviceTemplate, RackDetail, RackDevice, RackFace, RackMountPosition } from "../../shared/types";
import { getDeviceIconUrl } from "../deviceIcons";

type RackViewMode = RackFace | "both";

interface RackCanvasProps {
  rack: RackDetail;
  activeRackView: RackViewMode;
  selectedDeviceId: number | null;
  onSelectDevice(deviceId: number): void;
  onRackFaceChange(nextFace: RackViewMode): void;
  onTemplateDrop(targetRackFace: RackFace, unit: number, mountPosition: RackMountPosition, templatePayload: string): void;
  onDeviceMove(device: RackDevice, nextStartUnit: number, nextMountPosition: RackMountPosition, targetRackFace: RackFace): void;
}

interface PreviewPlacement {
  rackFace: RackFace;
  startUnit: number;
  endUnit: number;
  mountPosition: RackMountPosition;
  isValid: boolean;
}

interface DraggingDeviceState {
  deviceId: number;
  offsetUnitsFromTop: number;
}

interface PduGuideState {
  rackFace: RackFace;
  mountPosition: RackMountPosition | null;
}

interface RackFacePaneProps {
  rack: RackDetail;
  rackFace: RackFace;
  selectedDeviceId: number | null;
  previewPlacement: PreviewPlacement | null;
  draggingDevice: DraggingDeviceState | null;
  pduGuide: PduGuideState | null;
  onSelectDevice(deviceId: number): void;
  onDragOver(rackFace: RackFace, rackWidth: number, event: DragEvent<HTMLDivElement>): void;
  onDrop(rackFace: RackFace, rackWidth: number, event: DragEvent<HTMLDivElement>): void;
  onDragLeave(event: DragEvent<HTMLDivElement>): void;
  onDeviceDragStart(
    rackFace: RackFace,
    device: RackDevice,
    startUnit: number,
    endUnit: number,
    event: DragEvent<HTMLButtonElement>
  ): void;
  onDeviceDragEnd(): void;
}

const slotHeight = 28;

function getCapacityClassName(tone: "good" | "medium" | "warning" | "critical"): string {
  return `rack-capacity-meter ${tone}`;
}

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

function getPduLaneFromPointer(event: DragEvent<HTMLDivElement>, rackWidth: number, rackFace: RackFace): RackMountPosition {
  const layout = getRackLayout(rackWidth, true);
  const rackBounds = event.currentTarget.getBoundingClientRect();
  const relativeX = clamp(event.clientX - rackBounds.left, 0, rackBounds.width - 1);
  const fullHitbox = getMountHitbox(rackBounds.width, layout, "full", true);

  if (relativeX >= fullHitbox.startX && relativeX <= fullHitbox.endX) {
    return "full";
  }

  return getVerticalPduMountPositionsForFace(rackFace).reduce<{ mountPosition: RackMountPosition; distance: number }>(
    (closest, mountPosition) => {
      const hitbox = getMountHitbox(rackBounds.width, layout, mountPosition, true);
      const center = (hitbox.startX + hitbox.endX) / 2;
      const distance = Math.abs(center - relativeX);

      if (distance < closest.distance) {
        return { mountPosition, distance };
      }

      return closest;
    },
    { mountPosition: getVerticalPduMountPositionsForFace(rackFace)[0], distance: Number.POSITIVE_INFINITY }
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

function getPreviewRange(targetUnit: number, heightU: number, rackUnits: number): { startUnit: number; endUnit: number } {
  const startUnit = clamp(targetUnit - heightU + 1, 1, rackUnits - heightU + 1);
  return {
    startUnit,
    endUnit: getEndUnit(startUnit, heightU)
  };
}

function RackFacePane({
  rack,
  rackFace,
  selectedDeviceId,
  previewPlacement,
  draggingDevice,
  pduGuide,
  onSelectDevice,
  onDragOver,
  onDrop,
  onDragLeave,
  onDeviceDragStart,
  onDeviceDragEnd
}: RackFacePaneProps) {
  const rackUnitsRef = useRef<HTMLDivElement | null>(null);
  const [rackWidth, setRackWidth] = useState(480);
  const faceLabel = rackFace === "front" ? "Front" : "Rear";
  const placedDevices = rack.devices.filter(
    (device) =>
      device.placementType === "rack" &&
      device.startUnit !== null &&
      (device.blocksBothFaces || device.rackFace === rackFace)
  );
  const panePreviewPlacement = previewPlacement?.rackFace === rackFace ? previewPlacement : null;
  const panePduGuideVisible = pduGuide?.rackFace === rackFace;
  const facePduLanePositions = getVerticalPduMountPositionsForFace(rackFace);
  const reservePduColumns =
    panePduGuideVisible || placedDevices.some((device) => isVerticalPduMountPosition(device.mountPosition));
  const layout = getRackLayout(rackWidth, reservePduColumns);

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

  return (
    <div className="rack-face-section">
      <div className="rack-face-banner">{`-- ${faceLabel} --`}</div>
      <div className="rack-frame">
        <div
          ref={rackUnitsRef}
          className={draggingDevice || panePreviewPlacement !== null ? "rack-units drag-active" : "rack-units"}
          style={{ height: rack.totalUnits * slotHeight }}
          onDragOver={(event) => onDragOver(rackFace, rackWidth, event)}
          onDrop={(event) => onDrop(rackFace, rackWidth, event)}
          onDragLeave={onDragLeave}
        >
          {panePduGuideVisible ? (
            <>
              <div className="rack-pdu-guide-banner">
                <strong>Vertical PDU</strong>
                <span>{`Drop on one of the highlighted ${faceLabel.toLowerCase()} side lanes.`}</span>
              </div>
              {facePduLanePositions.map((mountPosition) => (
                <div
                  key={mountPosition}
                  className={
                    pduGuide?.mountPosition === mountPosition
                      ? panePreviewPlacement?.isValid === false
                        ? "rack-pdu-lane active invalid"
                        : "rack-pdu-lane active"
                      : "rack-pdu-lane"
                  }
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
              panePreviewPlacement !== null &&
              panePreviewPlacement.mountPosition === "full" &&
              unit >= panePreviewPlacement.startUnit &&
              unit <= panePreviewPlacement.endUnit;
            const slotClassName = isPreviewUnit
              ? panePreviewPlacement.isValid
                ? "rack-slot drop-target valid"
                : "rack-slot drop-target invalid"
              : "rack-slot";

            return (
              <div className={slotClassName} key={unit}>
                <span className="slot-label">{unit}U</span>
              </div>
            );
          })}

          {panePreviewPlacement ? (
            <div
              className={
                panePreviewPlacement.mountPosition === "full"
                  ? panePreviewPlacement.isValid
                    ? "rack-preview valid"
                    : "rack-preview invalid"
                  : panePreviewPlacement.isValid
                    ? "rack-preview pdu valid"
                    : "rack-preview pdu invalid"
              }
              style={getDeviceStyle(rack, panePreviewPlacement, rackWidth, reservePduColumns)}
            />
          ) : null}

          {placedDevices.map((device) => {
            const startUnit = device.startUnit!;
            const endUnit = getEndUnit(startUnit, device.heightU);
            const isMirroredFromOppositeFace = device.blocksBothFaces && device.rackFace !== null && device.rackFace !== rackFace;
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
                key={`${rackFace}-${device.id}`}
                className={
                  device.id === selectedDeviceId
                    ? isMirroredFromOppositeFace
                      ? isVerticalPduMountPosition(device.mountPosition)
                        ? "rack-device selected mirrored-face pdu-device"
                        : "rack-device selected mirrored-face"
                      : isVerticalPduMountPosition(device.mountPosition)
                        ? "rack-device selected pdu-device"
                        : "rack-device selected"
                    : isMirroredFromOppositeFace
                      ? isVerticalPduMountPosition(device.mountPosition)
                        ? "rack-device mirrored-face pdu-device"
                        : "rack-device mirrored-face"
                      : isVerticalPduMountPosition(device.mountPosition)
                        ? "rack-device pdu-device"
                        : "rack-device"
                }
                data-origin-face={isMirroredFromOppositeFace ? device.rackFace : undefined}
                style={getDeviceStyle(rack, device, rackWidth, reservePduColumns)}
                draggable
                onDragStart={(event) => onDeviceDragStart(rackFace, device, startUnit, endUnit, event)}
                onDragEnd={onDeviceDragEnd}
                onClick={() => onSelectDevice(device.id)}
                type="button"
                title={`${device.name} | ${detailLine} | ${positionLine} | ${faceLine}${isMirroredFromOppositeFace ? ` | Mounted on ${device.rackFace}` : ""}`}
              >
                <span className="rack-device-shell">
                  <img alt="" aria-hidden="true" className="rack-device-icon" src={getDeviceIconUrl(device.iconKey)} />
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
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="rack-face-banner bottom">{`-- ${faceLabel} --`}</div>
    </div>
  );
}

export function RackCanvas({
  rack,
  activeRackView,
  selectedDeviceId,
  onSelectDevice,
  onRackFaceChange,
  onTemplateDrop,
  onDeviceMove
}: RackCanvasProps) {
  const [previewPlacement, setPreviewPlacement] = useState<PreviewPlacement | null>(null);
  const [draggingDevice, setDraggingDevice] = useState<DraggingDeviceState | null>(null);
  const [pduGuide, setPduGuide] = useState<PduGuideState | null>(null);
  const allDevices = rack.devices.filter((device) => device.placementType === "rack" || device.placementType === "spare");
  const capacitySummary = getRackCapacitySummary(rack.totalUnits, rack.devices);
  const visibleFaces: RackFace[] = activeRackView === "both" ? ["front", "rear"] : [activeRackView];

  function resetDragGuides() {
    setPreviewPlacement(null);
    setPduGuide(null);
  }

  function getUnitFromPointer(event: DragEvent<HTMLDivElement>): number {
    const rackBounds = event.currentTarget.getBoundingClientRect();
    const pointerY = clamp(event.clientY - rackBounds.top, 0, rackBounds.height - 1);
    const slotIndexFromTop = clamp(Math.floor(pointerY / slotHeight), 0, rack.totalUnits - 1);

    return rack.totalUnits - slotIndexFromTop;
  }

  function handleDragOver(rackFace: RackFace, rackWidth: number, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const hoveredUnit = getUnitFromPointer(event);
    const templatePayload = event.dataTransfer.getData("application/x-aethercab-template");
    const devicePayload = event.dataTransfer.getData("application/x-aethercab-device");

    event.dataTransfer.dropEffect = devicePayload || draggingDevice ? "move" : "copy";

    if (templatePayload) {
      const template = JSON.parse(templatePayload) as DeviceTemplate;
      const isPdu = template.mountStyle === "vertical-pdu";
      const mountPosition = isPdu ? getPduLaneFromPointer(event, rackWidth, rackFace) : "full";
      const previewRange = getPreviewRange(hoveredUnit, template.defaultHeightU, rack.totalUnits);

      if (isPdu) {
        setPduGuide({ rackFace, mountPosition: mountPosition === "full" ? null : mountPosition });
      } else {
        setPduGuide(null);
      }

      if (isPdu && mountPosition === "full") {
        setPreviewPlacement({
          rackFace,
          startUnit: previewRange.startUnit,
          endUnit: previewRange.endUnit,
          mountPosition,
          isValid: false
        });
        return;
      }

      const startUnit = getAnchoredStartUnit(
        hoveredUnit,
        template.defaultHeightU,
        rack.totalUnits,
        rackFace,
        mountPosition,
        isPdu ? false : template.blocksBothFaces,
        rack.devices
      );
      const previewStartUnit = startUnit ?? previewRange.startUnit;
      const previewRackFace = getMountPositionFace(mountPosition) ?? rackFace;
      const isValid =
        startUnit !== null &&
        canPlaceRackDeviceAtStartUnit(
          {
            placementType: "rack",
            rackFace: previewRackFace,
            mountPosition,
            blocksBothFaces: isPdu ? false : template.blocksBothFaces,
            heightU: template.defaultHeightU
          },
          previewStartUnit,
          rack.totalUnits,
          rack.devices
        );

      setPreviewPlacement({
        rackFace: previewRackFace,
        startUnit: previewStartUnit,
        endUnit: getEndUnit(previewStartUnit, template.defaultHeightU),
        mountPosition,
        isValid
      });
      return;
    }

    if (devicePayload) {
      const device = allDevices.find((entry) => String(entry.id) === devicePayload);
      if (!device) {
        resetDragGuides();
        return;
      }

      const isPdu = isVerticalPduMountPosition(device.mountPosition);
      const offsetUnitsFromTop = draggingDevice?.deviceId === device.id ? draggingDevice.offsetUnitsFromTop : device.heightU - 1;
      const startUnit = clamp(hoveredUnit - (device.heightU - 1 - offsetUnitsFromTop), 1, rack.totalUnits - device.heightU + 1);
      const hoveredMountPosition = isPdu ? getPduLaneFromPointer(event, rackWidth, rackFace) : "full";

      if (isPdu) {
        setPduGuide({ rackFace, mountPosition: hoveredMountPosition === "full" ? null : hoveredMountPosition });
      } else {
        setPduGuide(null);
      }

      if (isPdu && hoveredMountPosition === "full") {
        setPreviewPlacement({
          rackFace,
          startUnit,
          endUnit: getEndUnit(startUnit, device.heightU),
          mountPosition: "full",
          isValid: false
        });
        return;
      }

      const previewRackFace = getMountPositionFace(hoveredMountPosition) ?? rackFace;
      const isValid = canPlaceRackDeviceAtStartUnit(
        {
          placementType: "rack",
          rackFace: previewRackFace,
          mountPosition: hoveredMountPosition,
          blocksBothFaces: isPdu ? false : device.blocksBothFaces,
          heightU: device.heightU
        },
        startUnit,
        rack.totalUnits,
        rack.devices,
        device.id
      );

      setPreviewPlacement({
        rackFace: previewRackFace,
        startUnit,
        endUnit: getEndUnit(startUnit, device.heightU),
        mountPosition: hoveredMountPosition,
        isValid
      });
      return;
    }

    resetDragGuides();
  }

  function handleDrop(rackFace: RackFace, rackWidth: number, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const hoveredUnit = getUnitFromPointer(event);
    const templatePayload = event.dataTransfer.getData("application/x-aethercab-template");
    const devicePayload = event.dataTransfer.getData("application/x-aethercab-device");

    if (templatePayload) {
      const template = JSON.parse(templatePayload) as DeviceTemplate;
      const mountPosition = template.mountStyle === "vertical-pdu" ? getPduLaneFromPointer(event, rackWidth, rackFace) : "full";
      resetDragGuides();
      onTemplateDrop(rackFace, hoveredUnit, mountPosition, templatePayload);
      return;
    }

    if (devicePayload) {
      const device = allDevices.find((entry) => String(entry.id) === devicePayload);
      if (device) {
        const offsetUnitsFromTop = draggingDevice?.deviceId === device.id ? draggingDevice.offsetUnitsFromTop : device.heightU - 1;
        const nextStartUnit = clamp(hoveredUnit - (device.heightU - 1 - offsetUnitsFromTop), 1, rack.totalUnits - device.heightU + 1);
        const hoveredMountPosition = isVerticalPduMountPosition(device.mountPosition)
          ? getPduLaneFromPointer(event, rackWidth, rackFace)
          : "full";

        if (isVerticalPduMountPosition(device.mountPosition) && hoveredMountPosition === "full") {
          resetDragGuides();
          setDraggingDevice(null);
          return;
        }

        resetDragGuides();
        onDeviceMove(device, nextStartUnit, hoveredMountPosition, rackFace);
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

  function handleDeviceDragStart(
    rackFace: RackFace,
    device: RackDevice,
    startUnit: number,
    endUnit: number,
    event: DragEvent<HTMLButtonElement>
  ) {
    const deviceBounds = event.currentTarget.getBoundingClientRect();
    const pointerOffsetY = clamp(event.clientY - deviceBounds.top, 0, deviceBounds.height - 1);
    const offsetUnitsFromTop = clamp(Math.floor(pointerOffsetY / slotHeight), 0, device.heightU - 1);
    const isPdu = isVerticalPduMountPosition(device.mountPosition);
    const previewRackFace = getMountPositionFace(device.mountPosition) ?? device.rackFace ?? rackFace;

    event.dataTransfer.setData("application/x-aethercab-device", String(device.id));
    event.dataTransfer.effectAllowed = "move";
    setDraggingDevice({ deviceId: device.id, offsetUnitsFromTop });
    setPduGuide(isPdu ? { rackFace: previewRackFace, mountPosition: device.mountPosition } : null);
    setPreviewPlacement({
      rackFace: previewRackFace,
      startUnit,
      endUnit,
      mountPosition: device.mountPosition,
      isValid: true
    });
  }

  function handleDeviceDragEnd() {
    setDraggingDevice(null);
    resetDragGuides();
  }

  return (
    <section className="panel rack-panel">
      <div className="panel-header">
        <div className="rack-panel-heading">
          <p className="eyebrow">Rack Editor</p>
          <div className="rack-title-row">
            <h2>Rack View</h2>
            <div className="rack-capacity-summary" aria-label="Rack occupancy by side">
              {[capacitySummary.front, capacitySummary.rear].map((stats) => (
                <div className="rack-capacity-card" key={stats.face}>
                  <div className="rack-capacity-copy">
                    <span>{stats.face === "front" ? "Front occupied" : "Rear occupied"}</span>
                    <strong>{`${stats.usedPercent}%`}</strong>
                  </div>
                  <div className={getCapacityClassName(stats.tone)}>
                    <span style={{ width: `${stats.usedPercent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="rack-toolbar">
          <span className="toolbar-label">View</span>
          <div className="rack-face-toggle">
            <button
              className={activeRackView === "front" ? "face-toggle selected" : "face-toggle"}
              onClick={() => onRackFaceChange("front")}
              type="button"
            >
              Front
            </button>
            <button
              className={activeRackView === "rear" ? "face-toggle selected" : "face-toggle"}
              onClick={() => onRackFaceChange("rear")}
              type="button"
            >
              Rear
            </button>
            <button
              className={activeRackView === "both" ? "face-toggle selected" : "face-toggle"}
              onClick={() => onRackFaceChange("both")}
              type="button"
            >
              Both
            </button>
          </div>
        </div>
      </div>

      <div className={activeRackView === "both" ? "rack-face-grid both" : "rack-face-grid"}>
        {visibleFaces.map((rackFace) => (
          <RackFacePane
            key={rackFace}
            rack={rack}
            rackFace={rackFace}
            selectedDeviceId={selectedDeviceId}
            previewPlacement={previewPlacement}
            draggingDevice={draggingDevice}
            pduGuide={pduGuide}
            onSelectDevice={onSelectDevice}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragLeave={handleDragLeave}
            onDeviceDragStart={handleDeviceDragStart}
            onDeviceDragEnd={handleDeviceDragEnd}
          />
        ))}
      </div>
    </section>
  );
}
