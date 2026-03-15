import { useMemo, useState } from "react";
import type { DeviceTemplate } from "../../shared/types";
import { getDeviceIconUrl } from "../deviceIcons";

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
  const templatesByType = useMemo(
    () =>
      templates.reduce<Record<string, DeviceTemplate[]>>((groups, template) => {
        if (!groups[template.templateType]) {
          groups[template.templateType] = [];
        }

        groups[template.templateType].push(template);
        return groups;
      }, {}),
    [templates]
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  function toggleGroup(templateType: string) {
    setCollapsedGroups((current) => ({
      ...current,
      [templateType]: !current[templateType]
    }));
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Templates</p>
          <h2>Device Templates</h2>
        </div>
        <span className="muted">Drag into the audit</span>
      </div>
      <div className="template-list compact">
        {Object.entries(templatesByType).map(([templateType, group]) => (
          <section className="template-group" key={templateType}>
            <button className="template-group-title" onClick={() => toggleGroup(templateType)} type="button">
              <span>{formatTemplateType(templateType)}</span>
              <strong>{collapsedGroups[templateType] ? "+" : "-"}</strong>
            </button>
            <div className={collapsedGroups[templateType] ? "template-group-list collapsed" : "template-group-list"}>
              {group.map((template) => (
                <article
                  className="template-card compact"
                  key={template.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("application/x-aethercab-template", JSON.stringify(template));
                  }}
                >
                  <img alt="" aria-hidden="true" className="template-icon" src={getDeviceIconUrl(template.iconKey)} />
                  <div className="template-copy">
                    <strong>{template.name}</strong>
                    <p>
                      {template.defaultHeightU}U | {template.manufacturer} {template.model}
                    </p>
                    <p>
                      {template.mountStyle === "vertical-pdu"
                        ? "Rear vertical PDU lane"
                        : template.blocksBothFaces
                          ? "Front + Rear"
                          : "Single side"}
                    </p>
                  </div>
                  <div className="template-actions compact">
                    <span>
                      {template.mountStyle === "vertical-pdu"
                        ? "Rear PDU"
                        : template.blocksBothFaces
                          ? "Front + Rear"
                          : "Single side"}
                    </span>
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
