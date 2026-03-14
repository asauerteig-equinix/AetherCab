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
          <p className="eyebrow">Aktives Audit</p>
          <h2>{rack ? rack.name : "Kein Audit geoeffnet"}</h2>
        </div>
        <button className="ghost-button" onClick={onBackToOverview} type="button">
          Zur Uebersicht
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
            <strong>Audit Hoehe</strong>
            <span>{rack.totalUnits}U</span>
          </div>
          <div className="overview-feature">
            <strong>Notizen</strong>
            <span>{rack.notes || "Noch keine Notizen vorhanden."}</span>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          Kein Audit geoeffnet. Bitte in der Uebersicht ein Audit auswaehlen oder neu anlegen.
        </div>
      )}
    </section>
  );
}
