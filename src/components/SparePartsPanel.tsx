import type { RackDevice } from "../../shared/types";

interface SparePartsPanelProps {
  devices: RackDevice[];
  selectedDeviceId: number | null;
  onSelectDevice(deviceId: number): void;
}

export function SparePartsPanel({ devices, selectedDeviceId, onSelectDevice }: SparePartsPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Storage</p>
          <h2>Spare parts</h2>
        </div>
        <span className="muted">{devices.length} items</span>
      </div>
      <div className="spare-list">
        {devices.length === 0 ? (
          <div className="empty-state">No spare parts documented yet.</div>
        ) : (
          devices.map((device) => (
            <button
              key={device.id}
              className={device.id === selectedDeviceId ? "spare-card selected" : "spare-card"}
              onClick={() => onSelectDevice(device.id)}
              type="button"
            >
              <strong>{device.name}</strong>
              <span>
                {device.manufacturer} {device.model}
              </span>
              <span>{device.storageLocation ?? "Storage location pending"}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
