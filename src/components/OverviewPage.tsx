import { useState } from "react";
import type { AuditCreateInput, AuditSummary } from "../../shared/types";
import { formatAuditDateTime, getAuditStatusLabel } from "../../shared/audits";

interface OverviewPageProps {
  audits: AuditSummary[];
  searchValue: string;
  createForm: AuditCreateInput;
  saving: boolean;
  templateCount: number;
  onSearchChange(next: string): void;
  onOpenAudit(auditId: number): void;
  onCreateFormChange(next: AuditCreateInput): void;
  onCreateAudit(): Promise<void>;
}

export function OverviewPage({
  audits,
  searchValue,
  createForm,
  saving,
  templateCount,
  onSearchChange,
  onOpenAudit,
  onCreateFormChange,
  onCreateAudit
}: OverviewPageProps) {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const query = searchValue.trim().toLowerCase();
  const visibleAudits = audits.filter((audit) => {
    if (!query) {
      return true;
    }

    return [audit.name, audit.siteName, audit.roomName, audit.salesOrder ?? "", audit.notes ?? ""].some((value) =>
      value.toLowerCase().includes(query)
    );
  });

  async function handleCreateAudit() {
    await onCreateAudit();
    setCreateModalOpen(false);
  }

  return (
    <>
      <main className="overview-grid">
        <section className="panel overview-panel overview-panel-primary">
          <p className="eyebrow">Start</p>
          <h2>Audits</h2>
          <div className="overview-stats-inline">
            <div className="overview-stat-card">
              <strong>{audits.length}</strong>
              <span>saved audits</span>
            </div>
            <div className="overview-stat-card">
              <strong>{templateCount}</strong>
              <span>device templates</span>
            </div>
          </div>
          <div className="overview-actions">
            <button className="primary-button" onClick={() => setCreateModalOpen(true)} type="button">
              Create new Audit
            </button>
          </div>
        </section>

        <section className="panel overview-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Audit Overview</p>
              <h2>Existing audits</h2>
            </div>
            <span className="muted">{visibleAudits.length} visible</span>
          </div>

          <label className="search-field">
            Search
            <input value={searchValue} onChange={(event) => onSearchChange(event.target.value)} placeholder="Kunde, Sales Order, Site oder Room" />
          </label>

          <div className="overview-audit-list">
            {visibleAudits.length === 0 ? (
              <div className="empty-state">No audits match the current search.</div>
            ) : (
              visibleAudits.map((audit) => (
                <article className="overview-audit-card" key={audit.id}>
                  <div>
                    <strong>{audit.name}</strong>
                    <span>
                      {audit.siteName} / {audit.roomName}
                    </span>
                    <span>
                      {audit.rackCount} rack{audit.rackCount === 1 ? "" : "s"}
                    </span>
                    <span>{`Sales Order: ${audit.salesOrder ?? "-"}`}</span>
                    <span>{`Status: ${getAuditStatusLabel(audit.status)}`}</span>
                    <span>{formatAuditDateTime(audit.createdAt)}</span>
                    <span>{audit.notes || "No notes yet."}</span>
                  </div>
                  <button className="primary-button" onClick={() => onOpenAudit(audit.id)} type="button">
                    Open
                  </button>
                </article>
              ))
            )}
          </div>
        </section>
      </main>

      {createModalOpen ? (
        <div className="audit-edit-modal-backdrop" onClick={() => setCreateModalOpen(false)} role="presentation">
          <section className="panel rack-edit-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="audit-edit-topbar">
              <div className="audit-edit-heading">
                <p className="eyebrow">New Audit</p>
                <h2>Create audit</h2>
                <p className="audit-edit-copy">The first rack is created automatically as `0101` with `47U` and can be renamed later in the editor.</p>
              </div>
              <button className="ghost-button" onClick={() => setCreateModalOpen(false)} type="button">
                Close
              </button>
            </div>

            <form
              className="audit-edit-grid clean"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateAudit();
              }}
            >
              <label>
                Site
                <input value={createForm.siteName} onChange={(event) => onCreateFormChange({ ...createForm, siteName: event.target.value })} />
              </label>
              <label>
                Room
                <input value={createForm.roomName} onChange={(event) => onCreateFormChange({ ...createForm, roomName: event.target.value })} />
              </label>
              <label>
                Kundenname / Systemname
                <input value={createForm.auditName} onChange={(event) => onCreateFormChange({ ...createForm, auditName: event.target.value })} />
              </label>
              <label>
                Sales Order
                <input value={createForm.salesOrder} onChange={(event) => onCreateFormChange({ ...createForm, salesOrder: event.target.value })} />
              </label>
              <label>
                Status
                <select
                  value={createForm.status}
                  onChange={(event) => onCreateFormChange({ ...createForm, status: event.target.value as AuditCreateInput["status"] })}
                >
                  <option value="created">Erstellt</option>
                  <option value="in-progress">In Bearbeitung</option>
                  <option value="completed">Abgeschlossen</option>
                </select>
              </label>
              <label className="full-width">
                Notes
                <input value={createForm.notes ?? ""} onChange={(event) => onCreateFormChange({ ...createForm, notes: event.target.value })} />
              </label>
              <div className="audit-edit-actions full-width">
                <button className="ghost-button" onClick={() => setCreateModalOpen(false)} type="button">
                  Cancel
                </button>
                <button className="primary-button" disabled={saving} type="submit">
                  Create audit
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
