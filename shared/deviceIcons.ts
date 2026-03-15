import type { DeviceIconKey } from "./types.js";

export interface DeviceIconOption {
  key: DeviceIconKey;
  label: string;
}

export const deviceIconOptions: DeviceIconOption[] = [
  { key: "generic-device", label: "Generic Device" },
  { key: "server", label: "Server" },
  { key: "switch", label: "Switch" },
  { key: "router", label: "Router" },
  { key: "patch-panel", label: "Patch Panel" },
  { key: "pdu-vertical", label: "Vertical PDU" },
  { key: "storage", label: "Storage" },
  { key: "firewall", label: "Firewall" },
  { key: "ups", label: "UPS" },
  { key: "modem", label: "Modem" },
  { key: "access-point", label: "Access Point" },
  { key: "kvm", label: "KVM" },
  { key: "blade-chassis", label: "Blade Chassis" },
  { key: "load-balancer", label: "Load Balancer" },
  { key: "media-converter", label: "Media Converter" },
  { key: "terminal-server", label: "Terminal Server" },
  { key: "nas", label: "NAS" }
];

export const defaultIconByTemplateType: Record<string, DeviceIconKey> = {
  server: "server",
  "switch-router": "switch",
  "patch-panel": "patch-panel",
  storage: "storage",
  ups: "ups",
  pdu: "pdu-vertical",
  other: "generic-device"
};

export function getDefaultIconKeyForTemplateType(templateType: string): DeviceIconKey {
  return defaultIconByTemplateType[templateType] ?? "generic-device";
}

export function isDeviceIconKey(value: string): value is DeviceIconKey {
  return deviceIconOptions.some((option) => option.key === value);
}

export function normalizeDeviceIconKey(value: string | null | undefined, fallback: DeviceIconKey = "generic-device"): DeviceIconKey {
  if (value && isDeviceIconKey(value)) {
    return value;
  }

  return fallback;
}
