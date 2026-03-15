import { useState } from "react";
import { formatAuditDateTime, getAuditStatusLabel } from "../../shared/audits";
import type { AuditDetail, AuditUpdateInput } from "../../shared/types";

interface RackSwitcherProps {
  audit: AuditDetail | null;
  form: AuditUpdateInput;
  saving: boolean;
  onFormChange(next: AuditUpdateInput): void;
  onSave(): Promise<void>;
}

function toAuditForm(audit: AuditDetail): AuditUpdateInput {
  return {
    siteName: audit.siteName,
    roomName: audit.roomName,
    auditName: audit.name,
    salesOrder: audit.salesOrder ?? "",
    status: audit.status,
    notes: audit.notes ?? ""
  };
}

export function RackSwitcher({ audit, form, saving, onFormChange, onSave }: RackSwitcherProps) {
  const [editorOpen, setEditorOpen] = useState(false);

  if (!audit) {
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
    onFormChange(toAuditForm(audit));
    setEditorOpen(false);
  }

  return (
    <>
      <section className="audit-summary compact">
        <div className="audit-summary-header compact">
          <div
            className="audit-summary-surface"
            onDoubleClick={() => {
              onFormChange(toAuditForm(audit));
              setEditorOpen(true);
            }}
          >
            <p className="eyebrow">Active Audit</p>
            <h2>{audit.name}</h2>
            <p className="audit-summary-inline">
              <strong>{audit.siteName}</strong>
              <span>{audit.roomName}</span>
              <span>{`SO ${audit.salesOrder ?? "-"}`}</span>
              <span>{getAuditStatusLabel(audit.status)}</span>
              <span>{formatAuditDateTime(audit.createdAt)}</span>
              <span>
                {audit.rackCount} rack{audit.rackCount === 1 ? "" : "s"}
              </span>
            </p>
            <p className="audit-summary-notes">{audit.notes || "No notes yet."}</p>
            <p className="audit-summary-hint">Double-click to edit audit details.</p>
          </div>
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
                <h2 id="audit-edit-title">{audit.name}</h2>
              </div>
              <button className="ghost-button" disabled={saving} onClick={handleCancel} type="button">
                Close
              </button>
            </div>

            <div className="audit-edit-grid clean">
              <label className="audit-edit-field plain">
                <span>Kundenname / Systemname</span>
                <input value={form.auditName} onChange={(event) => onFormChange({ ...form, auditName: event.target.value })} />
              </label>
              <label className="audit-edit-field plain">
                <span>Sales Order</span>
                <input value={form.salesOrder} onChange={(event) => onFormChange({ ...form, salesOrder: event.target.value })} />
              </label>
              <label className="audit-edit-field plain">
                <span>Site</span>
                <input value={form.siteName} onChange={(event) => onFormChange({ ...form, siteName: event.target.value })} />
              </label>
              <label className="audit-edit-field plain">
                <span>Room</span>
                <input value={form.roomName} onChange={(event) => onFormChange({ ...form, roomName: event.target.value })} />
              </label>
              <label className="audit-edit-field plain">
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(event) => onFormChange({ ...form, status: event.target.value as AuditUpdateInput["status"] })}
                >
                  <option value="created">Erstellt</option>
                  <option value="in-progress">In Bearbeitung</option>
                  <option value="completed">Abgeschlossen</option>
                </select>
              </label>
              <label className="audit-edit-field plain full-width">
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
