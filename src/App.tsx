import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { getAnchoredStartUnit, getMountPositionFace, getRackMountPositionLabel, sortRackDevices } from "../shared/rack";
import type {
  AuditCreateInput,
  AuditDetail,
  AuditSummary,
  AuditUpdateInput,
  DeviceType,
  DeviceTypeInput,
  DeviceTemplate,
  DeviceTemplateInput,
  FeedbackInput,
  RackCreateInput,
  RackDetail,
  RackDevice,
  RackDeviceInput,
  RackFace,
  RackMountPosition,
  RackUpdateInput
} from "../shared/types";
import { api } from "./api";
import { AdminTemplatesPage } from "./components/AdminTemplatesPage";
import { FeedbackModal, FeedbackNavIcon } from "./components/FeedbackModal";
import { Inspector } from "./components/Inspector";
import { OverviewPage } from "./components/OverviewPage";
import { Palette } from "./components/Palette";
import { RackCanvas } from "./components/RackCanvas";
import { RackSwitcher } from "./components/RackSwitcher";
import { RackTabs } from "./components/RackTabs";
import { StagingArea } from "./components/StagingArea";

type RackViewMode = RackFace | "both";

function isRackViewMode(value: string | null): value is RackViewMode {
  return value === "front" || value === "rear" || value === "both";
}

function parseOptionalPositiveInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function readWorkspaceStateFromLocation(): {
  path: "/" | "/audits" | "/admin";
  auditId: number | null;
  rackId: number | null;
  rackView: RackViewMode;
} {
  const path = window.location.pathname === "/audits" || window.location.pathname === "/admin" ? window.location.pathname : "/";
  const searchParams = new URLSearchParams(window.location.search);

  return {
    path,
    auditId: path === "/audits" ? parseOptionalPositiveInteger(searchParams.get("audit")) : null,
    rackId: path === "/audits" ? parseOptionalPositiveInteger(searchParams.get("rack")) : null,
    rackView: path === "/audits" && isRackViewMode(searchParams.get("view")) ? searchParams.get("view") : "both"
  };
}

const initialAuditCreateForm: AuditCreateInput = {
  siteName: "",
  roomName: "",
  auditName: "",
  salesOrder: "",
  status: "created",
  initialRackName: "0101",
  initialRackUnits: 47,
  notes: ""
};

const initialAuditUpdateForm: AuditUpdateInput = {
  siteName: "",
  roomName: "",
  auditName: "",
  salesOrder: "",
  status: "created",
  notes: ""
};

const initialRackCreateForm: RackCreateInput = {
  rackName: "",
  totalUnits: 47
};

const initialRackUpdateForm: RackUpdateInput = {
  rackName: "",
  totalUnits: 47
};

const initialTemplateForm: DeviceTemplateInput = {
  templateType: "server",
  mountStyle: "full",
  iconKey: "server",
  name: "",
  manufacturer: "Generic",
  model: "",
  defaultHeightU: 1,
  blocksBothFaces: false,
  allowSharedDepth: false
};

const initialFeedbackForm: FeedbackInput = {
  userName: "",
  message: "",
  contextPath: null,
  auditName: null
};

const initialDeviceTypeForm: DeviceTypeInput = {
  key: "",
  label: ""
};

function toAuditUpdateForm(audit: AuditDetail): AuditUpdateInput {
  return {
    siteName: audit.siteName,
    roomName: audit.roomName,
    auditName: audit.name,
    salesOrder: audit.salesOrder ?? "",
    status: audit.status,
    notes: audit.notes ?? ""
  };
}

function toRackUpdateForm(rack: RackDetail): RackUpdateInput {
  return {
    rackName: rack.name,
    totalUnits: rack.totalUnits
  };
}

