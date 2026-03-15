import type { RackDevice, RackDeviceInput, RackFace, RackMountPosition } from "./types.js";

export const verticalPduMountPositions: RackMountPosition[] = [
  "rear-left-outer",
  "rear-left-inner",
  "rear-right-inner",
  "rear-right-outer"
];

const mountPositionSortOrder: Record<RackMountPosition, number> = {
  full: 0,
  "rear-left-outer": 1,
  "rear-left-inner": 2,
  "rear-right-inner": 3,
  "rear-right-outer": 4
};

export function isVerticalPduMountPosition(mountPosition: RackMountPosition): boolean {
  return mountPosition !== "full";
}

export function getRackMountPositionLabel(mountPosition: RackMountPosition): string {
  switch (mountPosition) {
    case "rear-left-outer":
      return "Rear left outer PDU lane";
    case "rear-left-inner":
      return "Rear left inner PDU lane";
    case "rear-right-inner":
      return "Rear right inner PDU lane";
    case "rear-right-outer":
      return "Rear right outer PDU lane";
    default:
      return "Standard rack width";
  }
}

export function getEndUnit(startUnit: number, heightU: number): number {
  return startUnit + heightU - 1;
}

export function validateRackPlacement(
  device: Pick<RackDeviceInput, "placementType" | "rackFace" | "mountPosition" | "blocksBothFaces" | "startUnit" | "heightU">,
  rackUnits: number
): string[] {
  const issues: string[] = [];

  if (device.heightU < 1) {
    issues.push("Device height must be at least 1U.");
  }

  if (device.placementType === "spare") {
    return issues;
  }

  if (device.rackFace === null) {
    issues.push("Rack devices require a rack face.");
  }

  if (isVerticalPduMountPosition(device.mountPosition)) {
    if (device.rackFace !== "rear") {
      issues.push("Vertical PDUs can only be placed on the rear face.");
    }

    if (device.blocksBothFaces) {
      issues.push("Vertical PDUs cannot block both rack faces.");
    }
  }

  if (device.startUnit === null) {
    issues.push("Rack devices require a start unit.");
    return issues;
  }

  if (device.startUnit < 1) {
    issues.push("Devices must start at 1U or higher.");
  }

  if (getEndUnit(device.startUnit, device.heightU) > rackUnits) {
    issues.push("Device placement exceeds rack height.");
  }

  return issues;
}

export function devicesOverlap(
  first: Pick<RackDeviceInput, "rackFace" | "mountPosition" | "blocksBothFaces" | "startUnit" | "heightU">,
  second: Pick<RackDeviceInput, "rackFace" | "mountPosition" | "blocksBothFaces" | "startUnit" | "heightU">
): boolean {
  if (first.startUnit === null || second.startUnit === null || first.rackFace === null || second.rackFace === null) {
    return false;
  }

  const firstVerticalPdu = isVerticalPduMountPosition(first.mountPosition);
  const secondVerticalPdu = isVerticalPduMountPosition(second.mountPosition);

  if (firstVerticalPdu || secondVerticalPdu) {
    if (!firstVerticalPdu || !secondVerticalPdu || first.mountPosition !== second.mountPosition) {
      return false;
    }
  } else {
    const facesConflict = first.blocksBothFaces || second.blocksBothFaces || first.rackFace === second.rackFace;
    if (!facesConflict) {
      return false;
    }
  }

  const firstEnd = getEndUnit(first.startUnit, first.heightU);
  const secondEnd = getEndUnit(second.startUnit, second.heightU);

  return first.startUnit <= secondEnd && second.startUnit <= firstEnd;
}

export function findOverlaps(
  device: Pick<RackDeviceInput, "placementType" | "rackFace" | "mountPosition" | "blocksBothFaces" | "startUnit" | "heightU">,
  existingDevices: RackDevice[],
  currentDeviceId?: number
): RackDevice[] {
  if (device.placementType !== "rack" || device.startUnit === null || device.rackFace === null) {
    return [];
  }

  return existingDevices.filter((existing) => {
    if (existing.placementType !== "rack" || existing.startUnit === null || existing.rackFace === null) {
      return false;
    }

    if (currentDeviceId !== undefined && existing.id === currentDeviceId) {
      return false;
    }

    return devicesOverlap(device, existing);
  });
}

