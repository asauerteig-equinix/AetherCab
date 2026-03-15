import { useState } from "react";
import { formatAuditDateTime, getAuditStatusLabel } from "../../shared/audits";
import type { AuditDetail, AuditUpdateInput } from "../../shared/types";

interface RackSwitcherProps {
  audit: AuditDetail | null;
  form: AuditUpdateInput;
  saving: boolean;
  isAdmin: boolean;
  onFormChange(next: AuditUpdateInput): void;
  onSave(): Promise<void>;
  onCloneAudit(): Promise<void>;
  onReopenAudit(): Promise<void>;
  onDeleteAudit(): Promise<void> | void;
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

export function RackSwitcher({ audit, form, saving, isAdmin, onFormChange, onSave, onCloneAudit, onReopenAudit, onDeleteAudit }: RackSwitcherProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteSalesOrderInput, setDeleteSalesOrderInput] = useState("");
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);

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

  async function handleDelete() {
    await onDeleteAudit();
    setEditorOpen(false);
    setDeleteSalesOrderInput("");
    setDeleteConfirmed(false);
  }

  function handleCancel() {
    onFormChange(toAuditForm(audit));
    setEditorOpen(false);
    setDeleteSalesOrderInput("");
    setDeleteConfirmed(false);
  }

  async function handleCloneAudit() {
    await onCloneAudit();
    setEditorOpen(false);
  }

  async function handleReopenAudit() {
    await onReopenAudit();
    setEditorOpen(false);
  }

  const readOnly = audit.status === "completed";

  return (
    <>
      <section className="audit-summary compact">
        <div className="audit-summary-header compact">
          <div
            className="audit-summary-surface"
            onDoubleClick={() => {
              onFormChange(toAuditForm(audit));
              setEditorOpen(true);
              setDeleteSalesOrderInput("");
              setDeleteConfirmed(false);
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
            <p className="audit-summary-hint">
              {readOnly ? "Double-click to view details or create a new audit based on this one." : "Double-click to edit audit details."}
            </p>
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
                <p className="eyebrow">{readOnly ? "Audit Details" : "Edit Audit"}</p>
                <h2 id="audit-edit-title">{audit.name}</h2>
                {readOnly ? (
                  <p className="audit-edit-copy">This audit is completed and can only be viewed. Create a new audit from this baseline to continue working.</p>
                ) : null}
              </div>
              <button className="ghost-button" disabled={saving} onClick={handleCancel} type="button">
                Close
              </button>
            </div>

            <div className="audit-edit-grid clean">
              <label className="audit-edit-field plain">
                <span>Customer / System Name</span>
                <input disabled={readOnly} value={form.auditName} onChange={(event) => onFormChange({ ...form, auditName: event.target.value })} />
              </label>
              <label className="audit-edit-field plain">
                <span>Sales Order</span>
                <input disabled={readOnly} value={form.salesOrder} onChange={(event) => onFormChange({ ...form, salesOrder: event.target.value })} />
              </label>
              <label className="audit-edit-field plain">
                <span>Site</span>
                <input disabled={readOnly} value={form.siteName} onChange={(event) => onFormChange({ ...form, siteName: event.target.value })} />
              </label>
              <label className="audit-edit-field plain">
                <span>Room</span>
                <input disabled={readOnly} value={form.roomName} onChange={(event) => onFormChange({ ...form, roomName: event.target.value })} />
              </label>
              <label className="audit-edit-field plain">
                <span>Status</span>
                <select
                  disabled={readOnly}
                  value={form.status}
                  onChange={(event) => onFormChange({ ...form, status: event.target.value as AuditUpdateInput["status"] })}
                >
                  <option value="created">Created</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <label className="audit-edit-field plain full-width">
                <span>Notes</span>
                <textarea
                  disabled={readOnly}
                  rows={4}
                  value={form.notes ?? ""}
                  onChange={(event) => onFormChange({ ...form, notes: event.target.value })}
                />
              </label>
            </div>

            {readOnly ? (
              <div className="audit-delete-section">
                <div className="completed-followup-callout">
                  <span className="completed-followup-badge">
                    <span className="completed-followup-pulse" />
                    <span>Recommended next step</span>
                  </span>
                  <div className="audit-delete-copy">
                    <strong>Create follow-up audit</strong>
                    <p>This creates a new editable audit with the same racks and devices as the current completed audit.</p>
                  </div>
                </div>
                <button className="primary-button completed-followup-button" disabled={saving} onClick={() => void handleCloneAudit()} type="button">
                  Create new audit from this one
                </button>
                {isAdmin ? (
                  <button className="ghost-button" disabled={saving} onClick={() => void handleReopenAudit()} type="button">
                    Set audit back to In Progress
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="audit-delete-section">
                <div className="audit-delete-copy">
                  <strong>Delete audit</strong>
                  <p>This permanently removes the audit, all racks, all devices and the temporary tray entries.</p>
                </div>
                <label className="audit-edit-field plain full-width">
                  <span>Type Sales Order to confirm</span>
                  <input value={deleteSalesOrderInput} onChange={(event) => setDeleteSalesOrderInput(event.target.value)} />
                </label>
                <label className="audit-delete-checkbox">
                  <input checked={deleteConfirmed} type="checkbox" onChange={(event) => setDeleteConfirmed(event.target.checked)} />
                  <span>I understand that this deletion is permanent.</span>
                </label>
                <button
                  className="ghost-button danger"
                  disabled={saving || deleteSalesOrderInput.trim() !== (audit.salesOrder ?? "") || !deleteConfirmed}
                  onClick={() => void handleDelete()}
                  type="button"
                >
                  Delete audit permanently
                </button>
              </div>
            )}

            <div className="audit-edit-actions">
              <button className="ghost-button" disabled={saving} onClick={handleCancel} type="button">
                Cancel
              </button>
              {!readOnly ? (
                <button className="primary-button" disabled={saving} onClick={() => void handleSave()} type="button">
                  {saving ? "Saving..." : "Save audit"}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
