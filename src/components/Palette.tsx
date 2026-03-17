import { useEffect, useMemo, useState } from "react";
import type { DeviceTemplate } from "../../shared/types";
import { getDeviceIconUrl } from "../deviceIcons";
import { clearCurrentDragPayload, setCurrentTemplateDrag, writeTemplateDragData } from "../dragPayload";

interface PaletteProps {
  templates: DeviceTemplate[];
  collapsed: boolean;
  disabled?: boolean;
}

function formatTemplateType(templateType: string): string {
  return templateType
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("/");
}

export function Palette({ templates, collapsed, disabled = false }: PaletteProps) {
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

  useEffect(() => {
    setCollapsedGroups(
      Object.keys(templatesByType).reduce<Record<string, boolean>>((groups, templateType) => {
        groups[templateType] = true;
        return groups;
      }, {})
    );
  }, [templatesByType]);

  function toggleGroup(templateType: string) {
    setCollapsedGroups((current) => ({
      ...current,
      [templateType]: !current[templateType]
    }));
  }

  return (
    <section className={collapsed ? "panel side-panel-collapsed" : "panel"}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Templates</p>
          <h2>Device Templates</h2>
        </div>
        <span className="muted">{disabled ? "Completed audit is read-only" : "Drag into the audit"}</span>
      </div>
      <div className={collapsed ? "template-list compact hidden" : "template-list compact"}>
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
                  draggable={!disabled}
                  onDragStart={(event) => {
                    if (disabled) {
                      event.preventDefault();
                      return;
                    }
                    setCurrentTemplateDrag(template);
                    writeTemplateDragData(event.dataTransfer, template);
                  }}
                  onDragEnd={clearCurrentDragPayload}
                >
                  <img alt="" aria-hidden="true" className="template-icon" src={getDeviceIconUrl(template.iconKey)} />
                  <div className="template-copy">
                    <strong>{template.name}</strong>
                    <p>
                      {template.defaultHeightU}U | {template.manufacturer} {template.model}
                    </p>
                    <p>
                      {template.mountStyle === "vertical-pdu"
                        ? "Vertical PDU lane"
                        : template.blocksBothFaces
                          ? "Front + Rear"
                          : template.allowSharedDepth
                            ? "Shared depth shelf"
                          : "Single side"}
                    </p>
                  </div>
                  <div className="template-actions compact">
                    <span>
                      {template.mountStyle === "vertical-pdu"
                        ? "Vertical PDU"
                        : template.blocksBothFaces
                          ? "Front + Rear"
                          : template.allowSharedDepth
                            ? "Shared depth"
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
