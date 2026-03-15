import { deviceIconOptions, getDeviceIconUrl } from "../deviceIcons";
import type { DeviceIconKey } from "../../shared/types";

interface DeviceIconPickerProps {
  value: DeviceIconKey;
  onChange(next: DeviceIconKey): void;
}

export function DeviceIconPicker({ value, onChange }: DeviceIconPickerProps) {
  return (
    <div className="device-icon-picker">
      {deviceIconOptions.map((option) => (
        <button
          className={option.key === value ? "device-icon-option selected" : "device-icon-option"}
          key={option.key}
          onClick={() => onChange(option.key)}
          type="button"
        >
          <img alt="" aria-hidden="true" src={getDeviceIconUrl(option.key)} />
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
