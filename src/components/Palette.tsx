import type { DeviceTemplate } from "../../shared/types";

interface PaletteProps {
  templates: DeviceTemplate[];
  onAddSpare(template: DeviceTemplate): void;
}

export function Palette({ templates, onAddSpare }: PaletteProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Templates</p>
          <h2>Device palette</h2>
        </div>
        <span className="muted">Drag into rack</span>
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
                {template.manufacturer} {template.model}
              </p>
            </div>
            <div className="template-actions">
              <span>{template.defaultHeightU}U</span>
              <button onClick={() => onAddSpare(template)} type="button">
                Spare
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
