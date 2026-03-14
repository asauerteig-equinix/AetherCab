import type { FormEvent } from "react";
import type { RackCreateInput, RackSummary } from "../../shared/types";

interface OverviewPageProps {
  racks: RackSummary[];
  searchValue: string;
  createForm: RackCreateInput;
  templateCount: number;
  onSearchChange(next: string): void;
  onOpenAudit(rackId: number): void;
  onCreateFormChange(next: RackCreateInput): void;
  onCreateAudit(event: FormEvent<HTMLFormElement>): void;
}

export function OverviewPage({
  racks,
  searchValue,
  createForm,
  templateCount,
  onSearchChange,
  onOpenAudit,
  onCreateFormChange,
  onCreateAudit
}: OverviewPageProps) {
  const query = searchValue.trim().toLowerCase();
  const visibleRacks = racks.filter((rack) => {
    if (!query) {
      return true;
    }

    return [rack.name, rack.siteName, rack.roomName].some((value) => value.toLowerCase().includes(query));
  });

  return (
    <main className="overview-grid">
      <section className="panel overview-panel overview-panel-primary">
        <p className="eyebrow">Start</p>
        <h2>Find or create audits first, then edit with focus</h2>
        <p className="hero-copy">
          The overview is the main entry point for the team. Existing audits can be listed, filtered, and opened here,
          while the rack workspace stays focused on a single audit at a time.
        </p>
        <div className="overview-stats-inline">
          <div className="overview-stat-card">
            <strong>{racks.length}</strong>
            <span>saved audits</span>
          </div>
          <div className="overview-stat-card">
            <strong>{templateCount}</strong>
            <span>Device Templates</span>
          </div>
        </div>
      </section>

      <section className="panel overview-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Audit Overview</p>
            <h2>Existing audits</h2>
          </div>
          <span className="muted">{visibleRacks.length} visible</span>
        </div>

        <label className="search-field">
          Search
          <input value={searchValue} onChange={(event) => onSearchChange(event.target.value)} placeholder="Audit, site, or room" />
        </label>

        <div className="overview-audit-list">
          {visibleRacks.length === 0 ? (
            <div className="empty-state">No audits match the current search.</div>
          ) : (
            visibleRacks.map((rack) => (
              <article className="overview-audit-card" key={rack.id}>
                <div>
                  <strong>{rack.name}</strong>
                  <span>
                    {rack.siteName} / {rack.roomName}
                  </span>
                  <span>{rack.totalUnits}U</span>
                </div>
                <button className="primary-button" onClick={() => onOpenAudit(rack.id)} type="button">
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
        <form className="create-rack-form overview-create-form" onSubmit={onCreateAudit}>
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
          <button className="primary-button" type="submit">
            Create audit
          </button>
        </form>
      </section>
    </main>
  );
}
