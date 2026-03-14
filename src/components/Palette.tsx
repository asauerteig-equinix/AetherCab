import type { DeviceTemplate } from "../../shared/types";

interface PaletteProps {
  templates: DeviceTemplate[];
  onAddSpare(template: DeviceTemplate): void;
}

function formatTemplateType(templateType: string): string {
  return templateType
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("/");
}

export function Palette({ templates, onAddSpare }: PaletteProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Vorlagen</p>
          <h2>Geraete Vorlagen</h2>
        </div>
        <span className="muted">In das Audit ziehen</span>
      </div>
      <div className="template-list">
        {templates.map((template) => (
          <article
            className="template-card"
            key={template.id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("application/x-aethercab-template", JSON.stringify(template));
            }}
          >
            <div>
              <strong>{template.name}</strong>
              <p>
                {formatTemplateType(template.templateType)} | {template.manufacturer} {template.model}
              </p>
              <p>{template.blocksBothFaces ? "Front + Rear" : "eine Seite"}</p>
            </div>
            <div className="template-actions">
              <span>{template.defaultHeightU}U</span>
              <button onClick={() => onAddSpare(template)} type="button">
                Ersatzteil
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
