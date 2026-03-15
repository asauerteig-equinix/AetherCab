import { useMemo, useState, type FormEvent } from "react";
import { getDefaultIconKeyForTemplateType, getDeviceIconUrl } from "../deviceIcons";
import type { DeviceType, DeviceTypeInput, DeviceTemplate, DeviceTemplateInput } from "../../shared/types";
import { DeviceIconPicker } from "./DeviceIconPicker";

interface AdminTemplatesPageProps {
  deviceTypes: DeviceType[];
  templates: DeviceTemplate[];
  deviceTypeForm: DeviceTypeInput;
  form: DeviceTemplateInput;
  saving: boolean;
  onDeviceTypeFormChange(next: DeviceTypeInput): void;
  onFormChange(next: DeviceTemplateInput): void;
  onCreateDeviceType(): void;
  onCreateTemplate(event: FormEvent<HTMLFormElement>): void;
  onUpdateDeviceType(deviceTypeId: number, next: DeviceTypeInput): void;
  onDeleteDeviceType(deviceTypeId: number): void;
  onUpdateTemplate(templateId: number, next: DeviceTemplateInput): void;
  onDeleteTemplate(templateId: number): void;
}

type AdminCreateMode = "template" | "device-type";

const mountStyleOptions = [
  { value: "full", label: "Standard rack device" },
  { value: "vertical-pdu", label: "Vertical rear PDU" }
] as const;

