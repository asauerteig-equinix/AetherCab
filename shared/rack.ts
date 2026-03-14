import type { RackDevice, RackDeviceInput } from "./types.js";

export function getEndUnit(startUnit: number, heightU: number): number {
  return startUnit + heightU - 1;
}

export function validateRackPlacement(
  device: Pick<RackDeviceInput, "placementType" | "startUnit" | "heightU">,
  rackUnits: number
): string[] {
  const issues: string[] = [];

  if (device.heightU < 1) {
    issues.push("Device height must be at least 1U.");
  }

  if (device.placementType === "spare") {
    return issues;
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
  first: Pick<RackDeviceInput, "startUnit" | "heightU">,
  second: Pick<RackDeviceInput, "startUnit" | "heightU">
): boolean {
  if (first.startUnit === null || second.startUnit === null) {
    return false;
  }

  const firstEnd = getEndUnit(first.startUnit, first.heightU);
  const secondEnd = getEndUnit(second.startUnit, second.heightU);

  return first.startUnit <= secondEnd && second.startUnit <= firstEnd;
}

export function findOverlaps(
  device: Pick<RackDeviceInput, "placementType" | "startUnit" | "heightU">,
  existingDevices: RackDevice[],
  currentDeviceId?: number
): RackDevice[] {
  if (device.placementType !== "rack" || device.startUnit === null) {
    return [];
  }

  return existingDevices.filter((existing) => {
    if (existing.placementType !== "rack" || existing.startUnit === null) {
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
