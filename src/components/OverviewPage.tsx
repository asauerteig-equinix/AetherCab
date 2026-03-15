import type { AuditCreateInput, AuditSummary } from "../../shared/types";

interface OverviewPageProps {
  audits: AuditSummary[];
  searchValue: string;
  createForm: AuditCreateInput;
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
  templateCount,
  onSearchChange,
  onOpenAudit,
  onCreateFormChange,
  onCreateAudit
}: OverviewPageProps) {
  const query = searchValue.trim().toLowerCase();
  const visibleAudits = audits.filter((audit) => {
    if (!query) {
      return true;
    }

    return [audit.name, audit.siteName, audit.roomName, audit.notes ?? ""].some((value) => value.toLowerCase().includes(query));
  });

  return (
    <main className="overview-grid">
      <section className="panel overview-panel overview-panel-primary">
        <p className="eyebrow">Start</p>
        <h2>Open one audit and switch between all related racks there</h2>
        <p className="hero-copy">
          The overview stays focused on finding or creating audits. Once an audit is open, all racks inside it can be managed
          directly in the rack workspace.
        </p>
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
          <input value={searchValue} onChange={(event) => onSearchChange(event.target.value)} placeholder="Audit, site, or room" />
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

      <section className="panel overview-panel">
        <p className="eyebrow">New Audit</p>
        <h2>Create audit</h2>
        <form
          className="create-rack-form overview-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onCreateAudit();
          }}
        >
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
            Audit Name
            <input
              value={createForm.auditName}
              onChange={(event) => onCreateFormChange({ ...createForm, auditName: event.target.value })}
            />
          </label>
          <label>
            First Rack
            <input
              value={createForm.initialRackName}
              onChange={(event) => onCreateFormChange({ ...createForm, initialRackName: event.target.value })}
            />
          </label>
          <label>
            Rack Units
            <input
              min={1}
              type="number"
              value={createForm.initialRackUnits}
              onChange={(event) => onCreateFormChange({ ...createForm, initialRackUnits: Number(event.target.value) })}
            />
          </label>
          <label>
            Notes
            <input
              value={createForm.notes ?? ""}
              onChange={(event) => onCreateFormChange({ ...createForm, notes: event.target.value })}
            />
          </label>
          <button className="primary-button" type="submit">
            Create audit
          </button>
        </form>
      </section>
    </main>
  );
}
