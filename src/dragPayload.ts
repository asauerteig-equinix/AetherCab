import type { DeviceTemplate } from "../shared/types";

export const TEMPLATE_DRAG_MIME = "application/x-aethercad-template";
export const DEVICE_DRAG_MIME = "application/x-aethercad-device";

const TEMPLATE_FALLBACK_PREFIX = "aethercad-template:";
const DEVICE_FALLBACK_PREFIX = "aethercad-device:";

type DragPayload =
  | {
      kind: "template";
      template: DeviceTemplate;
    }
  | {
      kind: "device";
      deviceId: number;
    };

let currentDragPayload: DragPayload | null = null;

function safeGetData(dataTransfer: DataTransfer, mimeType: string): string {
  try {
    return dataTransfer.getData(mimeType);
  } catch {
    return "";
  }
}

export function setCurrentTemplateDrag(template: DeviceTemplate) {
  currentDragPayload = { kind: "template", template };
}

export function setCurrentDeviceDrag(deviceId: number) {
  currentDragPayload = { kind: "device", deviceId };
}

export function clearCurrentDragPayload() {
  currentDragPayload = null;
}

export function getCurrentDragPayload() {
  return currentDragPayload;
}

function parseTemplatePayload(payload: string): DeviceTemplate | null {
  try {
    return JSON.parse(payload) as DeviceTemplate;
  } catch {
    return null;
  }
}

function parseDeviceId(payload: string): number | null {
  const parsed = Number(payload);
  return Number.isNaN(parsed) ? null : parsed;
}

export function writeTemplateDragData(dataTransfer: DataTransfer, template: DeviceTemplate) {
  const payload = JSON.stringify(template);
  dataTransfer.setData(TEMPLATE_DRAG_MIME, payload);
  dataTransfer.setData("text/plain", `${TEMPLATE_FALLBACK_PREFIX}${payload}`);
}

export function writeDeviceDragData(dataTransfer: DataTransfer, deviceId: number) {
  const payload = String(deviceId);
  dataTransfer.setData(DEVICE_DRAG_MIME, payload);
  dataTransfer.setData("text/plain", `${DEVICE_FALLBACK_PREFIX}${payload}`);
}

export function getDraggedTemplate(dataTransfer: DataTransfer): DeviceTemplate | null {
  const payload = safeGetData(dataTransfer, TEMPLATE_DRAG_MIME);
  if (payload) {
    return parseTemplatePayload(payload);
  }

  const fallbackPayload = safeGetData(dataTransfer, "text/plain");
  if (fallbackPayload.startsWith(TEMPLATE_FALLBACK_PREFIX)) {
    return parseTemplatePayload(fallbackPayload.slice(TEMPLATE_FALLBACK_PREFIX.length));
  }

  return currentDragPayload?.kind === "template" ? currentDragPayload.template : null;
}

export function getDraggedDeviceId(dataTransfer: DataTransfer): number | null {
  const payload = safeGetData(dataTransfer, DEVICE_DRAG_MIME);
  if (payload) {
    return parseDeviceId(payload);
  }

  const fallbackPayload = safeGetData(dataTransfer, "text/plain");
  if (fallbackPayload.startsWith(DEVICE_FALLBACK_PREFIX)) {
    return parseDeviceId(fallbackPayload.slice(DEVICE_FALLBACK_PREFIX.length));
  }

  return currentDragPayload?.kind === "device" ? currentDragPayload.deviceId : null;
}
