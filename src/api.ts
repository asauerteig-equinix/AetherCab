import type {
  AuditCreateInput,
  AuditDetail,
  AuditSummary,
  AuditUpdateInput,
  DeviceTemplate,
  DeviceTemplateInput,
  RackCreateInput,
  RackDetail,
  RackDevice,
  RackDeviceInput,
  RackUpdateInput,
} from "../shared/types";

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorBody?.error ?? "Request failed.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  listAudits(): Promise<AuditSummary[]> {
    return request("/api/audits");
  },
  createAudit(payload: AuditCreateInput): Promise<AuditDetail> {
    return request("/api/audits", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  getAudit(auditId: number): Promise<AuditDetail> {
    return request(`/api/audits/${auditId}`);
  },
  updateAudit(auditId: number, payload: AuditUpdateInput): Promise<AuditDetail> {
    return request(`/api/audits/${auditId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  createRack(auditId: number, payload: RackCreateInput): Promise<RackDetail> {
    return request(`/api/audits/${auditId}/racks`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  getRack(rackId: number): Promise<RackDetail> {
    return request(`/api/racks/${rackId}`);
  },
  updateRack(rackId: number, payload: RackUpdateInput): Promise<RackDetail> {
    return request(`/api/racks/${rackId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  deleteRack(rackId: number): Promise<void> {
    return request(`/api/racks/${rackId}`, {
      method: "DELETE"
    });
  },
  listTemplates(): Promise<DeviceTemplate[]> {
    return request("/api/device-templates");
  },
  createTemplate(payload: DeviceTemplateInput): Promise<DeviceTemplate> {
    return request("/api/device-templates", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateTemplate(templateId: number, payload: DeviceTemplateInput): Promise<DeviceTemplate> {
    return request(`/api/device-templates/${templateId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  deleteTemplate(templateId: number): Promise<void> {
    return request(`/api/device-templates/${templateId}`, {
      method: "DELETE"
    });
  },
  createDevice(rackId: number, payload: RackDeviceInput): Promise<RackDevice> {
    return request(`/api/racks/${rackId}/devices`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateDevice(rackId: number, deviceId: number, payload: RackDeviceInput): Promise<RackDevice> {
    return request(`/api/racks/${rackId}/devices/${deviceId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  deleteDevice(rackId: number, deviceId: number): Promise<void> {
    return request(`/api/racks/${rackId}/devices/${deviceId}`, {
      method: "DELETE"
    });
  },
  excelExportUrl(auditId: number): string {
    return `/api/audits/${auditId}/export.xlsx`;
  },
  pdfExportUrl(auditId: number): string {
    return `/api/audits/${auditId}/export.pdf`;
  }
};
