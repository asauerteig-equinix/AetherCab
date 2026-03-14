import type { FormEvent } from "react";
import type { RackCreateInput, RackSummary } from "../../shared/types";

interface RackSwitcherProps {
  racks: RackSummary[];
  activeRackId: number | null;
  searchValue: string;
  onSelectRack(rackId: number): void;
  onSearchChange(next: string): void;
  createForm: RackCreateInput;
  onCreateFormChange(next: RackCreateInput): void;
  onCreateRack(event: FormEvent<HTMLFormElement>): void;
}

export function RackSwitcher({
  racks,
  activeRackId,
  searchValue,
  onSelectRack,
  onSearchChange,
  createForm,
  onCreateFormChange,
  onCreateRack
}: RackSwitcherProps) {
  const visibleRacks = racks.filter((rack) => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return [rack.name, rack.siteName, rack.roomName].some((value) => value.toLowerCase().includes(query));
  });

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Audit hub</p>
          <h2>Audits</h2>
        </div>
        <span className="muted">{racks.length} stored</span>
      </div>

      <label className="search-field">
        Search
        <input value={searchValue} onChange={(event) => onSearchChange(event.target.value)} placeholder="Rack, site or room" />
      </label>

      <div className="rack-switcher-list">
        {visibleRacks.length === 0 ? (
          <div className="empty-state">No audits match the current search.</div>
        ) : (
          visibleRacks.map((rack) => (
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
          ))
        )}
      </div>

      <form className="create-rack-form" onSubmit={onCreateRack}>
        <h3>New audit</h3>
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
