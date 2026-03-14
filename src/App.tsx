import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type { DeviceTemplate, RackCreateInput, RackDetail, RackDevice, RackDeviceInput, RackSummary } from "../shared/types";
import { api } from "./api";
import { Inspector } from "./components/Inspector";
import { OverviewPage } from "./components/OverviewPage";
import { Palette } from "./components/Palette";
import { RackCanvas } from "./components/RackCanvas";
import { RackSwitcher } from "./components/RackSwitcher";
import { SparePartsPanel } from "./components/SparePartsPanel";

const initialRackCreateForm: RackCreateInput = {
  siteName: "",
  roomName: "",
  rackName: "",
  totalUnits: 42,
  notes: ""
};

function templateToRackDevice(template: DeviceTemplate, startUnit: number | null, placementType: "rack" | "spare"): RackDeviceInput {
  return {
    placementType,
    startUnit,
    heightU: template.defaultHeightU,
    name: template.name,
    manufacturer: template.manufacturer,
    model: template.model,
    serialNumber: null,
    hostname: null,
    notes: null,
    storageLocation: placementType === "spare" ? "Accessory box" : null
  };
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const [racks, setRacks] = useState<RackSummary[]>([]);
  const [activeRackId, setActiveRackId] = useState<number | null>(null);
  const [rackDetail, setRackDetail] = useState<RackDetail | null>(null);
  const [templates, setTemplates] = useState<DeviceTemplate[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [auditSearch, setAuditSearch] = useState("");
  const [message, setMessage] = useState("Loading workspace...");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState<RackCreateInput>(initialRackCreateForm);

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    function handlePopState() {
      setCurrentPath(window.location.pathname);
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (activeRackId !== null) {
      void loadRack(activeRackId);
    }
  }, [activeRackId]);

  function navigate(path: "/" | "/audits") {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
  }

  async function loadInitialData() {
    try {
      const [rackList, templateList] = await Promise.all([api.listRacks(), api.listTemplates()]);
      setRacks(rackList);
      setTemplates(templateList);
      if (rackList.length > 0) {
        setActiveRackId(rackList[0].id);
      } else {
        setMessage("Create the first rack to start documenting inventory.");
      }
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load initial data.");
    }
  }

  async function loadRack(rackId: number) {
    try {
      const detail = await api.getRack(rackId);
      setRackDetail(detail);
      setSelectedDeviceId((current) => (current && detail.devices.some((device) => device.id === current) ? current : null));
      setMessage(`${detail.name} ready for documentation.`);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load rack.");
    }
  }

  async function refreshRackList(selectRackId?: number) {
    const rackList = await api.listRacks();
    setRacks(rackList);
    if (selectRackId !== undefined) {
      setActiveRackId(selectRackId);
    } else if (activeRackId === null && rackList.length > 0) {
      setActiveRackId(rackList[0].id);
    }
  }

  const selectedDevice = rackDetail?.devices.find((device) => device.id === selectedDeviceId) ?? null;
  const spareParts = rackDetail?.devices.filter((device) => device.placementType === "spare") ?? [];

  async function handleTemplateDrop(unit: number, templatePayload: string) {
    if (activeRackId === null) {
      return;
    }

    try {
      const template = JSON.parse(templatePayload) as DeviceTemplate;
      setSaving(true);
      await api.createDevice(activeRackId, templateToRackDevice(template, unit, "rack"));
      await loadRack(activeRackId);
      setMessage(`Placed ${template.name} at ${unit}U.`);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to place device.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSpare(template: DeviceTemplate) {
    if (activeRackId === null) {
      return;
    }

    try {
      setSaving(true);
      await api.createDevice(activeRackId, templateToRackDevice(template, null, "spare"));
      await loadRack(activeRackId);
      setMessage(`Added ${template.name} as spare part.`);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to add spare part.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeviceMove(device: RackDevice, nextStartUnit: number) {
    if (activeRackId === null) {
      return;
    }

    try {
      setSaving(true);
      await api.updateDevice(activeRackId, device.id, {
        placementType: "rack",
        startUnit: nextStartUnit,
        heightU: device.heightU,
        name: device.name,
        manufacturer: device.manufacturer,
        model: device.model,
        serialNumber: device.serialNumber,
        hostname: device.hostname,
        notes: device.notes,
        storageLocation: null
      });
      await loadRack(activeRackId);
      setMessage(`Moved ${device.name} to ${nextStartUnit}U.`);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to move device.");
    } finally {
      setSaving(false);
    }
  }

  async function handleInspectorChange(next: RackDeviceInput) {
    if (activeRackId === null || selectedDevice === null) {
      return;
    }

    try {
      setSaving(true);
      const updatedDevice = await api.updateDevice(activeRackId, selectedDevice.id, next);
      setRackDetail((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          devices: current.devices.map((device) => (device.id === updatedDevice.id ? updatedDevice : device))
        };
      });
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDevice() {
    if (activeRackId === null || selectedDevice === null) {
      return;
    }

    try {
      setSaving(true);
      await api.deleteDevice(activeRackId, selectedDevice.id);
      setSelectedDeviceId(null);
      await loadRack(activeRackId);
      setMessage(`${selectedDevice.name} removed.`);
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to remove device.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateRack(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSaving(true);
      const rack = await api.createRack(createForm);
      await refreshRackList(rack.id);
      setCreateForm(initialRackCreateForm);
      setMessage(`Created ${rack.name}.`);
      setError(null);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create rack.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <button className={currentPath === "/" ? "nav-link selected" : "nav-link"} onClick={() => navigate("/")} type="button">
          Uebersicht
        </button>
        <button
          className={currentPath === "/audits" ? "nav-link selected" : "nav-link"}
          onClick={() => navigate("/audits")}
          type="button"
        >
          Rack Audits
        </button>
      </nav>

      <header className="hero">
        <div>
          <p className="hero-kicker">AetherCab</p>
          <p className="hero-copy">
            Visual rack inventory for teams that need a clear starting point before opening or creating an audit.
          </p>
        </div>
        <div className="hero-actions">
          <span className="status-pill">{saving ? "Syncing database" : message}</span>
          {rackDetail ? (
            <div className="export-actions">
              <a href={api.excelExportUrl(rackDetail.id)}>Excel export</a>
              <a href={api.pdfExportUrl(rackDetail.id)}>PDF export</a>
            </div>
          ) : null}
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      {currentPath === "/" ? (
        <OverviewPage auditCount={racks.length} templateCount={templates.length} onOpenAudits={() => navigate("/audits")} />
      ) : (
        <main className="workspace-grid">
          <RackSwitcher
            racks={racks}
            activeRackId={activeRackId}
            searchValue={auditSearch}
            onSelectRack={setActiveRackId}
            onSearchChange={setAuditSearch}
            createForm={createForm}
            onCreateFormChange={setCreateForm}
            onCreateRack={(event) => {
              void handleCreateRack(event);
            }}
          />

          <div className="editor-column">
            {rackDetail ? (
              <RackCanvas
                rack={rackDetail}
                selectedDeviceId={selectedDeviceId}
                onSelectDevice={setSelectedDeviceId}
                onTemplateDrop={(unit, templatePayload) => {
                  void handleTemplateDrop(unit, templatePayload);
                }}
                onDeviceMove={(device, nextStartUnit) => {
                  void handleDeviceMove(device, nextStartUnit);
                }}
              />
            ) : (
              <section className="panel empty-state-panel">
                <p className="eyebrow">Audit workspace</p>
                <h2>No audit selected</h2>
                <p>Select an existing audit or create a new one to start documenting a rack.</p>
              </section>
            )}
            <SparePartsPanel devices={spareParts} selectedDeviceId={selectedDeviceId} onSelectDevice={setSelectedDeviceId} />
          </div>

          <div className="side-column">
            <Palette
              templates={templates}
              onAddSpare={(template) => {
                void handleAddSpare(template);
              }}
            />
            <Inspector
              device={selectedDevice}
              onChange={(next) => {
                void handleInspectorChange(next);
              }}
              onDelete={() => {
                void handleDeleteDevice();
              }}
              saving={saving}
            />
          </div>
        </main>
      )}
    </div>
  );
}
