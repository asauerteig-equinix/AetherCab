import type { FormEvent } from "react";
import type { DeviceTemplate, DeviceTemplateInput } from "../../shared/types";

interface AdminTemplatesPageProps {
  templates: DeviceTemplate[];
  form: DeviceTemplateInput;
  onFormChange(next: DeviceTemplateInput): void;
  onCreateTemplate(event: FormEvent<HTMLFormElement>): void;
  onDeleteTemplate(templateId: number): void;
}

const templateTypeOptions = [
  { value: "server", label: "Server" },
  { value: "switch-router", label: "Switch/Router" },
  { value: "patch-panel", label: "Patchpanel" },
  { value: "storage", label: "Storage" },
  { value: "ups", label: "UPS" },
  { value: "other", label: "Other" }
];

function formatTemplateType(templateType: string): string {
  return templateTypeOptions.find((option) => option.value === templateType)?.label ?? templateType;
}

export function AdminTemplatesPage({
  templates,
  form,
  onFormChange,
  onCreateTemplate,
  onDeleteTemplate
}: AdminTemplatesPageProps) {
  return (
    <main className="admin-grid">
      <section className="panel overview-panel">
        <p className="eyebrow">New Template</p>
        <h2>Create template</h2>
        <form className="create-rack-form overview-create-form" onSubmit={onCreateTemplate}>
          <label>
            Device type
            <select value={form.templateType} onChange={(event) => onFormChange({ ...form, templateType: event.target.value })}>
              {templateTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Template Name
            <input value={form.name} onChange={(event) => onFormChange({ ...form, name: event.target.value })} />
          </label>
          <label>
            Default manufacturer
            <input
              value={form.manufacturer}
              onChange={(event) => onFormChange({ ...form, manufacturer: event.target.value })}
            />
          </label>
          <label>
            Default model
            <input value={form.model} onChange={(event) => onFormChange({ ...form, model: event.target.value })} />
          </label>
          <label>
            Height U
            <input
              min={1}
              type="number"
              value={form.defaultHeightU}
              onChange={(event) => onFormChange({ ...form, defaultHeightU: Number(event.target.value) })}
            />
          </label>
          <label className="checkbox-field">
            Blocks front and rear
            <input
              checked={form.blocksBothFaces}
              type="checkbox"
              onChange={(event) => onFormChange({ ...form, blocksBothFaces: event.target.checked })}
            />
          </label>
          <button className="primary-button" type="submit">
            Create template
          </button>
        </form>
      </section>

      <section className="panel overview-panel admin-templates-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Templates</p>
            <h2>Current templates</h2>
          </div>
          <span className="muted">{templates.length} templates</span>
        </div>

        <div className="admin-template-list">
          {templates.map((template) => (
            <article className="admin-template-card" key={template.id}>
              <div>
                <strong>{template.name}</strong>
                <span>
                  {formatTemplateType(template.templateType)} | {template.defaultHeightU}U
                </span>
                <span>
                  {template.manufacturer} | {template.model} | {template.blocksBothFaces ? "Front + Rear" : "Single side"}
                </span>
              </div>
              <button className="ghost-button" onClick={() => onDeleteTemplate(template.id)} type="button">
                Delete
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
