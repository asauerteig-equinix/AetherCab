import { useState, type FormEvent } from "react";
import { getDefaultIconKeyForTemplateType, getDeviceIconUrl } from "../deviceIcons";
import type { DeviceTemplate, DeviceTemplateInput } from "../../shared/types";
import { DeviceIconPicker } from "./DeviceIconPicker";

interface AdminTemplatesPageProps {
  templates: DeviceTemplate[];
  form: DeviceTemplateInput;
  onFormChange(next: DeviceTemplateInput): void;
  onCreateTemplate(event: FormEvent<HTMLFormElement>): void;
  onUpdateTemplate(templateId: number, next: DeviceTemplateInput): void;
  onDeleteTemplate(templateId: number): void;
}

const templateTypeOptions = [
  { value: "server", label: "Server" },
  { value: "switch-router", label: "Switch/Router" },
  { value: "patch-panel", label: "Patchpanel" },
  { value: "storage", label: "Storage" },
  { value: "ups", label: "UPS" },
  { value: "pdu", label: "PDU" },
  { value: "other", label: "Other" }
];

const mountStyleOptions = [
  { value: "full", label: "Standard rack device" },
  { value: "vertical-pdu", label: "Vertical rear PDU" }
] as const;

function formatTemplateType(templateType: string): string {
  return templateTypeOptions.find((option) => option.value === templateType)?.label ?? templateType;
}

function toTemplateForm(template: DeviceTemplate): DeviceTemplateInput {
  return {
    templateType: template.templateType,
    mountStyle: template.mountStyle,
    iconKey: template.iconKey,
    name: template.name,
    manufacturer: template.manufacturer,
    model: template.model,
    defaultHeightU: template.defaultHeightU,
    blocksBothFaces: template.blocksBothFaces,
    allowSharedDepth: template.allowSharedDepth
  };
}

function applyTemplateTypeToForm(nextTemplateType: string, currentForm: DeviceTemplateInput): DeviceTemplateInput {
  const nextMountStyle = nextTemplateType === "pdu" ? "vertical-pdu" : currentForm.mountStyle;

  return {
    ...currentForm,
    templateType: nextTemplateType,
    mountStyle: nextMountStyle,
    iconKey: getDefaultIconKeyForTemplateType(nextTemplateType),
    blocksBothFaces: nextTemplateType === "pdu" ? false : currentForm.blocksBothFaces,
    allowSharedDepth: nextTemplateType === "pdu" ? false : currentForm.allowSharedDepth
  };
}

