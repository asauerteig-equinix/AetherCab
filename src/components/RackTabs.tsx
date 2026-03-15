import { useState } from "react";
import type { AuditDetail, RackCreateInput, RackUpdateInput } from "../../shared/types";

interface RackTabsProps {
  audit: AuditDetail | null;
  activeRackId: number | null;
  rackForm: RackUpdateInput;
  newRackForm: RackCreateInput;
  saving: boolean;
  onSelectRack(rackId: number): void;
  onRackFormChange(next: RackUpdateInput): void;
  onSaveRack(): Promise<void>;
  onNewRackFormChange(next: RackCreateInput): void;
  onCreateRack(): Promise<void>;
  onDeleteRack(): Promise<void>;
}

const defaultRackCreateForm: RackCreateInput = {
  rackName: "",
  totalUnits: 42
};

export function RackTabs({
  audit,
  activeRackId,
  rackForm,
  newRackForm,
  saving,
  onSelectRack,
  onRackFormChange,
  onSaveRack,
  onNewRackFormChange,
  onCreateRack,
  onDeleteRack
}: RackTabsProps) {
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const activeRack = audit?.racks.find((rack) => rack.id === activeRackId) ?? null;

  function resetEditForm() {
    if (!activeRack) {
      return;
    }

    onRackFormChange({
      rackName: activeRack.name,
      totalUnits: activeRack.totalUnits
    });
  }

  function openCreateModal() {
    onNewRackFormChange({
      rackName: "",
      totalUnits: activeRack?.totalUnits ?? defaultRackCreateForm.totalUnits
    });
    setEditorMode("create");
  }

  function openEditModal() {
    if (!activeRack) {
      return;
    }

    resetEditForm();
    setEditorMode("edit");
  }

  async function handleRackSave() {
    await onSaveRack();
    setEditorMode(null);
  }

  async function handleRackCreate() {
    await onCreateRack();
    setEditorMode(null);
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
            <button className="ghost-button" onClick={openCreateModal} type="button">
              Add rack
            </button>
            <button className="ghost-button" disabled={!activeRack} onClick={openEditModal} type="button">
              Edit rack
            </button>
            <button
              className="ghost-button danger"
              disabled={!activeRack || audit.racks.length <= 1 || saving}
              onClick={() => {
                void onDeleteRack();
              }}
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
              onClick={() => onSelectRack(rack.id)}
              type="button"
            >
              <strong>{rack.name}</strong>
              <span>{rack.totalUnits}U</span>
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
                totalUnits: activeRack?.totalUnits ?? defaultRackCreateForm.totalUnits
              });
            }

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
                <h2>{editorMode === "create" ? audit.name : activeRack?.name ?? "Rack"}</h2>
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
                      totalUnits: activeRack?.totalUnits ?? defaultRackCreateForm.totalUnits
                    });
                  }
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
                    value={newRackForm.rackName}
                    onChange={(event) => onNewRackFormChange({ ...newRackForm, rackName: event.target.value })}
                  />
                </label>
                <label className="audit-edit-field plain">
                  <span>Rack Height</span>
                  <input
                    min={1}
                    type="number"
                    value={newRackForm.totalUnits}
                    onChange={(event) => onNewRackFormChange({ ...newRackForm, totalUnits: Number(event.target.value) })}
                  />
                </label>

                <div className="audit-edit-actions full-width">
                  <button
                    className="ghost-button"
                    disabled={saving}
                    onClick={() => {
                      onNewRackFormChange({
                        rackName: "",
                        totalUnits: activeRack?.totalUnits ?? defaultRackCreateForm.totalUnits
                      });
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
                  <input value={rackForm.rackName} onChange={(event) => onRackFormChange({ ...rackForm, rackName: event.target.value })} />
                </label>
                <label className="audit-edit-field plain">
                  <span>Rack Height</span>
                  <input
                    min={1}
                    type="number"
                    value={rackForm.totalUnits}
                    onChange={(event) => onRackFormChange({ ...rackForm, totalUnits: Number(event.target.value) })}
                  />
                </label>
                <p className="rack-edit-note full-width">
                  Rack height can only be reduced when no placed device would exceed the new height.
                </p>

                <div className="audit-edit-actions full-width">
                  <button
                    className="ghost-button"
                    disabled={saving}
                    onClick={() => {
                      resetEditForm();
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
    </>
  );
}