function templateToRackDevice(
  template: DeviceTemplate,
  startUnit: number | null,
  placementType: "rack",
  rackFace: RackFace,
  mountPosition: RackMountPosition
): RackDeviceInput {
  return {
    templateId: template.id,
    placementType,
    rackFace,
    mountPosition,
    blocksBothFaces: template.mountStyle === "vertical-pdu" ? false : template.blocksBothFaces,
    allowSharedDepth: template.mountStyle === "vertical-pdu" ? false : template.allowSharedDepth,
    startUnit,
    heightU: template.defaultHeightU,
    iconKey: template.iconKey,
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
  const initialLocationState = readWorkspaceStateFromLocation();
  const [currentPath, setCurrentPath] = useState<"/" | "/audits" | "/admin">(initialLocationState.path);
  const [audits, setAudits] = useState<AuditSummary[]>([]);
  const [activeAuditId, setActiveAuditId] = useState<number | null>(initialLocationState.auditId);
  const [auditDetail, setAuditDetail] = useState<AuditDetail | null>(null);
  const [activeRackId, setActiveRackId] = useState<number | null>(initialLocationState.rackId);
  const [rackDetail, setRackDetail] = useState<RackDetail | null>(null);
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([]);
  const [templates, setTemplates] = useState<DeviceTemplate[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [activeRackView, setActiveRackView] = useState<RackViewMode>(initialLocationState.rackView);
  const [auditSearch, setAuditSearch] = useState("");
  const [message, setMessage] = useState("Loading workspace...");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createAuditForm, setCreateAuditForm] = useState<AuditCreateInput>(initialAuditCreateForm);
  const [auditForm, setAuditForm] = useState<AuditUpdateInput>(initialAuditUpdateForm);
  const [newRackForm, setNewRackForm] = useState<RackCreateInput>(initialRackCreateForm);
  const [rackForm, setRackForm] = useState<RackUpdateInput>(initialRackUpdateForm);
  const [templateForm, setTemplateForm] = useState<DeviceTemplateInput>(initialTemplateForm);
  const [deviceTypeForm, setDeviceTypeForm] = useState<DeviceTypeInput>(initialDeviceTypeForm);
  const [recentlyDeletedDevice, setRecentlyDeletedDevice] = useState<{ rackId: number; device: RackDevice } | null>(null);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState<FeedbackInput>(initialFeedbackForm);
  const [sendingFeedback, setSendingFeedback] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [auditList, templateList, deviceTypeList] = await Promise.all([
          api.listAudits(),
          api.listTemplates(),
          api.listDeviceTypes()
        ]);
        setAudits(auditList);
        setTemplates(templateList);
        setDeviceTypes(deviceTypeList);
        if (auditList.length === 0) {
          setMessage("Create the first audit to start documenting racks.");
        } else if (initialLocationState.auditId === null) {
          setMessage("Open an audit from the overview to continue.");
        }
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Initial data could not be loaded.");
      }
    })();
  }, [initialLocationState.auditId]);

  useEffect(() => {
    function handlePopState() {
      const locationState = readWorkspaceStateFromLocation();
      setCurrentPath(locationState.path);
      setActiveAuditId(locationState.auditId);
      setActiveRackId(locationState.rackId);
      setActiveRackView(locationState.rackView);
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (currentPath === "/audits") {
      const searchParams = new URLSearchParams();
      if (activeAuditId !== null) {
        searchParams.set("audit", String(activeAuditId));
      }
      if (activeRackId !== null) {
        searchParams.set("rack", String(activeRackId));
      }
      searchParams.set("view", activeRackView);

      const nextUrl = `/audits${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (currentUrl !== nextUrl) {
        window.history.replaceState({}, "", nextUrl);
      }
      return;
    }

    if (window.location.search) {
      window.history.replaceState({}, "", currentPath);
    }
  }, [activeAuditId, activeRackId, activeRackView, currentPath]);

  useEffect(() => {
    setFeedbackForm((current) => ({
      ...current,
      contextPath: `${window.location.pathname}${window.location.search}`,
      auditName: auditDetail?.name ?? null
    }));
  }, [activeAuditId, activeRackId, activeRackView, auditDetail?.name, currentPath]);

  useEffect(() => {
    if (activeAuditId !== null) {
      void loadAudit(activeAuditId);
      return;
    }

    setAuditDetail(null);
    setRackDetail(null);
    setActiveRackId(null);
  }, [activeAuditId]);

  useEffect(() => {
    if (deviceTypes.length === 0) {
      return;
    }

    setTemplateForm((current) => {
      if (deviceTypes.some((deviceType) => deviceType.key === current.templateType)) {
        return current;
      }

      return {
        ...current,
        templateType: deviceTypes[0].key
      };
    });
  }, [deviceTypes]);

  useEffect(() => {
    if (!auditDetail) {
      return;
    }

    if (auditDetail.racks.length === 0) {
      setActiveRackId(null);
      setRackDetail(null);
      return;
    }

    setActiveRackId((currentRackId) =>
      currentRackId !== null && auditDetail.racks.some((rack) => rack.id === currentRackId) ? currentRackId : auditDetail.racks[0].id
    );
  }, [auditDetail]);

  useEffect(() => {
    if (activeRackId !== null) {
      void loadRack(activeRackId);
      return;
    }

    setRackDetail(null);
    setRackForm(initialRackUpdateForm);
    setSelectedDeviceId(null);
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
      activeRackView === "both" ||
      selectedDevice.blocksBothFaces ||
      selectedDevice.rackFace === null ||
      selectedDevice.rackFace === activeRackView;

    if (!isVisibleOnFace) {
      setSelectedDeviceId(null);
    }
  }, [activeRackView, rackDetail, selectedDeviceId]);

  useEffect(() => {
    if (selectedDeviceId !== null && recentlyDeletedDevice) {
      setRecentlyDeletedDevice(null);
    }
  }, [recentlyDeletedDevice, selectedDeviceId]);

  useEffect(() => {
    if (selectedDeviceId === null) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest("[data-device-selection='true']")) {
        return;
      }

      setSelectedDeviceId(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [selectedDeviceId]);

  function navigate(path: "/" | "/audits" | "/admin", options?: { auditId?: number | null; rackId?: number | null; rackView?: RackViewMode }) {
    const searchParams = new URLSearchParams();
    if (path === "/audits") {
      if (options?.auditId !== null && options?.auditId !== undefined) {
        searchParams.set("audit", String(options.auditId));
      }
      if (options?.rackId !== null && options?.rackId !== undefined) {
        searchParams.set("rack", String(options.rackId));
      }
      searchParams.set("view", options?.rackView ?? activeRackView);
    }

    const nextUrl = `${path}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    window.history.pushState({}, "", nextUrl);
    setCurrentPath(path);
  }

  function openAudit(auditId: number) {
    setRecentlyDeletedDevice(null);
    setSelectedDeviceId(null);
    setActiveRackView("both");
    setActiveRackId(null);
    setActiveAuditId(auditId);
    navigate("/audits", { auditId, rackView: "both" });
  }

  function selectRack(rackId: number) {
    setRecentlyDeletedDevice(null);
    setSelectedDeviceId(null);
    setActiveRackId(rackId);
    navigate("/audits", { auditId: activeAuditId, rackId, rackView: activeRackView });
  }

  async function refreshTemplates() {
    setTemplates(await api.listTemplates());
  }

  async function refreshDeviceTypes() {
    setDeviceTypes(await api.listDeviceTypes());
  }

  async function refreshAuditList(selectAuditId?: number | null) {
    const auditList = await api.listAudits();
    setAudits(auditList);

    if (selectAuditId !== undefined) {
      setActiveAuditId(selectAuditId);
      return;
    }

    setActiveAuditId((currentAuditId) => (currentAuditId !== null && auditList.some((audit) => audit.id === currentAuditId) ? currentAuditId : null));
  }

  async function loadAudit(auditId: number) {
    try {
      const detail = await api.getAudit(auditId);
      setAuditDetail(detail);
      setAuditForm(toAuditUpdateForm(detail));
      setMessage(`${detail.name} is open with ${detail.racks.length} rack${detail.racks.length === 1 ? "" : "s"}.`);
      setError(null);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Audit could not be loaded.";
      if (message === "Audit not found.") {
        setActiveAuditId(null);
        setActiveRackId(null);
        setAuditDetail(null);
        setRackDetail(null);
        setCurrentPath("/");
        window.history.replaceState({}, "", "/");
        setMessage("Open an audit from the overview to continue.");
      }
      setError(message);
    }
  }

  async function refreshActiveAudit(nextRackId?: number | null) {
    if (activeAuditId === null) {
      return null;
    }

    const detail = await api.getAudit(activeAuditId);
    setAuditDetail(detail);
    setAuditForm(toAuditUpdateForm(detail));

    if (nextRackId !== undefined) {
      setActiveRackId(nextRackId);
    }

    return detail;
  }

  async function loadRack(rackId: number) {
    try {
      const detail = await api.getRack(rackId);
      setRackDetail(detail);
      setRackForm(toRackUpdateForm(detail));
      setNewRackForm((current) => ({ ...current, totalUnits: current.totalUnits || detail.totalUnits }));
      setSelectedDeviceId((current) => (current && detail.devices.some((device) => device.id === current) ? current : null));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Rack could not be loaded.");
    }
  }

  const selectedDevice = rackDetail?.devices.find((device) => device.id === selectedDeviceId) ?? null;
  const stagedDevices = rackDetail?.devices.filter((device) => device.placementType === "spare") ?? [];

  async function handleTemplateDrop(targetFace: RackFace, unit: number, mountPosition: RackMountPosition, templatePayload: string) {
    if (activeRackId === null || rackDetail === null) {
      return;
    }

    try {
      const template = JSON.parse(templatePayload) as DeviceTemplate;
      const targetMountPosition = template.mountStyle === "vertical-pdu" ? mountPosition : "full";
      const resolvedRackFace = template.mountStyle === "vertical-pdu" ? (getMountPositionFace(targetMountPosition) ?? targetFace) : targetFace;

      if (template.mountStyle === "vertical-pdu" && mountPosition === "full") {
        setError("Vertical PDUs can only be dropped onto one of the visible PDU lanes.");
        return;
      }

      const anchoredStartUnit = getAnchoredStartUnit(
        unit,
        template.defaultHeightU,
        rackDetail.totalUnits,
        resolvedRackFace,
        targetMountPosition,
        template.mountStyle === "vertical-pdu" ? false : template.blocksBothFaces,
        template.mountStyle === "vertical-pdu" ? false : template.allowSharedDepth,
        rackDetail.devices
      );

      if (anchoredStartUnit === null) {
        setError("The device does not fit from the selected unit either upward or downward.");
        return;
      }

      setSaving(true);
      await api.createDevice(
        activeRackId,
        templateToRackDevice(template, anchoredStartUnit, "rack", resolvedRackFace, targetMountPosition)
      );
      setRecentlyDeletedDevice(null);
      await loadRack(activeRackId);
      setMessage(
        template.mountStyle === "vertical-pdu"
          ? `${template.name} was placed at ${anchoredStartUnit}U in ${getRackMountPositionLabel(targetMountPosition)}.`
          : `${template.name} was placed at ${anchoredStartUnit}U.`
      );
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Device could not be placed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeviceMove(device: RackDevice, nextStartUnit: number, nextMountPosition: RackMountPosition, targetFace: RackFace) {
    if (activeRackId === null) {
      return;
    }

    try {
      setSaving(true);
      const resolvedRackFace =
        nextMountPosition === "full"
          ? device.placementType === "spare"
            ? targetFace
            : device.rackFace ?? targetFace
          : getMountPositionFace(nextMountPosition);
      await api.updateDevice(activeRackId, device.id, {
        templateId: device.templateId,
        placementType: "rack",
        rackFace: resolvedRackFace,
        mountPosition: nextMountPosition,
        blocksBothFaces: nextMountPosition === "full" ? device.blocksBothFaces : false,
        allowSharedDepth: nextMountPosition === "full" ? device.allowSharedDepth : false,
        startUnit: nextStartUnit,
        heightU: device.heightU,
        iconKey: device.iconKey,
        name: device.name,
        manufacturer: device.manufacturer,
        model: device.model,
        serialNumber: device.serialNumber,
        hostname: device.hostname,
        notes: device.notes,
        storageLocation: null
      });
      await loadRack(activeRackId);
      setMessage(
        nextMountPosition === "full"
          ? `${device.name} was moved to ${nextStartUnit}U.`
          : `${device.name} was moved to ${nextStartUnit}U in ${getRackMountPositionLabel(nextMountPosition)}.`
      );
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Device could not be moved.");
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
          devices: sortRackDevices(current.devices.map((device) => (device.id === updatedDevice.id ? updatedDevice : device)))
        };
      });
      if (next.startUnit !== updatedDevice.startUnit) {
        setMessage(`${updatedDevice.name} was moved to ${updatedDevice.startUnit}U so the updated size fits in the rack.`);
      }
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Changes could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function moveDeviceToStagingArea(device: RackDevice) {
    if (activeRackId === null) {
      return;
    }

    setRecentlyDeletedDevice(null);

    await api.updateDevice(activeRackId, device.id, {
      templateId: device.templateId,
      placementType: "spare",
      rackFace: device.rackFace,
      mountPosition: device.mountPosition,
      blocksBothFaces: device.blocksBothFaces,
      allowSharedDepth: device.allowSharedDepth,
      startUnit: null,
      heightU: device.heightU,
      iconKey: device.iconKey,
      name: device.name,
      manufacturer: device.manufacturer,
      model: device.model,
      serialNumber: device.serialNumber,
      hostname: device.hostname,
      notes: device.notes,
      storageLocation: "Staging area"
    });
  }

  async function handleMoveDeviceToTray() {
    if (activeRackId === null || selectedDevice === null) {
      return;
    }

    if (selectedDevice.placementType !== "rack") {
      return;
    }

    try {
      setSaving(true);
      await moveDeviceToStagingArea(selectedDevice);
      await loadRack(activeRackId);
      setMessage(`${selectedDevice.name} was moved to the staging area.`);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Device could not be moved to the tray.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDevice() {
    if (activeRackId === null || selectedDevice === null) {
      return;
    }

    const deletedDevice = selectedDevice;

    try {
      setSaving(true);
      await api.deleteDevice(activeRackId, deletedDevice.id);
      setRecentlyDeletedDevice({ rackId: activeRackId, device: deletedDevice });
      setSelectedDeviceId(null);
      await loadRack(activeRackId);
      setMessage(`${deletedDevice.name} was deleted.`);
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Item could not be removed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUndoDelete() {
    if (!recentlyDeletedDevice) {
      return;
    }

    const { rackId, device } = recentlyDeletedDevice;

    try {
      setSaving(true);
      const restoredDevice = await api.createDevice(rackId, {
        templateId: device.templateId,
        placementType: device.placementType,
        rackFace: device.rackFace,
        mountPosition: device.mountPosition,
        blocksBothFaces: device.blocksBothFaces,
        allowSharedDepth: device.allowSharedDepth,
        startUnit: device.startUnit,
        heightU: device.heightU,
        iconKey: device.iconKey,
        name: device.name,
        manufacturer: device.manufacturer,
        model: device.model,
        serialNumber: device.serialNumber,
        hostname: device.hostname,
        notes: device.notes,
        storageLocation: device.storageLocation
      });

      setRecentlyDeletedDevice(null);

      if (activeRackId === rackId) {
        await loadRack(rackId);
        setSelectedDeviceId(restoredDevice.id);
      }

      setMessage(`${device.name} was restored.`);
      setError(null);
    } catch (restoreError) {
      if (device.placementType === "rack") {
        try {
          const restoredToTray = await api.createDevice(rackId, {
            templateId: device.templateId,
            placementType: "spare",
            rackFace: device.rackFace,
            mountPosition: device.mountPosition,
            blocksBothFaces: device.blocksBothFaces,
            allowSharedDepth: device.allowSharedDepth,
            startUnit: null,
            heightU: device.heightU,
            iconKey: device.iconKey,
            name: device.name,
            manufacturer: device.manufacturer,
            model: device.model,
            serialNumber: device.serialNumber,
            hostname: device.hostname,
            notes: device.notes,
            storageLocation: "Staging area"
          });

          setRecentlyDeletedDevice(null);

          if (activeRackId === rackId) {
            await loadRack(rackId);
            setSelectedDeviceId(restoredToTray.id);
          }

          setMessage(`${device.name} was restored to the tray because the old rack position is no longer free.`);
          setError(null);
          return;
        } catch {
          // Fall through to the shared error state below.
        }
      }

      setError(restoreError instanceof Error ? restoreError.message : "Deleted device could not be restored.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStageDevice(deviceId: number) {
    if (activeRackId === null || rackDetail === null) {
      return;
    }

    const device = rackDetail.devices.find((entry) => entry.id === deviceId);
    if (!device || device.placementType !== "rack") {
      return;
    }

    try {
      setSaving(true);
      await moveDeviceToStagingArea(device);
      setSelectedDeviceId(device.id);
      await loadRack(activeRackId);
      setMessage(`${device.name} was moved to the staging area.`);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Device could not be staged.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAuditUpdate() {
    if (activeAuditId === null) {
      return;
    }

    try {
      setSaving(true);
      const updatedAudit = await api.updateAudit(activeAuditId, auditForm);
      setAuditDetail(updatedAudit);
      setAuditForm(toAuditUpdateForm(updatedAudit));
      await refreshAuditList(activeAuditId);
      setMessage(`${updatedAudit.name} was updated.`);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Audit details could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAudit() {
    if (activeAuditId === null || auditDetail === null) {
      return;
    }

    const deletedAuditName = auditDetail.name;

    try {
      setSaving(true);
      await api.deleteAudit(activeAuditId);
      setSelectedDeviceId(null);
      setAuditDetail(null);
      setRackDetail(null);
      setActiveRackId(null);
      setActiveAuditId(null);
      await refreshAuditList(null);
      setMessage(`${deletedAuditName} was deleted.`);
      setError(null);
      navigate("/");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Audit could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRackUpdate() {
    if (activeRackId === null) {
      return;
    }

    try {
      setSaving(true);
      const updatedRack = await api.updateRack(activeRackId, rackForm);
      setRackDetail(updatedRack);
      setRackForm(toRackUpdateForm(updatedRack));
      await refreshActiveAudit(activeRackId);
      await refreshAuditList(activeAuditId);
      setMessage(`${updatedRack.name} was updated.`);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Rack details could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRack() {
    if (!auditDetail || activeRackId === null) {
      return;
    }

    const currentRack = auditDetail.racks.find((rack) => rack.id === activeRackId);
    if (!currentRack || auditDetail.racks.length <= 1) {
      return;
    }

    const shouldDelete = window.confirm(`Delete rack "${currentRack.name}" from audit "${auditDetail.name}"?`);
    if (!shouldDelete) {
      return;
    }

    try {
      setSaving(true);
      const nextRackId = auditDetail.racks.find((rack) => rack.id !== activeRackId)?.id ?? null;
      await api.deleteRack(activeRackId);
      setSelectedDeviceId(null);
      await refreshActiveAudit(nextRackId);
      await refreshAuditList(activeAuditId);
      setMessage(`${currentRack.name} was removed from the audit.`);
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Rack could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateAudit() {
    try {
      setSaving(true);
      const audit = await api.createAudit({
        ...createAuditForm,
        status: "created",
        initialRackName: "0101",
        initialRackUnits: 47
      });
      setCreateAuditForm(initialAuditCreateForm);
      setAuditDetail(audit);
      setAuditForm(toAuditUpdateForm(audit));
      setActiveAuditId(audit.id);
      setActiveRackId(audit.racks[0]?.id ?? null);
      await refreshAuditList(audit.id);
      setMessage(`${audit.name} was created.`);
      setError(null);
      setActiveRackView("both");
      navigate("/audits", { auditId: audit.id, rackId: audit.racks[0]?.id ?? null, rackView: "both" });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Audit could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateRack() {
    if (activeAuditId === null) {
      return;
    }

    try {
      setSaving(true);
      const rack = await api.createRack(activeAuditId, newRackForm);
      setNewRackForm({ ...initialRackCreateForm, totalUnits: rack.totalUnits });
      await refreshActiveAudit(rack.id);
      await refreshAuditList(activeAuditId);
      setMessage(`${rack.name} was added to ${auditDetail?.name ?? "the audit"}.`);
      setError(null);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Rack could not be created.");
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
      setMessage(`${template.name} was added as a template.`);
      setError(null);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Template could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateDeviceType() {
    try {
      setSaving(true);
      const deviceType = await api.createDeviceType(deviceTypeForm);
      await refreshDeviceTypes();
      setDeviceTypeForm(initialDeviceTypeForm);
      setTemplateForm((current) => ({
        ...current,
        templateType: current.templateType || deviceType.key
      }));
      setMessage(`${deviceType.label} was added as a device type.`);
      setError(null);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Device type could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendFeedback() {
    try {
      setSendingFeedback(true);
      await api.sendFeedback(feedbackForm);
      setFeedbackModalOpen(false);
      setFeedbackForm({
        ...initialFeedbackForm,
        contextPath: `${window.location.pathname}${window.location.search}`,
        auditName: auditDetail?.name ?? null
      });
      setMessage("Feedback was sent.");
      setError(null);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Feedback could not be sent.");
    } finally {
      setSendingFeedback(false);
    }
  }

  async function handleUpdateTemplate(templateId: number, next: DeviceTemplateInput) {
    try {
      setSaving(true);
      const updatedTemplate = await api.updateTemplate(templateId, next);
      await refreshTemplates();
      setMessage(`${updatedTemplate.name} was updated.`);
      setError(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Template could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateDeviceType(deviceTypeId: number, next: DeviceTypeInput) {
    try {
      setSaving(true);
      const updatedType = await api.updateDeviceType(deviceTypeId, next);
      await Promise.all([refreshDeviceTypes(), refreshTemplates()]);
      setMessage(`${updatedType.label} was updated.`);
      setError(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Device type could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDeviceType(deviceTypeId: number) {
    try {
      setSaving(true);
      await api.deleteDeviceType(deviceTypeId);
      await refreshDeviceTypes();
      setMessage("Device type was deleted.");
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Device type could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTemplate(templateId: number) {
    try {
      setSaving(true);
      await api.deleteTemplate(templateId);
      await refreshTemplates();
      setMessage("Template was deleted.");
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Template could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="app-nav-links">
          <button className={currentPath === "/" ? "nav-link selected" : "nav-link"} onClick={() => navigate("/")} type="button">
            Overview
          </button>
          <button
            className={currentPath === "/audits" ? "nav-link selected" : "nav-link"}
            onClick={() => navigate("/audits")}
            type="button"
          >
            Audits
          </button>
          <button
            className={currentPath === "/admin" ? "nav-link selected" : "nav-link"}
            onClick={() => navigate("/admin")}
            type="button"
          >
            Admin
          </button>
        </div>
        <div className="app-brand">
          <strong>Aether C.A.D</strong>
          <span>Customer Audit Documentation</span>
        </div>
        <div className="app-nav-spacer">
          <button className="nav-link nav-feedback-button" onClick={() => setFeedbackModalOpen(true)} type="button">
            <span className="feedback-button-icon">
              <FeedbackNavIcon />
            </span>
            <span>Feedback</span>
          </button>
        </div>
      </nav>

      <FeedbackModal
        draft={feedbackForm}
        open={feedbackModalOpen}
        sending={sendingFeedback}
        onDraftChange={setFeedbackForm}
        onClose={() => setFeedbackModalOpen(false)}
        onSend={() => {
          void handleSendFeedback();
        }}
      />

      {currentPath === "/audits" ? (
        <header className="hero audit-hero">
          <RackSwitcher
            audit={auditDetail}
            form={auditForm}
            saving={saving}
            onFormChange={setAuditForm}
            onSave={handleAuditUpdate}
            onDeleteAudit={() => {
              void handleDeleteAudit();
            }}
          />
          <div className="hero-actions">
            <span className="status-pill">{saving ? "Saving database changes" : message}</span>
            {auditDetail ? (
              <div className="export-actions">
                <a href={api.excelExportUrl(auditDetail.id)}>Export Excel</a>
                <a href={api.pdfExportUrl(auditDetail.id)}>Export PDF</a>
              </div>
            ) : null}
          </div>
        </header>
      ) : null}

      {error ? <div className="error-banner">{error}</div> : null}

      {currentPath === "/" ? (
        <OverviewPage
          audits={audits}
          searchValue={auditSearch}
          createForm={createAuditForm}
          saving={saving}
          onSearchChange={setAuditSearch}
          onOpenAudit={openAudit}
          onCreateFormChange={setCreateAuditForm}
          onCreateAudit={() => {
            void handleCreateAudit();
          }}
        />
      ) : currentPath === "/admin" ? (
        <AdminTemplatesPage
          deviceTypes={deviceTypes}
          templates={templates}
          deviceTypeForm={deviceTypeForm}
          form={templateForm}
          saving={saving}
          onDeviceTypeFormChange={setDeviceTypeForm}
          onFormChange={setTemplateForm}
          onCreateDeviceType={() => {
            void handleCreateDeviceType();
          }}
          onCreateTemplate={(event) => {
            void handleCreateTemplate(event);
          }}
          onUpdateDeviceType={(deviceTypeId, next) => {
            void handleUpdateDeviceType(deviceTypeId, next);
          }}
          onDeleteDeviceType={(deviceTypeId) => {
            void handleDeleteDeviceType(deviceTypeId);
          }}
          onUpdateTemplate={(templateId, next) => {
            void handleUpdateTemplate(templateId, next);
          }}
          onDeleteTemplate={(templateId) => {
            void handleDeleteTemplate(templateId);
          }}
        />
      ) : (
        <main className="workspace-grid">
          <div className="editor-column">
            <RackTabs
              audit={auditDetail}
              activeRackId={activeRackId}
              rackForm={rackForm}
              newRackForm={newRackForm}
              saving={saving}
              onSelectRack={selectRack}
              onRackFormChange={setRackForm}
              onSaveRack={handleRackUpdate}
              onNewRackFormChange={setNewRackForm}
              onCreateRack={handleCreateRack}
              onDeleteRack={handleDeleteRack}
            />

            {rackDetail ? (
              <RackCanvas
                rack={rackDetail}
                activeRackView={activeRackView}
                selectedDeviceId={selectedDeviceId}
                onSelectDevice={setSelectedDeviceId}
                onRackFaceChange={setActiveRackView}
                onTemplateDrop={(targetRackFace, unit, mountPosition, templatePayload) => {
                  void handleTemplateDrop(targetRackFace, unit, mountPosition, templatePayload);
                }}
                onDeviceMove={(device, nextStartUnit, nextMountPosition, targetRackFace) => {
                  void handleDeviceMove(device, nextStartUnit, nextMountPosition, targetRackFace);
                }}
              />
            ) : (
              <section className="panel empty-state-panel">
                <p className="eyebrow">Audit Editor</p>
                <h2>No rack selected</h2>
                <p>Please select or create a rack inside the active audit.</p>
              </section>
            )}
          </div>

          <div className="side-column">
            <Palette collapsed={selectedDeviceId !== null} templates={templates} />
            <StagingArea
              devices={stagedDevices}
              selectedDeviceId={selectedDeviceId}
              saving={saving}
              onSelectDevice={setSelectedDeviceId}
              onStageDevice={(deviceId) => {
                void handleStageDevice(deviceId);
              }}
            />
            <Inspector
              device={selectedDevice}
              recentlyDeletedDeviceName={recentlyDeletedDevice?.device.name ?? null}
              onChange={(next) => {
                void handleInspectorChange(next);
              }}
              onMoveToTray={() => {
                void handleMoveDeviceToTray();
              }}
              onDelete={() => {
                void handleDeleteDevice();
              }}
              onUndoDelete={() => {
                void handleUndoDelete();
              }}
              saving={saving}
            />
          </div>
        </main>
      )}
    </div>
  );
}
