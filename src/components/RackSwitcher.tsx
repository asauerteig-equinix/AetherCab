import type { RackDetail, RackUpdateInput } from "../../shared/types";

interface RackSwitcherProps {
  rack: RackDetail | null;
  form: RackUpdateInput;
  saving: boolean;
  onFormChange(next: RackUpdateInput): void;
  onSave(): void;
  onBackToOverview(): void;
}

export function RackSwitcher({ rack, form, saving, onFormChange, onSave, onBackToOverview }: RackSwitcherProps) {
  return (
    <section className="audit-summary">
      <div className="audit-summary-header">
        <div>
          <p className="eyebrow">Active Audit</p>
          <h2>{rack ? form.rackName || rack.name : "No audit open"}</h2>
        </div>
        <div className="audit-summary-actions">
          <button className="primary-button" disabled={!rack || saving} onClick={onSave} type="button">
            {saving ? "Saving..." : "Save audit"}
          </button>
          <button className="ghost-button" onClick={onBackToOverview} type="button">
            Back to overview
          </button>
        </div>
      </div>

      {rack ? (
        <div className="audit-summary-grid editable">
          <label className="overview-feature audit-summary-card">
            <strong>Site</strong>
            <input value={form.siteName} onChange={(event) => onFormChange({ ...form, siteName: event.target.value })} />
          </label>
          <label className="overview-feature audit-summary-card">
            <strong>Room</strong>
            <input value={form.roomName} onChange={(event) => onFormChange({ ...form, roomName: event.target.value })} />
          </label>
          <label className="overview-feature audit-summary-card">
            <strong>Rack Name</strong>
            <input value={form.rackName} onChange={(event) => onFormChange({ ...form, rackName: event.target.value })} />
          </label>
          <label className="overview-feature audit-summary-card">
            <strong>Rack Height</strong>
            <input
              min={1}
              type="number"
              value={form.totalUnits}
              onChange={(event) => onFormChange({ ...form, totalUnits: Number(event.target.value) })}
            />
          </label>
          <label className="overview-feature audit-summary-card full-width">
            <strong>Notes</strong>
            <textarea rows={3} value={form.notes ?? ""} onChange={(event) => onFormChange({ ...form, notes: event.target.value })} />
          </label>
        </div>
      ) : (
        <div className="empty-state">No audit open. Please select an audit from the overview or create a new one.</div>
      )}
    </section>
  );
}
