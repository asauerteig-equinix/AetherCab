import { useMemo, useState } from "react";
import type { AuditCreateInput, AuditStatus, AuditSummary } from "../../shared/types";
import { formatAuditDateTime, getAuditStatusLabel } from "../../shared/audits";

interface OverviewPageProps {
  audits: AuditSummary[];
  searchValue: string;
  createForm: AuditCreateInput;
  isAdmin: boolean;
  saving: boolean;
  onSearchChange(next: string): void;
  onOpenAudit(auditId: number): void;
  onReopenAudit(auditId: number): void;
  onCreateFormChange(next: AuditCreateInput): void;
  onCreateAudit(): Promise<void>;
}

type OverviewStatusFilter = "all" | AuditStatus;

function StatusIcon({ status }: { status: AuditStatus }) {
  if (status === "completed") {
    return (
      <svg fill="none" height="15" viewBox="0 0 16 16" width="15" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.5 7V5.75A3.5 3.5 0 0 1 8 2.25A3.5 3.5 0 0 1 11.5 5.75V7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
        <rect height="6.5" rx="1.7" stroke="currentColor" strokeWidth="1.4" width="9" x="3.5" y="7" />
      </svg>
    );
  }

  if (status === "in-progress") {
    return (
      <svg fill="none" height="15" viewBox="0 0 16 16" width="15" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 4.8V8L10.3 9.7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
      </svg>
    );
  }

  return (
    <svg fill="none" height="15" viewBox="0 0 16 16" width="15" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 3V13" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
      <path d="M3 8H13" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function OverviewPage({
  audits,
  searchValue,
  createForm,
  isAdmin,
  saving,
  onSearchChange,
  onOpenAudit,
  onReopenAudit,
  onCreateFormChange,
  onCreateAudit
}: OverviewPageProps) {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OverviewStatusFilter>("all");
  const query = searchValue.trim().toLowerCase();
  const sortedAudits = useMemo(
    () => [...audits].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [audits]
  );
  const createdCount = audits.filter((audit) => audit.status === "created").length;
  const inProgressCount = audits.filter((audit) => audit.status === "in-progress").length;
  const completedCount = audits.filter((audit) => audit.status === "completed").length;
  const totalAudits = audits.length;
  const totalSafe = totalAudits || 1;
  const createdPercent = Math.round((createdCount / totalSafe) * 100);
  const inProgressPercent = Math.round((inProgressCount / totalSafe) * 100);
  const completedPercent = Math.max(0, 100 - createdPercent - inProgressPercent);

  const visibleAudits = sortedAudits.filter((audit) => {
    const matchesStatus = statusFilter === "all" || audit.status === statusFilter;
    if (!matchesStatus) {
      return false;
    }

    if (!query) {
      return true;
    }

    return [audit.name, audit.siteName, audit.roomName, audit.salesOrder ?? "", audit.notes ?? ""].some((value) =>
      value.toLowerCase().includes(query)
    );
  });
  const recentAudits = visibleAudits.slice(0, 5);

  async function handleCreateAudit() {
    await onCreateAudit();
    setCreateModalOpen(false);
  }

  return (
    <>
      <main className="overview-shell">
        <section className="panel overview-hero-panel">
          <div className="overview-hero-copy">
            <p className="eyebrow">Start</p>
            <h2>Audit Dashboard</h2>
            <p className="hero-copy">Track total audit volume, current progress, and get direct access to the latest documentation workspaces.</p>
            <div className="overview-hero-stats">
              <article className="overview-stat-card emphasis">
                <span>Total created</span>
                <strong>{totalAudits}</strong>
              </article>
              <article className="overview-stat-card status created">
                <span>Created</span>
                <strong>{createdCount}</strong>
              </article>
              <article className="overview-stat-card status in-progress">
                <span>In Progress</span>
                <strong>{inProgressCount}</strong>
              </article>
              <article className="overview-stat-card status completed">
                <span>Completed</span>
                <strong>{completedCount}</strong>
              </article>
            </div>
          </div>

          <div className="overview-hero-side">
            <div className="overview-status-graphic" aria-label="Audit status distribution">
              <div className="overview-status-bar">
                <span className="created" style={{ width: `${createdPercent}%` }} />
                <span className="in-progress" style={{ width: `${inProgressPercent}%` }} />
                <span className="completed" style={{ width: `${completedPercent}%` }} />
              </div>
              <div className="overview-status-legend">
                <span className="created">{`${createdPercent}% created`}</span>
                <span className="in-progress">{`${inProgressPercent}% in progress`}</span>
                <span className="completed">{`${completedPercent}% completed`}</span>
              </div>
            </div>

            <button className="primary-button overview-cta-button" onClick={() => setCreateModalOpen(true)} type="button">
              <span aria-hidden="true">
                <svg fill="none" height="18" viewBox="0 0 18 18" width="18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 3.5V14.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                  <path d="M3.5 9H14.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
                </svg>
              </span>
              <span>Create new Audit</span>
            </button>
          </div>
        </section>

        <section className="panel overview-panel overview-recent-panel">
          <div className="panel-header overview-panel-header">
            <div>
              <p className="eyebrow">Recent Audits</p>
              <h2>Latest documentation workspaces</h2>
            </div>
            <span className="muted">{`${recentAudits.length} of ${visibleAudits.length} shown`}</span>
          </div>

          <div className="overview-filter-bar">
            <label className="search-field">
              Search
              <input value={searchValue} onChange={(event) => onSearchChange(event.target.value)} placeholder="Customer, sales order, site, or room" />
            </label>

            <div className="overview-status-filters">
              {[
                { key: "all" as const, label: "All", count: audits.length },
                { key: "created" as const, label: "Created", count: createdCount },
                { key: "in-progress" as const, label: "In Progress", count: inProgressCount },
                { key: "completed" as const, label: "Completed", count: completedCount }
              ].map((filter) => (
                <button
                  key={filter.key}
                  className={statusFilter === filter.key ? "overview-filter-chip selected" : "overview-filter-chip"}
                  onClick={() => setStatusFilter(filter.key)}
                  type="button"
                >
                  <span>{filter.label}</span>
                  <strong>{filter.count}</strong>
                </button>
              ))}
            </div>
          </div>

          <div className="overview-audit-list">
            {recentAudits.length === 0 ? (
              <div className="empty-state">No audits match the current search or status filter.</div>
            ) : (
              recentAudits.map((audit) => (
                <article className={`overview-audit-card status-${audit.status}`} key={audit.id}>
                  <div className="overview-audit-main">
                    <div className="overview-audit-topline">
                      <strong>{audit.name}</strong>
                      <span className={`audit-status-badge ${audit.status}`}>
                        <StatusIcon status={audit.status} />
                        <span>{getAuditStatusLabel(audit.status)}</span>
                      </span>
                    </div>
                    <span>
                      {audit.siteName} / {audit.roomName}
                    </span>
                    <span>
                      {audit.rackCount} rack{audit.rackCount === 1 ? "" : "s"} | {`Sales Order: ${audit.salesOrder ?? "-"}`}
                    </span>
                    <span>{formatAuditDateTime(audit.createdAt)}</span>
                    <span>{audit.notes || "No notes yet."}</span>
                  </div>
                  <div className="overview-audit-actions">
                    <button className="primary-button" onClick={() => onOpenAudit(audit.id)} type="button">
                      {audit.status === "completed" ? "View" : "Open"}
                    </button>
                    {isAdmin && audit.status === "completed" ? (
                      <button className="ghost-button" disabled={saving} onClick={() => onReopenAudit(audit.id)} type="button">
                        Set In Progress
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>

      {createModalOpen ? (
        <div className="audit-edit-modal-backdrop" onClick={() => setCreateModalOpen(false)} role="presentation">
          <section aria-modal="true" className="panel audit-edit-modal overview-create-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="audit-edit-topbar">
              <div className="audit-edit-heading">
                <p className="eyebrow">New Audit</p>
                <h2>Create audit</h2>
              </div>
              <button className="ghost-button" onClick={() => setCreateModalOpen(false)} type="button">
                Close
              </button>
            </div>

            <form
              className="audit-edit-grid clean overview-create-grid"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateAudit();
              }}
            >
              <label className="audit-edit-field">
                <span>Site</span>
                <input
                  value={createForm.siteName}
                  onChange={(event) => onCreateFormChange({ ...createForm, siteName: event.target.value })}
                  placeholder="Customer site"
                />
              </label>
              <label className="audit-edit-field">
                <span>Room</span>
                <input
                  value={createForm.roomName}
                  onChange={(event) => onCreateFormChange({ ...createForm, roomName: event.target.value })}
                  placeholder="Room / area"
                />
              </label>
              <label className="audit-edit-field full-width">
                <span>Customer / System Name</span>
                <input
                  value={createForm.auditName}
                  onChange={(event) => onCreateFormChange({ ...createForm, auditName: event.target.value })}
                  placeholder="Project or system name"
                />
              </label>
              <label className="audit-edit-field">
                <span>Sales Order</span>
                <input
                  value={createForm.salesOrder}
                  onChange={(event) => onCreateFormChange({ ...createForm, salesOrder: event.target.value })}
                  placeholder="Optional"
                />
              </label>
              <div className="overview-create-spacer" aria-hidden="true" />
              <label className="audit-edit-field full-width">
                <span>Notes</span>
                <textarea
                  className="overview-create-notes"
                  rows={6}
                  value={createForm.notes ?? ""}
                  onChange={(event) => onCreateFormChange({ ...createForm, notes: event.target.value })}
                  placeholder="Optional notes for this audit"
                />
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