export function AdminTemplatesPage({
  templates,
  form,
  onFormChange,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate
}: AdminTemplatesPageProps) {
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState<DeviceTemplateInput | null>(null);

  const editingTemplate = templates.find((template) => template.id === editingTemplateId) ?? null;

  return (
    <>
      <main className="admin-grid">
        <section className="panel overview-panel">
          <p className="eyebrow">New Template</p>
          <h2>Create template</h2>
          <form className="create-rack-form overview-create-form" onSubmit={onCreateTemplate}>
            <label>
              Device type
              <select
                value={form.templateType}
                onChange={(event) => {
                  onFormChange(applyTemplateTypeToForm(event.target.value, form));
                }}
              >
                {templateTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mounting
              <select
                value={form.mountStyle}
                onChange={(event) =>
                  onFormChange({
                    ...form,
                    templateType: event.target.value === "vertical-pdu" ? "pdu" : form.templateType,
                    mountStyle: event.target.value as DeviceTemplateInput["mountStyle"],
                    iconKey:
                      event.target.value === "vertical-pdu"
                        ? "pdu-vertical"
                        : form.iconKey,
                    blocksBothFaces: event.target.value === "vertical-pdu" ? false : form.blocksBothFaces,
                    allowSharedDepth: event.target.value === "vertical-pdu" ? false : form.allowSharedDepth
                  })
                }
              >
                {mountStyleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="full-width">
              Icon
              <DeviceIconPicker value={form.iconKey} onChange={(next) => onFormChange({ ...form, iconKey: next })} />
            </label>
            <label>
              Template Name
              <input value={form.name} onChange={(event) => onFormChange({ ...form, name: event.target.value })} />
            </label>
            <label>
              Default manufacturer
              <input value={form.manufacturer} onChange={(event) => onFormChange({ ...form, manufacturer: event.target.value })} />
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
                disabled={form.mountStyle === "vertical-pdu"}
                type="checkbox"
                onChange={(event) =>
                  onFormChange({
                    ...form,
                    blocksBothFaces: event.target.checked,
                    allowSharedDepth: event.target.checked ? false : form.allowSharedDepth
                  })
                }
              />
            </label>
            <label className="checkbox-field full-width">
              Allow shared depth shelf placement
              <input
                checked={form.allowSharedDepth}
                disabled={form.mountStyle === "vertical-pdu" || form.blocksBothFaces}
                type="checkbox"
                onChange={(event) => onFormChange({ ...form, allowSharedDepth: event.target.checked })}
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
              <article className="admin-template-card with-icon" key={template.id}>
                <img alt="" aria-hidden="true" className="admin-template-icon" src={getDeviceIconUrl(template.iconKey)} />
                <div>
                  <strong>{template.name}</strong>
                  <span>
                    {formatTemplateType(template.templateType)} | {template.defaultHeightU}U
                  </span>
                  <span>
                    {template.manufacturer} | {template.model} |{" "}
                    {template.mountStyle === "vertical-pdu"
                      ? "Vertical PDU"
                      : template.blocksBothFaces
                        ? "Front + Rear"
                        : template.allowSharedDepth
                          ? "Shared depth"
                          : "Single side"}
                  </span>
                </div>
                <div className="template-actions">
                  <button
                    className="ghost-button"
                    onClick={() => {
                      setEditingTemplateId(template.id);
                      setEditingForm(toTemplateForm(template));
                    }}
                    type="button"
                  >
                    Edit
                  </button>
                  <button className="ghost-button" onClick={() => onDeleteTemplate(template.id)} type="button">
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      {editingTemplate && editingForm ? (
        <div
          className="audit-edit-modal-backdrop"
          onClick={() => {
            setEditingTemplateId(null);
            setEditingForm(null);
          }}
          role="presentation"
        >
          <section className="panel audit-edit-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="audit-edit-topbar">
              <div className="audit-edit-heading">
                <p className="eyebrow">Edit Template</p>
                <h2>{editingTemplate.name}</h2>
                <p className="audit-edit-copy">Adjust the assigned icon and default template metadata.</p>
              </div>
              <button
                className="ghost-button"
                onClick={() => {
                  setEditingTemplateId(null);
                  setEditingForm(null);
                }}
                type="button"
              >
                Close
              </button>
            </div>

            <form
              className="audit-edit-grid clean"
              onSubmit={(event) => {
                event.preventDefault();
                void onUpdateTemplate(editingTemplate.id, editingForm);
                setEditingTemplateId(null);
                setEditingForm(null);
              }}
            >
              <label>
                Device type
                <select
                  value={editingForm.templateType}
                  onChange={(event) => setEditingForm(applyTemplateTypeToForm(event.target.value, editingForm))}
                >
                  {templateTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mounting
                <select
                  value={editingForm.mountStyle}
                  onChange={(event) =>
                    setEditingForm({
                      ...editingForm,
                      templateType: event.target.value === "vertical-pdu" ? "pdu" : editingForm.templateType,
                      mountStyle: event.target.value as DeviceTemplateInput["mountStyle"],
                      iconKey: event.target.value === "vertical-pdu" ? "pdu-vertical" : editingForm.iconKey,
                      blocksBothFaces: event.target.value === "vertical-pdu" ? false : editingForm.blocksBothFaces,
                      allowSharedDepth: event.target.value === "vertical-pdu" ? false : editingForm.allowSharedDepth
                    })
                  }
                >
                  {mountStyleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full-width">
                Icon
                <DeviceIconPicker value={editingForm.iconKey} onChange={(next) => setEditingForm({ ...editingForm, iconKey: next })} />
              </label>
              <label>
                Template Name
                <input value={editingForm.name} onChange={(event) => setEditingForm({ ...editingForm, name: event.target.value })} />
              </label>
              <label>
                Default manufacturer
                <input
                  value={editingForm.manufacturer}
                  onChange={(event) => setEditingForm({ ...editingForm, manufacturer: event.target.value })}
                />
              </label>
              <label>
                Default model
                <input value={editingForm.model} onChange={(event) => setEditingForm({ ...editingForm, model: event.target.value })} />
              </label>
              <label>
                Height U
                <input
                  min={1}
                  type="number"
                  value={editingForm.defaultHeightU}
                  onChange={(event) => setEditingForm({ ...editingForm, defaultHeightU: Number(event.target.value) })}
                />
              </label>
              <label className="checkbox-field full-width">
                Blocks front and rear
                <input
                  checked={editingForm.blocksBothFaces}
                  disabled={editingForm.mountStyle === "vertical-pdu"}
                  type="checkbox"
                  onChange={(event) =>
                    setEditingForm({
                      ...editingForm,
                      blocksBothFaces: event.target.checked,
                      allowSharedDepth: event.target.checked ? false : editingForm.allowSharedDepth
                    })
                  }
                />
              </label>
              <label className="checkbox-field full-width">
                Allow shared depth shelf placement
                <input
                  checked={editingForm.allowSharedDepth}
                  disabled={editingForm.mountStyle === "vertical-pdu" || editingForm.blocksBothFaces}
                  type="checkbox"
                  onChange={(event) => setEditingForm({ ...editingForm, allowSharedDepth: event.target.checked })}
                />
              </label>

              <div className="audit-edit-actions full-width">
                <button
                  className="ghost-button"
                  onClick={() => {
                    setEditingTemplateId(null);
                    setEditingForm(null);
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Save template
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
