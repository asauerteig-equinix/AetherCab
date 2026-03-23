import { useState } from "react";
import type { AuditDetail, RackCreateInput, RackUpdateInput } from "../../shared/types";

interface RackTabsProps {
  audit: AuditDetail | null;
  activeRackId: number | null;
  rackForm: RackUpdateInput;
  newRackForm: RackCreateInput;
  saving: boolean;
  readOnly: boolean;
  onSelectRack(rackId: number): void;
  onRackFormChange(next: RackUpdateInput): void;
  onSaveRack(): Promise<void>;
  onNewRackFormChange(next: RackCreateInput): void;
  onCreateRack(): Promise<void>;
  onDeleteRack(): Promise<void>;
}

const defaultRackCreateForm: RackCreateInput = {
  rackName: "",
  totalUnits: 47,
  widthMm: 600,
  depthMm: 1000,
  heightMm: 2200
};

interface RackFormValues {
  rackName: string;
  totalUnits: number;
  widthMm: number;
  depthMm: number;
  heightMm: number;
}

function getNextNumberInputValue(rawValue: string, currentValue: number): number {
  const nextValue = Number(rawValue);
  return Number.isNaN(nextValue) ? currentValue : nextValue;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function getSafeRackFormValues(form: RackFormValues, fallback: RackFormValues): RackFormValues {
  return {
    rackName: form.rackName,
    totalUnits: isPositiveInteger(form.totalUnits) ? form.totalUnits : fallback.totalUnits,
    widthMm: isPositiveInteger(form.widthMm) ? form.widthMm : fallback.widthMm,
    depthMm: isPositiveInteger(form.depthMm) ? form.depthMm : fallback.depthMm,
    heightMm: isPositiveInteger(form.heightMm) ? form.heightMm : fallback.heightMm
  };
}

export function RackTabs({
  audit,
  activeRackId,
  rackForm,
  newRackForm,
  saving,
  readOnly,
  onSelectRack,
  onRackFormChange,
  onSaveRack,
  onNewRackFormChange,
  onCreateRack,
  onDeleteRack
}: RackTabsProps) {
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [editorRackId, setEditorRackId] = useState<number | null>(null);
  const [deleteRackOpen, setDeleteRackOpen] = useState(false);
  const [deleteRackNameInput, setDeleteRackNameInput] = useState("");
  const [deleteRackConfirmed, setDeleteRackConfirmed] = useState(false);
  const activeRack = audit?.racks.find((rack) => rack.id === activeRackId) ?? null;
  const editorRack = audit?.racks.find((rack) => rack.id === editorRackId) ?? activeRack;
  const activeRackFormValues: RackFormValues = {
    rackName: activeRack?.name ?? "",
    totalUnits: activeRack?.totalUnits ?? defaultRackCreateForm.totalUnits,
    widthMm: activeRack?.widthMm ?? defaultRackCreateForm.widthMm,
    depthMm: activeRack?.depthMm ?? defaultRackCreateForm.depthMm,
    heightMm: activeRack?.heightMm ?? defaultRackCreateForm.heightMm
  };
  const editorRackFormValues: RackFormValues = {
    rackName: editorRack?.name ?? activeRackFormValues.rackName,
    totalUnits: editorRack?.totalUnits ?? activeRackFormValues.totalUnits,
    widthMm: editorRack?.widthMm ?? activeRackFormValues.widthMm,
    depthMm: editorRack?.depthMm ?? activeRackFormValues.depthMm,
    heightMm: editorRack?.heightMm ?? activeRackFormValues.heightMm
  };
  const safeNewRackForm = getSafeRackFormValues(newRackForm, activeRackFormValues);
  const safeRackForm = getSafeRackFormValues(rackForm, editorRackFormValues);

  function resetDeleteRackState() {
    setDeleteRackOpen(false);
    setDeleteRackNameInput("");
    setDeleteRackConfirmed(false);
  }

  function resetEditForm(rack = editorRack ?? activeRack) {
    if (!rack) {
      return;
    }

    onRackFormChange({
      rackName: rack.name,
      totalUnits: rack.totalUnits,
      widthMm: rack.widthMm,
      depthMm: rack.depthMm,
      heightMm: rack.heightMm
    });
  }

  function openCreateModal() {
    if (readOnly) {
      return;
    }

    onNewRackFormChange({
      rackName: "",
      totalUnits: activeRack?.totalUnits ?? defaultRackCreateForm.totalUnits,
      widthMm: activeRack?.widthMm ?? defaultRackCreateForm.widthMm,
      depthMm: activeRack?.depthMm ?? defaultRackCreateForm.depthMm,
      heightMm: activeRack?.heightMm ?? defaultRackCreateForm.heightMm
    });
    setEditorMode("create");
  }

  function openEditModal(rack = activeRack) {
    if (!rack || readOnly) {
      return;
    }

    setEditorRackId(rack.id);
    resetEditForm(rack);
    if (rack.id !== activeRackId) {
      onSelectRack(rack.id);
    }
    setEditorMode("edit");
  }

  async function handleRackSave() {
    await onSaveRack();
    setEditorRackId(null);
    setEditorMode(null);
  }

  async function handleRackCreate() {
    await onCreateRack();
    setEditorRackId(null);
    setEditorMode(null);
  }

  async function handleRackDelete() {
    await onDeleteRack();
    resetDeleteRackState();
  }

  if (!audit) {
    return null;
  }

  return (
    <>
      <section className="panel rack-tabs-panel">
        <div className="rack-tabs-header">
          <div>
            <p className="eyebrow">Racks In Audit</p>
            <h2>{audit.racks.length === 1 ? "Single rack" : `${audit.racks.length} racks`}</h2>
          </div>
          <div className="rack-tabs-actions">
            <button className="ghost-button" disabled={readOnly} onClick={openCreateModal} type="button">
              Add rack
            </button>
            <button className="ghost-button" disabled={!activeRack || readOnly} onClick={openEditModal} type="button">
              Edit rack
            </button>
            <button
              className="ghost-button danger"
              disabled={!activeRack || audit.racks.length <= 1 || saving || readOnly}
              onClick={() => setDeleteRackOpen(true)}
              type="button"
            >
              Delete rack
            </button>
          </div>
        </div>

        <div className="rack-tab-list">
          {audit.racks.map((rack) => (
            <button
              className={rack.id === activeRackId ? "rack-tab selected" : "rack-tab"}
              key={rack.id}
              onDoubleClick={() => openEditModal(rack)}
              onClick={() => onSelectRack(rack.id)}
              type="button"
            >
              <strong>{rack.name}</strong>
              <span>{`${rack.totalUnits}U | ${rack.widthMm} x ${rack.depthMm} x ${rack.heightMm} mm`}</span>
            </button>
          ))}
        </div>
      </section>

      {editorMode ? (
        <div
          className="audit-edit-modal-backdrop"
              onClick={() => {
                if (saving) {
                  return;
                }

                if (editorMode === "edit") {
                  resetEditForm();
                } else {
                  onNewRackFormChange({
                    rackName: "",
                    totalUnits: activeRack?.totalUnits ?? defaultRackCreateForm.totalUnits,
                    widthMm: activeRack?.widthMm ?? defaultRackCreateForm.widthMm,
                    depthMm: activeRack?.depthMm ?? defaultRackCreateForm.depthMm,
                    heightMm: activeRack?.heightMm ?? defaultRackCreateForm.heightMm
                  });
                }

                setEditorRackId(null);
                setEditorMode(null);
          }}
          role="presentation"
        >
          <section
            aria-modal="true"
            className="panel audit-edit-modal rack-edit-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="audit-edit-topbar">
              <div className="audit-edit-heading">
                <p className="eyebrow">{editorMode === "create" ? "New Rack" : "Edit Rack"}</p>
                <h2>{editorMode === "create" ? audit.name : editorRack?.name ?? "Rack"}</h2>
                <p className="audit-edit-copy">
                  {editorMode === "create"
                    ? "Add another rack to the current audit."
                    : "Update the selected rack without leaving the editor."}
                </p>
              </div>
              <button
                className="ghost-button"
                disabled={saving}
                onClick={() => {
                  if (editorMode === "edit") {
                    resetEditForm();
                  } else {
                    onNewRackFormChange({
                      rackName: "",
                      totalUnits: activeRack?.totalUnits ?? defaultRackCreateForm.totalUnits,
                      widthMm: activeRack?.widthMm ?? defaultRackCreateForm.widthMm,
                      depthMm: activeRack?.depthMm ?? defaultRackCreateForm.depthMm,
                      heightMm: activeRack?.heightMm ?? defaultRackCreateForm.heightMm
                    });
                  }
                  setEditorRackId(null);
                  setEditorMode(null);
                }}
                type="button"
              >
                Close
              </button>
            </div>

            {editorMode === "create" ? (
              <form
                className="audit-edit-grid clean"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleRackCreate();
                }}
              >
                <label className="audit-edit-field plain">
                  <span>Rack Name</span>
                  <input
                    disabled={readOnly}
                    value={safeNewRackForm.rackName}
                    onChange={(event) => onNewRackFormChange({ ...safeNewRackForm, rackName: event.target.value })}
                  />
                </label>
                <label className="audit-edit-field plain">
                  <span>Rack Units</span>
                  <input
                    disabled={readOnly}
                    min={1}
                    type="number"
                    value={safeNewRackForm.totalUnits}
                    onChange={(event) =>
                      onNewRackFormChange({
                        ...safeNewRackForm,
                        totalUnits: getNextNumberInputValue(event.target.value, safeNewRackForm.totalUnits)
                      })
                    }
                  />
                </label>
                <label className="audit-edit-field plain">
                  <span>Width (mm)</span>
                  <input
                    disabled={readOnly}
                    min={1}
                    type="number"
                    value={safeNewRackForm.widthMm}
                    onChange={(event) =>
                      onNewRackFormChange({
                        ...safeNewRackForm,
                        widthMm: getNextNumberInputValue(event.target.value, safeNewRackForm.widthMm)
                      })
                    }
                  />
                </label>
                <label className="audit-edit-field plain">
                  <span>Depth (mm)</span>
                  <input
                    disabled={readOnly}
                    min={1}
                    type="number"
                    value={safeNewRackForm.depthMm}
                    onChange={(event) =>
                      onNewRackFormChange({
                        ...safeNewRackForm,
                        depthMm: getNextNumberInputValue(event.target.value, safeNewRackForm.depthMm)
                      })
                    }
                  />
                </label>
                <label className="audit-edit-field plain">
                  <span>Height (mm)</span>
                  <input
                    disabled={readOnly}
                    min={1}
                    type="number"
                    value={safeNewRackForm.heightMm}
                    onChange={(event) =>
                      onNewRackFormChange({
                        ...safeNewRackForm,
                        heightMm: getNextNumberInputValue(event.target.value, safeNewRackForm.heightMm)
                      })
                    }
                  />
                </label>

                <div className="audit-edit-actions full-width">
                  <button
                    className="ghost-button"
                    disabled={saving}
                    onClick={() => {
                      onNewRackFormChange({
                        rackName: "",
                        totalUnits: activeRack?.totalUnits ?? defaultRackCreateForm.totalUnits,
                        widthMm: activeRack?.widthMm ?? defaultRackCreateForm.widthMm,
                        depthMm: activeRack?.depthMm ?? defaultRackCreateForm.depthMm,
                        heightMm: activeRack?.heightMm ?? defaultRackCreateForm.heightMm
                      });
                      setEditorRackId(null);
                      setEditorMode(null);
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button className="primary-button" disabled={saving} type="submit">
                    {saving ? "Saving..." : "Create rack"}
                  </button>
                </div>
              </form>
            ) : (
              <form
                className="audit-edit-grid clean"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleRackSave();
                }}
              >
                <label className="audit-edit-field plain">
                  <span>Rack Name</span>
                  <input
                    disabled={readOnly}
                    value={safeRackForm.rackName}
                    onChange={(event) => onRackFormChange({ ...safeRackForm, rackName: event.target.value })}
                  />
                </label>
                <label className="audit-edit-field plain">
                  <span>Rack Units</span>
                  <input
                    disabled={readOnly}
                    min={1}
                    type="number"
                    value={safeRackForm.totalUnits}
                    onChange={(event) =>
                      onRackFormChange({
                        ...safeRackForm,
                        totalUnits: getNextNumberInputValue(event.target.value, safeRackForm.totalUnits)
                      })
                    }
                  />
                </label>
                <label className="audit-edit-field plain">
                  <span>Width (mm)</span>
                  <input
                    disabled={readOnly}
                    min={1}
                    type="number"
                    value={safeRackForm.widthMm}
                    onChange={(event) =>
                      onRackFormChange({
                        ...safeRackForm,
                        widthMm: getNextNumberInputValue(event.target.value, safeRackForm.widthMm)
                      })
                    }
                  />
                </label>
                <label className="audit-edit-field plain">
                  <span>Depth (mm)</span>
                  <input
                    disabled={readOnly}
                    min={1}
                    type="number"
                    value={safeRackForm.depthMm}
                    onChange={(event) =>
                      onRackFormChange({
                        ...safeRackForm,
                        depthMm: getNextNumberInputValue(event.target.value, safeRackForm.depthMm)
                      })
                    }
                  />
                </label>
                <label className="audit-edit-field plain">
                  <span>Height (mm)</span>
                  <input
                    disabled={readOnly}
                    min={1}
                    type="number"
                    value={safeRackForm.heightMm}
                    onChange={(event) =>
                      onRackFormChange({
                        ...safeRackForm,
                        heightMm: getNextNumberInputValue(event.target.value, safeRackForm.heightMm)
                      })
                    }
                  />
                </label>
                <p className="rack-edit-note full-width">
                  Rack units can only be reduced when no placed device would exceed the new height in U.
                </p>

                <div className="audit-edit-actions full-width">
                  <button
                    className="ghost-button"
                    disabled={saving}
                    onClick={() => {
                      resetEditForm();
                      setEditorRackId(null);
                      setEditorMode(null);
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button className="primary-button" disabled={saving} type="submit">
                    {saving ? "Saving..." : "Save rack"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}

      {deleteRackOpen && activeRack ? (
        <div
          className="audit-edit-modal-backdrop"
          onClick={() => {
            if (!saving) {
              resetDeleteRackState();
            }
          }}
          role="presentation"
        >
          <section
            aria-modal="true"
            className="panel rack-edit-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="audit-edit-topbar">
              <div className="audit-edit-heading">
                <p className="eyebrow">Delete Rack</p>
                <h2>{activeRack.name}</h2>
                <p className="audit-edit-copy">This permanently removes the rack and every device inside it. This action cannot be undone.</p>
              </div>
              <button className="ghost-button" disabled={saving} onClick={resetDeleteRackState} type="button">
                Close
              </button>
            </div>

            <div className="audit-delete-section">
              <div className="audit-delete-copy">
                <strong>Delete rack permanently</strong>
                <p>{`Rack "${activeRack.name}" will be removed from audit "${audit.name}" together with all placed and staged devices.`}</p>
              </div>
              <label className="audit-edit-field plain full-width">
                <span>Type Rack Name to confirm</span>
                <input value={deleteRackNameInput} onChange={(event) => setDeleteRackNameInput(event.target.value)} />
              </label>
              <label className="audit-delete-checkbox">
                <input checked={deleteRackConfirmed} type="checkbox" onChange={(event) => setDeleteRackConfirmed(event.target.checked)} />
                <span>I understand that this deletion cannot be reversed.</span>
              </label>
              <div className="audit-edit-actions">
                <button className="ghost-button" disabled={saving} onClick={resetDeleteRackState} type="button">
                  Cancel
                </button>
                <button
                  className="ghost-button danger"
                  disabled={saving || deleteRackNameInput.trim() !== activeRack.name || !deleteRackConfirmed}
                  onClick={() => {
                    void handleRackDelete();
                  }}
                  type="button"
                >
                  Delete rack permanently
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