function formatTemplateType(templateType: string, deviceTypes: DeviceType[]): string {
  return deviceTypes.find((deviceType) => deviceType.key === templateType)?.label ?? templateType;
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

function toDeviceTypeForm(deviceType: DeviceType): DeviceTypeInput {
  return {
    key: deviceType.key,
    label: deviceType.label
  };
}

function applyTemplateTypeToForm(nextTemplateType: string, currentForm: DeviceTemplateInput): DeviceTemplateInput {
  return {
    ...currentForm,
    templateType: nextTemplateType,
    mountStyle: currentForm.mountStyle,
    iconKey: getDefaultIconKeyForTemplateType(nextTemplateType),
    blocksBothFaces: currentForm.mountStyle === "vertical-pdu" ? false : currentForm.blocksBothFaces,
    allowSharedDepth: currentForm.mountStyle === "vertical-pdu" ? false : currentForm.allowSharedDepth
  };
}

function getTemplatePlacementLabel(template: DeviceTemplate): string {
  if (template.mountStyle === "vertical-pdu") {
    return "Vertical PDU";
  }

  if (template.blocksBothFaces) {
    return "Front + Rear";
  }

  if (template.allowSharedDepth) {
    return "Shared depth";
  }

  return "Single side";
}

export function AdminTemplatesPage({
  deviceTypes,
  templates,
  deviceTypeForm,
  form,
  saving,
  onDeviceTypeFormChange,
  onFormChange,
  onCreateDeviceType,
  onCreateTemplate,
  onUpdateDeviceType,
  onDeleteDeviceType,
  onUpdateTemplate,
  onDeleteTemplate
}: AdminTemplatesPageProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<AdminCreateMode>("template");
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState<DeviceTemplateInput | null>(null);
  const [editingDeviceTypeId, setEditingDeviceTypeId] = useState<number | null>(null);
  const [editingDeviceTypeForm, setEditingDeviceTypeForm] = useState<DeviceTypeInput | null>(null);

  const editingTemplate = templates.find((template) => template.id === editingTemplateId) ?? null;
  const editingDeviceType = deviceTypes.find((deviceType) => deviceType.id === editingDeviceTypeId) ?? null;
  const templatesByType = useMemo(
    () =>
      deviceTypes.map((deviceType) => ({
        deviceType,
        templates: templates
          .filter((template) => template.templateType === deviceType.key)
          .sort((left, right) => left.name.localeCompare(right.name))
      })),
    [deviceTypes, templates]
  );

  const orphanTemplates = useMemo(
    () =>
      templates
        .filter((template) => !deviceTypes.some((deviceType) => deviceType.key === template.templateType))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [deviceTypes, templates]
  );

  return (
    <>
      <main className="admin-stack">
        <section className="panel admin-create-panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">Admin</p>
              <h2>Create assets</h2>
            </div>
            <button className="ghost-button" onClick={() => setCreateOpen((current) => !current)} type="button">
              {createOpen ? "Collapse" : "Create new"}
            </button>
          </div>

          {createOpen ? (
            <div className="admin-create-body">
              <div className="admin-mode-toggle">
                <button
                  className={createMode === "template" ? "face-toggle selected" : "face-toggle"}
                  onClick={() => setCreateMode("template")}
                  type="button"
                >
                  Create template
                </button>
                <button
                  className={createMode === "device-type" ? "face-toggle selected" : "face-toggle"}
                  onClick={() => setCreateMode("device-type")}
                  type="button"
                >
                  Create device type
                </button>
              </div>

              {createMode === "template" ? (
                <form className="create-rack-form overview-create-form" onSubmit={onCreateTemplate}>
                  <label>
                    Device type
                    <select
                      disabled={deviceTypes.length === 0}
                      value={form.templateType}
                      onChange={(event) => {
                        onFormChange(applyTemplateTypeToForm(event.target.value, form));
                      }}
                    >
                      {deviceTypes.map((deviceType) => (
                        <option key={deviceType.id} value={deviceType.key}>
                          {deviceType.label}
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
                          mountStyle: event.target.value as DeviceTemplateInput["mountStyle"],
                          iconKey: event.target.value === "vertical-pdu" ? "pdu-vertical" : form.iconKey,
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
                    Template name
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
                  <button className="primary-button" disabled={saving || deviceTypes.length === 0} type="submit">
                    Create template
                  </button>
                </form>
              ) : (
                <form
                  className="create-rack-form overview-create-form compact-admin-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onCreateDeviceType();
                  }}
                >
                  <label>
                    Type label
                    <input
                      value={deviceTypeForm.label}
                      onChange={(event) => {
                        const nextLabel = event.target.value;
                        onDeviceTypeFormChange({
                          label: nextLabel,
                          key:
                            deviceTypeForm.key ||
                            nextLabel
                              .trim()
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, "-")
                              .replace(/^-+|-+$/g, "")
                        });
                      }}
                    />
                  </label>
                  <label>
                    Type key
                    <input
                      value={deviceTypeForm.key}
                      onChange={(event) => onDeviceTypeFormChange({ ...deviceTypeForm, key: event.target.value })}
                    />
                  </label>
                  <button className="primary-button" disabled={saving} type="submit">
                    Create device type
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </section>

        <section className="panel admin-device-types-panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">Device Types</p>
              <h2>Available types</h2>
            </div>
            <span className="muted">{deviceTypes.length} types</span>
          </div>

          <div className="admin-device-type-list">
            {deviceTypes.map((deviceType) => {
              const templateCount = templates.filter((template) => template.templateType === deviceType.key).length;

              return (
                <article className="admin-device-type-card" key={deviceType.id}>
                  <div>
                    <strong>{deviceType.label}</strong>
                    <span>{deviceType.key}</span>
                    <span>{`${templateCount} template${templateCount === 1 ? "" : "s"}`}</span>
                  </div>
                  <div className="template-actions compact">
                    <button
                      className="ghost-button"
                      onClick={() => {
                        setEditingDeviceTypeId(deviceType.id);
                        setEditingDeviceTypeForm(toDeviceTypeForm(deviceType));
                      }}
                      type="button"
                    >
                      Edit
                    </button>
                    <button className="ghost-button" disabled={saving} onClick={() => onDeleteDeviceType(deviceType.id)} type="button">
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="panel overview-panel admin-templates-panel centered">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">Templates</p>
              <h2>Current templates</h2>
            </div>
            <span className="muted">{templates.length} templates</span>
          </div>

          <div className="admin-template-groups">
            {templatesByType.map(({ deviceType, templates: groupedTemplates }) =>
              groupedTemplates.length > 0 ? (
                <section className="admin-template-group" key={deviceType.id}>
                  <div className="admin-template-group-header">
                    <strong>{deviceType.label}</strong>
                    <span>{`${groupedTemplates.length} template${groupedTemplates.length === 1 ? "" : "s"}`}</span>
                  </div>

                  <div className="admin-template-list">
                    {groupedTemplates.map((template) => (
                      <article className="admin-template-card with-icon" key={template.id}>
                        <img alt="" aria-hidden="true" className="admin-template-icon" src={getDeviceIconUrl(template.iconKey)} />
                        <div>
                          <strong>{template.name}</strong>
                          <span>{`${formatTemplateType(template.templateType, deviceTypes)} | ${template.defaultHeightU}U`}</span>
                          <span>{`${template.manufacturer} | ${template.model} | ${getTemplatePlacementLabel(template)}`}</span>
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
                          <button className="ghost-button" disabled={saving} onClick={() => onDeleteTemplate(template.id)} type="button">
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null
            )}

            {orphanTemplates.length > 0 ? (
              <section className="admin-template-group orphaned">
                <div className="admin-template-group-header">
                  <strong>Unassigned types</strong>
                  <span>{`${orphanTemplates.length} template${orphanTemplates.length === 1 ? "" : "s"}`}</span>
                </div>
                <div className="admin-template-list">
                  {orphanTemplates.map((template) => (
                    <article className="admin-template-card with-icon" key={template.id}>
                      <img alt="" aria-hidden="true" className="admin-template-icon" src={getDeviceIconUrl(template.iconKey)} />
                      <div>
                        <strong>{template.name}</strong>
                        <span>{`${template.templateType} | ${template.defaultHeightU}U`}</span>
                        <span>{`${template.manufacturer} | ${template.model} | ${getTemplatePlacementLabel(template)}`}</span>
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
                        <button className="ghost-button" disabled={saving} onClick={() => onDeleteTemplate(template.id)} type="button">
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
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
                  {deviceTypes.map((deviceType) => (
                    <option key={deviceType.id} value={deviceType.key}>
                      {deviceType.label}
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
                Template name
                <input value={editingForm.name} onChange={(event) => setEditingForm({ ...editingForm, name: event.target.value })} />
              </label>
              <label>
                Default manufacturer
                <input value={editingForm.manufacturer} onChange={(event) => setEditingForm({ ...editingForm, manufacturer: event.target.value })} />
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

      {editingDeviceType && editingDeviceTypeForm ? (
        <div
          className="audit-edit-modal-backdrop"
          onClick={() => {
            setEditingDeviceTypeId(null);
            setEditingDeviceTypeForm(null);
          }}
          role="presentation"
        >
          <section className="panel rack-edit-modal" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="audit-edit-topbar">
              <div className="audit-edit-heading">
                <p className="eyebrow">Edit Device Type</p>
                <h2>{editingDeviceType.label}</h2>
              </div>
            </div>
            <form
              className="audit-edit-grid clean"
              onSubmit={(event) => {
                event.preventDefault();
                void onUpdateDeviceType(editingDeviceType.id, editingDeviceTypeForm);
                setEditingDeviceTypeId(null);
                setEditingDeviceTypeForm(null);
              }}
            >
              <label>
                Type label
                <input
                  value={editingDeviceTypeForm.label}
                  onChange={(event) => setEditingDeviceTypeForm({ ...editingDeviceTypeForm, label: event.target.value })}
                />
              </label>
              <label>
                Type key
                <input
                  value={editingDeviceTypeForm.key}
                  onChange={(event) => setEditingDeviceTypeForm({ ...editingDeviceTypeForm, key: event.target.value })}
                />
              </label>
              <div className="audit-edit-actions full-width">
                <button
                  className="ghost-button"
                  onClick={() => {
                    setEditingDeviceTypeId(null);
                    setEditingDeviceTypeForm(null);
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  Save device type
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
