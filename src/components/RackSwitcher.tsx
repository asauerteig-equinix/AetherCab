import type { FormEvent } from "react";
import type { RackCreateInput, RackSummary } from "../../shared/types";

interface RackSwitcherProps {
  racks: RackSummary[];
  activeRackId: number | null;
  onSelectRack(rackId: number): void;
  createForm: RackCreateInput;
  onCreateFormChange(next: RackCreateInput): void;
  onCreateRack(event: FormEvent<HTMLFormElement>): void;
}

export function RackSwitcher({
  racks,
  activeRackId,
  onSelectRack,
  createForm,
  onCreateFormChange,
  onCreateRack
}: RackSwitcherProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Inventory scope</p>
          <h2>Racks</h2>
        </div>
        <span className="muted">{racks.length} stored</span>
      </div>

      <div className="rack-switcher-list">
        {racks.map((rack) => (
          <button
            className={rack.id === activeRackId ? "rack-list-item selected" : "rack-list-item"}
            key={rack.id}
            onClick={() => onSelectRack(rack.id)}
            type="button"
          >
            <strong>{rack.name}</strong>
            <span>
              {rack.siteName} / {rack.roomName}
            </span>
            <span>{rack.totalUnits}U</span>
          </button>
        ))}
      </div>

      <form className="create-rack-form" onSubmit={onCreateRack}>
        <h3>New rack</h3>
        <label>
          Site
          <input
            value={createForm.siteName}
            onChange={(event) => onCreateFormChange({ ...createForm, siteName: event.target.value })}
          />
        </label>
        <label>
          Room
          <input
            value={createForm.roomName}
            onChange={(event) => onCreateFormChange({ ...createForm, roomName: event.target.value })}
          />
        </label>
        <label>
          Rack name
          <input
            value={createForm.rackName}
            onChange={(event) => onCreateFormChange({ ...createForm, rackName: event.target.value })}
          />
        </label>
        <label>
          Units
          <input
            min={1}
            type="number"
            value={createForm.totalUnits}
            onChange={(event) => onCreateFormChange({ ...createForm, totalUnits: Number(event.target.value) })}
          />
        </label>
        <label>
          Notes
          <input
            value={createForm.notes ?? ""}
            onChange={(event) => onCreateFormChange({ ...createForm, notes: event.target.value })}
          />
        </label>
        <button type="submit">Create rack</button>
      </form>
    </section>
  );
}