export function sortRackDevices(devices: RackDevice[]): RackDevice[] {
  return [...devices].sort((left, right) => {
    if (left.placementType !== right.placementType) {
      return left.placementType === "rack" ? -1 : 1;
    }

    if (left.placementType === "spare") {
      return left.name.localeCompare(right.name);
    }

    const startUnitDelta = (right.startUnit ?? 0) - (left.startUnit ?? 0);
    if (startUnitDelta !== 0) {
      return startUnitDelta;
    }

    const mountPositionDelta = mountPositionSortOrder[left.mountPosition] - mountPositionSortOrder[right.mountPosition];
    if (mountPositionDelta !== 0) {
      return mountPositionDelta;
    }

    return left.name.localeCompare(right.name);
  });
}

function isUnitOccupiedOnFace(
  unit: number,
  rackFace: RackFace,
  mountPosition: RackMountPosition,
  blocksBothFaces: boolean,
  devices: RackDevice[],
  currentDeviceId?: number
): boolean {
  return devices.some((device) => {
    if (device.id === currentDeviceId || device.placementType !== "rack" || device.startUnit === null || device.rackFace === null) {
      return false;
    }

    const endUnit = getEndUnit(device.startUnit, device.heightU);
    const coversUnit = unit >= device.startUnit && unit <= endUnit;
    if (!coversUnit) {
      return false;
    }

    const targetVerticalPdu = isVerticalPduMountPosition(mountPosition);
    const existingVerticalPdu = isVerticalPduMountPosition(device.mountPosition);

    if (targetVerticalPdu || existingVerticalPdu) {
      return targetVerticalPdu && existingVerticalPdu && mountPosition === device.mountPosition;
    }

    return blocksBothFaces || device.blocksBothFaces || device.rackFace === rackFace;
  });
}

export function findFreeUnitSpan(
  targetUnit: number,
  rackUnits: number,
  rackFace: RackFace,
  mountPosition: RackMountPosition,
  blocksBothFaces: boolean,
  devices: RackDevice[],
  currentDeviceId?: number
): { startUnit: number; endUnit: number } | null {
  if (targetUnit < 1 || targetUnit > rackUnits) {
    return null;
  }

  if (isUnitOccupiedOnFace(targetUnit, rackFace, mountPosition, blocksBothFaces, devices, currentDeviceId)) {
    return null;
  }

  let startUnit = targetUnit;
  let endUnit = targetUnit;

  while (startUnit > 1 && !isUnitOccupiedOnFace(startUnit - 1, rackFace, mountPosition, blocksBothFaces, devices, currentDeviceId)) {
    startUnit -= 1;
  }

  while (endUnit < rackUnits && !isUnitOccupiedOnFace(endUnit + 1, rackFace, mountPosition, blocksBothFaces, devices, currentDeviceId)) {
    endUnit += 1;
  }

  return { startUnit, endUnit };
}

export function getAnchoredStartUnit(
  targetUnit: number,
  heightU: number,
  rackUnits: number,
  rackFace: RackFace,
  mountPosition: RackMountPosition,
  blocksBothFaces: boolean,
  devices: RackDevice[],
  currentDeviceId?: number
): number | null {
  const freeSpan = findFreeUnitSpan(targetUnit, rackUnits, rackFace, mountPosition, blocksBothFaces, devices, currentDeviceId);
  if (!freeSpan) {
    return null;
  }

  const spanHeight = freeSpan.endUnit - freeSpan.startUnit + 1;
  if (spanHeight < heightU) {
    return null;
  }

  const canExtendUpward = targetUnit + heightU - 1 <= freeSpan.endUnit;
  const canExtendDownward = targetUnit - heightU + 1 >= freeSpan.startUnit;

  if (canExtendUpward && !canExtendDownward) {
    return targetUnit;
  }

  if (!canExtendUpward && canExtendDownward) {
    return targetUnit - heightU + 1;
  }

  if (canExtendUpward && canExtendDownward) {
    const distanceToLowerEdge = targetUnit - freeSpan.startUnit;
    const distanceToUpperEdge = freeSpan.endUnit - targetUnit;

    return distanceToLowerEdge <= distanceToUpperEdge ? targetUnit : targetUnit - heightU + 1;
  }

  return null;
}
