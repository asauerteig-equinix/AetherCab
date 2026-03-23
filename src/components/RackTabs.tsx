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

function getNextNumberInputValue(rawValue: string, currentValue: number): number {
  const nextValue = Number(rawValue);
  return Number.isNaN(nextValue) ? currentValue : nextValue;
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
                    value={newRackForm.rackName}
                    onChange={(event) => onNewRackFormChange({ ...newRackForm, rackName: event.target.value })}
                  />
                </label>
                <label className="audit-edit-field plain">
                  <span>Rack Units</span>
                  <input
                    disabled={readOnly}
                    min={1}
                    type="number"
                    value={newRackForm.totalUnits}
                    onChange={(event) =>
                      onNewRackFormChange({
                        ...newRackForm,
                        totalUnits: getNextNumberInputValue(event.target.value, newRackForm.totalUnits)
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
                    value={newRackForm.widthMm}
                    onChange={(event) =>
                      onNewRackFormChange({
                        ...newRackForm,
                        widthMm: getNextNumberInputValue(event.target.value, newRackForm.widthMm)
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
                    value={newRackForm.depthMm}
                    onChange={(event) =>
                      onNewRackFormChange({
                        ...newRackForm,
                        depthMm: getNextNumberInputValue(event.target.value, newRackForm.depthMm)
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
                    value={newRackForm.heightMm}
                    onChange={(event) =>
                      onNewRackFormChange({
                        ...newRackForm,
                        heightMm: getNextNumberInputValue(event.target.value, newRackForm.heightMm)
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
                    value={rackForm.rackName}
                    onChange={(event) => onRackFormChange({ ...rackForm, rackName: event.target.value })}
                  />
                </label>
                <label className="audit-edit-field plain">
                  <span>Rack Units</span>
                  <input
                    disabled={readOnly}
                    min={1}
                    type="number"
                    value={rackForm.totalUnits}
                    onChange={(event) =>
                      onRackFormChange({
                        ...rackForm,
                        totalUnits: getNextNumberInputValue(event.target.value, rackForm.totalUnits)
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
                    value={rackForm.widthMm}
                    onChange={(event) =>
                      onRackFormChange({
                        ...rackForm,
                        widthMm: getNextNumberInputValue(event.target.value, rackForm.widthMm)
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
                    value={rackForm.depthMm}
                    onChange={(event) =>
                      onRackFormChange({
                        ...rackForm,
                        depthMm: getNextNumberInputValue(event.target.value, rackForm.depthMm)
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
                    value={rackForm.heightMm}
                    onChange={(event) =>
                      onRackFormChange({
                        ...rackForm,
                        heightMm: getNextNumberInputValue(event.target.value, rackForm.heightMm)
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
