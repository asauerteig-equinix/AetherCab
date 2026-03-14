import type { RackDetail } from "../../shared/types";

interface RackSwitcherProps {
  rack: RackDetail | null;
  onBackToOverview(): void;
}

export function RackSwitcher({ rack, onBackToOverview }: RackSwitcherProps) {
  return (
    <section className="panel audit-context-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Active Audit</p>
          <h2>{rack ? rack.name : "No audit open"}</h2>
        </div>
        <button className="ghost-button" onClick={onBackToOverview} type="button">
          Back to overview
        </button>
      </div>

      {rack ? (
        <div className="audit-context-grid">
          <div className="overview-feature">
            <strong>Site</strong>
            <span>{rack.siteName}</span>
          </div>
          <div className="overview-feature">
            <strong>Room</strong>
            <span>{rack.roomName}</span>
          </div>
          <div className="overview-feature">
            <strong>Rack Height</strong>
            <span>{rack.totalUnits}U</span>
          </div>
          <div className="overview-feature">
            <strong>Notes</strong>
            <span>{rack.notes || "No notes yet."}</span>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          No audit open. Please select an audit from the overview or create a new one.
        </div>
      )}
    </section>
  );
}
