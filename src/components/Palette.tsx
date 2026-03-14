import type { DeviceTemplate } from "../../shared/types";

interface PaletteProps {
  templates: DeviceTemplate[];
}

function formatTemplateType(templateType: string): string {
  return templateType
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("/");
}

export function Palette({ templates }: PaletteProps) {
  const templatesByType = templates.reduce<Record<string, DeviceTemplate[]>>((groups, template) => {
    if (!groups[template.templateType]) {
      groups[template.templateType] = [];
    }

    groups[template.templateType].push(template);
    return groups;
  }, {});

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Vorlagen</p>
          <h2>Geraete Vorlagen</h2>
        </div>
        <span className="muted">In das Audit ziehen</span>
      </div>
      <div className="template-list compact">
        {Object.entries(templatesByType).map(([templateType, group]) => (
          <section className="template-group" key={templateType}>
            <div className="template-group-title">{formatTemplateType(templateType)}</div>
            <div className="template-group-list">
              {group.map((template) => (
                <article
                  className="template-card compact"
                  key={template.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("application/x-aethercab-template", JSON.stringify(template));
                  }}
                >
                  <div className="template-copy">
                    <strong>{template.name}</strong>
                    <p>
                      {template.defaultHeightU}U | {template.manufacturer} {template.model}
                    </p>
                    <p>{template.blocksBothFaces ? "Front + Rear" : "eine Seite"}</p>
                  </div>
                  <div className="template-actions compact">
                    <span>{template.blocksBothFaces ? "Front + Rear" : "eine Seite"}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
