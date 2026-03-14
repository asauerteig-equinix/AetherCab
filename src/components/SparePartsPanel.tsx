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
          <p className="eyebrow">Lagerung</p>
          <h2>Ersatzteile</h2>
        </div>
        <span className="muted">{devices.length} Eintraege</span>
      </div>
      <div className="spare-list">
        {devices.length === 0 ? (
          <div className="empty-state">Noch keine Ersatzteile dokumentiert.</div>
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
              <span>{device.storageLocation ?? "Lagerort noch offen"}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
