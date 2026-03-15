import { useState } from "react";
import type { RackDetail, RackUpdateInput } from "../../shared/types";

interface RackSwitcherProps {
  rack: RackDetail | null;
  form: RackUpdateInput;
  saving: boolean;
  onFormChange(next: RackUpdateInput): void;
  onSave(): Promise<void>;
  onBackToOverview(): void;
}

function toRackForm(rack: RackDetail): RackUpdateInput {
  return {
    siteName: rack.siteName,
    roomName: rack.roomName,
    rackName: rack.name,
    totalUnits: rack.totalUnits,
    notes: rack.notes ?? ""
  };
}

export function RackSwitcher({ rack, form, saving, onFormChange, onSave, onBackToOverview }: RackSwitcherProps) {
  const [editorOpen, setEditorOpen] = useState(false);

  if (!rack) {
    return (
      <section className="audit-summary compact">
        <div className="empty-state">No audit open. Please select an audit from the overview or create a new one.</div>
      </section>
    );
  }

  async function handleSave() {
    await onSave();
    setEditorOpen(false);
  }

  function handleCancel() {
    onFormChange(toRackForm(rack));
    setEditorOpen(false);
  }

  return (
    <>
      <section className="audit-summary compact">
        <div className="audit-summary-header compact">
          <div
            className="audit-summary-surface"
            onDoubleClick={() => {
              onFormChange(toRackForm(rack));
              setEditorOpen(true);
            }}
          >
            <p className="eyebrow">Active Audit</p>
            <h2>{rack.name}</h2>
            <p className="audit-summary-inline">
              <strong>{rack.siteName}</strong>
              <span>{rack.roomName}</span>
              <span>{rack.totalUnits}U</span>
            </p>
            <p className="audit-summary-notes">{rack.notes || "No notes yet."}</p>
            <p className="audit-summary-hint">Double-click to edit audit details.</p>
          </div>
          <button className="ghost-button" onClick={onBackToOverview} type="button">
            Back to overview
          </button>
        </div>
      </section>

      {editorOpen ? (
        <div
          className="audit-edit-modal-backdrop"
          onClick={() => {
            if (!saving) {
              handleCancel();
            }
          }}
          role="presentation"
        >
          <section
            aria-labelledby="audit-edit-title"
            aria-modal="true"
            className="panel audit-edit-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="audit-edit-topbar">
              <div className="audit-edit-heading">
                <p className="eyebrow">Edit Audit</p>
                <h2 id="audit-edit-title">{rack.name}</h2>
                <p className="audit-edit-copy">Update the audit metadata without leaving the rack editor.</p>
              </div>
              <button className="ghost-button" disabled={saving} onClick={handleCancel} type="button">
                Close
              </button>
            </div>

            <div className="audit-edit-grid">
              <label className="audit-edit-field">
                <span>Site</span>
                <input value={form.siteName} onChange={(event) => onFormChange({ ...form, siteName: event.target.value })} />
              </label>
              <label className="audit-edit-field">
                <span>Room</span>
                <input value={form.roomName} onChange={(event) => onFormChange({ ...form, roomName: event.target.value })} />
              </label>
              <label className="audit-edit-field">
                <span>Rack Name</span>
                <input value={form.rackName} onChange={(event) => onFormChange({ ...form, rackName: event.target.value })} />
              </label>
              <label className="audit-edit-field">
                <span>Rack Height</span>
                <input
                  min={1}
                  type="number"
                  value={form.totalUnits}
                  onChange={(event) => onFormChange({ ...form, totalUnits: Number(event.target.value) })}
                />
                <small>Can only be reduced if no placed devices would exceed the new height.</small>
              </label>
              <label className="audit-edit-field full-width">
                <span>Notes</span>
                <textarea rows={4} value={form.notes ?? ""} onChange={(event) => onFormChange({ ...form, notes: event.target.value })} />
              </label>
            </div>

            <div className="audit-edit-actions">
              <button className="ghost-button" disabled={saving} onClick={handleCancel} type="button">
                Cancel
              </button>
              <button className="primary-button" disabled={saving} onClick={() => void handleSave()} type="button">
                {saving ? "Saving..." : "Save audit"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
