interface OverviewPageProps {
  auditCount: number;
  templateCount: number;
  onOpenAudits(): void;
}

export function OverviewPage({ auditCount, templateCount, onOpenAudits }: OverviewPageProps) {
  return (
    <main className="overview-grid">
      <section className="panel overview-panel overview-panel-primary">
        <p className="eyebrow">Start</p>
        <h2>Rack Audits zentral erstellen, suchen und oeffnen</h2>
        <p className="hero-copy">
          Mitarbeitende starten von hier aus in die Audit-Arbeit. Bestehende Audits lassen sich finden und oeffnen,
          neue Audits werden gezielt angelegt statt direkt im Editor zu landen.
        </p>
        <div className="overview-actions">
          <button className="primary-button" onClick={onOpenAudits} type="button">
            Audit-Bereich oeffnen
          </button>
        </div>
      </section>

      <section className="panel overview-panel">
        <p className="eyebrow">Funktionen</p>
        <div className="overview-feature-list">
          <article className="overview-feature">
            <strong>Neues Audit erstellen</strong>
            <span>Site, Room und Rack anlegen und direkt fuer die Dokumentation vorbereiten.</span>
          </article>
          <article className="overview-feature">
            <strong>Audit suchen und oeffnen</strong>
            <span>Vorhandene Audits filtern, auswaehlen und in der Arbeitsflaeche weiterbearbeiten.</span>
          </article>
          <article className="overview-feature">
            <strong>Rack und Spare Parts dokumentieren</strong>
            <span>Einbauten visuell platzieren, Metadaten pflegen und lose Teile getrennt erfassen.</span>
          </article>
          <article className="overview-feature">
            <strong>Excel und PDF exportieren</strong>
            <span>Der aktuelle gespeicherte Stand kann strukturiert ausgegeben werden.</span>
          </article>
        </div>
      </section>

      <section className="panel overview-panel overview-stats">
        <p className="eyebrow">Status</p>
        <div className="overview-stat-card">
          <strong>{auditCount}</strong>
          <span>gespeicherte Audits</span>
        </div>
        <div className="overview-stat-card">
          <strong>{templateCount}</strong>
          <span>Device Templates</span>
        </div>
      </section>
    </main>
  );
}
