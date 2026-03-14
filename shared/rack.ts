import type { RackDevice, RackDeviceInput, RackFace } from "./types.js";

export function getEndUnit(startUnit: number, heightU: number): number {
  return startUnit + heightU - 1;
}

export function validateRackPlacement(
  device: Pick<RackDeviceInput, "placementType" | "rackFace" | "startUnit" | "heightU">,
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
  first: Pick<RackDeviceInput, "rackFace" | "blocksBothFaces" | "startUnit" | "heightU">,
  second: Pick<RackDeviceInput, "rackFace" | "blocksBothFaces" | "startUnit" | "heightU">
): boolean {
  if (first.startUnit === null || second.startUnit === null || first.rackFace === null || second.rackFace === null) {
    return false;
  }

  const facesConflict = first.blocksBothFaces || second.blocksBothFaces || first.rackFace === second.rackFace;
  if (!facesConflict) {
    return false;
  }

  const firstEnd = getEndUnit(first.startUnit, first.heightU);
  const secondEnd = getEndUnit(second.startUnit, second.heightU);

  return first.startUnit <= secondEnd && second.startUnit <= firstEnd;
}

export function findOverlaps(
  device: Pick<RackDeviceInput, "placementType" | "rackFace" | "blocksBothFaces" | "startUnit" | "heightU">,
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

    return (right.startUnit ?? 0) - (left.startUnit ?? 0);
  });
}

function isUnitOccupiedOnFace(
  unit: number,
  rackFace: RackFace,
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

    return blocksBothFaces || device.blocksBothFaces || device.rackFace === rackFace;
  });
}

export function findFreeUnitSpan(
  targetUnit: number,
  rackUnits: number,
  rackFace: RackFace,
  blocksBothFaces: boolean,
  devices: RackDevice[],
  currentDeviceId?: number
): { startUnit: number; endUnit: number } | null {
  if (targetUnit < 1 || targetUnit > rackUnits) {
    return null;
  }

  if (isUnitOccupiedOnFace(targetUnit, rackFace, blocksBothFaces, devices, currentDeviceId)) {
    return null;
  }

  let startUnit = targetUnit;
  let endUnit = targetUnit;

  while (startUnit > 1 && !isUnitOccupiedOnFace(startUnit - 1, rackFace, blocksBothFaces, devices, currentDeviceId)) {
    startUnit -= 1;
  }

  while (endUnit < rackUnits && !isUnitOccupiedOnFace(endUnit + 1, rackFace, blocksBothFaces, devices, currentDeviceId)) {
    endUnit += 1;
  }

  return { startUnit, endUnit };
}

export function getAnchoredStartUnit(
  targetUnit: number,
  heightU: number,
  rackUnits: number,
  rackFace: RackFace,
  blocksBothFaces: boolean,
  devices: RackDevice[],
  currentDeviceId?: number
): number | null {
  const freeSpan = findFreeUnitSpan(targetUnit, rackUnits, rackFace, blocksBothFaces, devices, currentDeviceId);
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
