import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { getAnchoredStartUnit } from "../shared/rack";
import type {
  DeviceTemplate,
  DeviceTemplateInput,
  RackFace,
  RackCreateInput,
  RackDetail,
  RackDevice,
  RackDeviceInput,
  RackSummary
} from "../shared/types";
import { api } from "./api";
import { AdminTemplatesPage } from "./components/AdminTemplatesPage";
import { Inspector } from "./components/Inspector";
import { OverviewPage } from "./components/OverviewPage";
import { Palette } from "./components/Palette";
import { RackCanvas } from "./components/RackCanvas";
import { RackSwitcher } from "./components/RackSwitcher";

const initialRackCreateForm: RackCreateInput = {
  siteName: "",
  roomName: "",
  rackName: "",
  totalUnits: 42,
  notes: ""
};

const initialTemplateForm: DeviceTemplateInput = {
  templateType: "server",
  name: "",
  manufacturer: "Generic",
  model: "",
  defaultHeightU: 1,
  blocksBothFaces: false
};

function templateToRackDevice(
  template: DeviceTemplate,
  startUnit: number | null,
  placementType: "rack",
  rackFace: RackFace
): RackDeviceInput {
  return {
    placementType,
    rackFace,
    blocksBothFaces: template.blocksBothFaces,
    startUnit,
    heightU: template.defaultHeightU,
    name: template.name,
    manufacturer: template.manufacturer,
    model: template.model,
    serialNumber: null,
    hostname: null,
    notes: null,
    storageLocation: null
  };
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const [racks, setRacks] = useState<RackSummary[]>([]);
  const [activeRackId, setActiveRackId] = useState<number | null>(null);
  const [rackDetail, setRackDetail] = useState<RackDetail | null>(null);
  const [templates, setTemplates] = useState<DeviceTemplate[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [activeRackFace, setActiveRackFace] = useState<RackFace>("front");
  const [auditSearch, setAuditSearch] = useState("");
  const [message, setMessage] = useState("Loading workspace...");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState<RackCreateInput>(initialRackCreateForm);
  const [templateForm, setTemplateForm] = useState<DeviceTemplateInput>(initialTemplateForm);

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

  useEffect(() => {
    if (!rackDetail || selectedDeviceId === null) {
      return;
    }

    const selectedDevice = rackDetail.devices.find((device) => device.id === selectedDeviceId);
    if (!selectedDevice || selectedDevice.placementType !== "rack") {
      return;
    }

    const isVisibleOnFace =
      selectedDevice.blocksBothFaces || selectedDevice.rackFace === null || selectedDevice.rackFace === activeRackFace;

    if (!isVisibleOnFace) {
      setSelectedDeviceId(null);
    }
  }, [activeRackFace, rackDetail, selectedDeviceId]);

  function navigate(path: "/" | "/audits" | "/admin") {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
  }

  function openAudit(rackId: number) {
    setActiveRackId(rackId);
    navigate("/audits");
  }

  async function loadInitialData() {
    try {
      const [rackList, templateList] = await Promise.all([api.listRacks(), api.listTemplates()]);
      setRacks(rackList);
      setTemplates(templateList);
      if (rackList.length > 0) {
        setActiveRackId(rackList[0].id);
      } else {
        setMessage("Erstelle das erste Audit, um mit der Dokumentation zu beginnen.");
      }
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Initiale Daten konnten nicht geladen werden.");
    }
  }

  async function refreshTemplates() {
    setTemplates(await api.listTemplates());
  }

  async function loadRack(rackId: number) {
    try {
      const detail = await api.getRack(rackId);
      setRackDetail(detail);
      setSelectedDeviceId((current) => (current && detail.devices.some((device) => device.id === current) ? current : null));
      setMessage(`${detail.name} ist zur Bearbeitung geoeffnet.`);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Audit konnte nicht geladen werden.");
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

  const selectedDevice =
    rackDetail?.devices.find((device) => device.id === selectedDeviceId && device.placementType === "rack") ?? null;

  async function handleTemplateDrop(unit: number, templatePayload: string) {
    if (activeRackId === null || rackDetail === null) {
      return;
    }

    try {
      const template = JSON.parse(templatePayload) as DeviceTemplate;
      const anchoredStartUnit =
        template.defaultHeightU > 1
          ? getAnchoredStartUnit(
              unit,
              template.defaultHeightU,
              rackDetail.totalUnits,
              activeRackFace,
              template.blocksBothFaces,
              rackDetail.devices
            )
          : unit;

      if (anchoredStartUnit === null) {
        setError("Das Geraet passt von der angezielten Unit aus weder nach oben noch nach unten.");
        return;
      }

      setSaving(true);
      await api.createDevice(activeRackId, templateToRackDevice(template, anchoredStartUnit, "rack", activeRackFace));
      await loadRack(activeRackId);
      setMessage(`${template.name} wurde bei ${anchoredStartUnit}U platziert.`);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Geraet konnte nicht platziert werden.");
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
        rackFace: device.rackFace,
        blocksBothFaces: device.blocksBothFaces,
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
      setMessage(`${device.name} wurde auf ${nextStartUnit}U verschoben.`);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Geraet konnte nicht verschoben werden.");
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
      setError(saveError instanceof Error ? saveError.message : "Aenderungen konnten nicht gespeichert werden.");
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
      setMessage(`${selectedDevice.name} wurde entfernt.`);
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Element konnte nicht entfernt werden.");
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
      setMessage(`${rack.name} wurde erstellt.`);
      setError(null);
      navigate("/audits");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Audit konnte nicht erstellt werden.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSaving(true);
      const template = await api.createTemplate(templateForm);
      await refreshTemplates();
      setTemplateForm(initialTemplateForm);
      setMessage(`${template.name} wurde als Vorlage angelegt.`);
      setError(null);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Vorlage konnte nicht erstellt werden.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTemplate(templateId: number) {
    try {
      setSaving(true);
      await api.deleteTemplate(templateId);
      await refreshTemplates();
      setMessage("Vorlage wurde geloescht.");
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Vorlage konnte nicht geloescht werden.");
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
          Audits bearbeiten
        </button>
        <button className={currentPath === "/admin" ? "nav-link selected" : "nav-link"} onClick={() => navigate("/admin")} type="button">
          Admin
        </button>
      </nav>

      {currentPath === "/audits" ? (
        <header className="hero">
          <div>
            <p className="hero-kicker">AetherCab</p>
            <p className="hero-copy">
              Bestandsaufnahme fuer Racks mit klarem Einstieg: erst Audit waehlen oder anlegen, dann gezielt bearbeiten.
            </p>
          </div>
          <div className="hero-actions">
            <span className="status-pill">{saving ? "Speichere Datenbankstatus" : message}</span>
            {rackDetail ? (
              <div className="export-actions">
                <a href={api.excelExportUrl(rackDetail.id)}>Excel Export</a>
                <a href={api.pdfExportUrl(rackDetail.id)}>PDF Export</a>
              </div>
            ) : null}
          </div>
        </header>
      ) : null}

      {error ? <div className="error-banner">{error}</div> : null}

      {currentPath === "/" ? (
        <OverviewPage
          racks={racks}
          searchValue={auditSearch}
          createForm={createForm}
          templateCount={templates.length}
          onSearchChange={setAuditSearch}
          onOpenAudit={openAudit}
          onCreateFormChange={setCreateForm}
          onCreateAudit={(event) => {
            void handleCreateRack(event);
          }}
        />
      ) : currentPath === "/admin" ? (
        <AdminTemplatesPage
          templates={templates}
          form={templateForm}
          onFormChange={setTemplateForm}
          onCreateTemplate={(event) => {
            void handleCreateTemplate(event);
          }}
          onDeleteTemplate={(templateId) => {
            void handleDeleteTemplate(templateId);
          }}
        />
      ) : (
        <main className="workspace-grid">
          <RackSwitcher rack={rackDetail} onBackToOverview={() => navigate("/")} />

          <div className="editor-column">
            {rackDetail ? (
              <RackCanvas
                rack={rackDetail}
                activeRackFace={activeRackFace}
                selectedDeviceId={selectedDeviceId}
                onSelectDevice={setSelectedDeviceId}
                onRackFaceChange={setActiveRackFace}
                onTemplateDrop={(unit, templatePayload) => {
                  void handleTemplateDrop(unit, templatePayload);
                }}
                onDeviceMove={(device, nextStartUnit) => {
                  void handleDeviceMove(device, nextStartUnit);
                }}
              />
            ) : (
              <section className="panel empty-state-panel">
                <p className="eyebrow">Audit Bearbeitung</p>
                <h2>Kein Audit geoeffnet</h2>
                <p>Bitte waehle in der Uebersicht ein Audit aus oder lege ein neues Audit an.</p>
              </section>
            )}
          </div>

          <div className="side-column">
            <Palette templates={templates} />
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
