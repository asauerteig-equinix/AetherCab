import type { DeviceTemplate, RackCreateInput, RackDetail, RackDevice, RackDeviceInput, RackSummary } from "../shared/types";

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
  listRacks(): Promise<RackSummary[]> {
    return request("/api/racks");
  },
  createRack(payload: RackCreateInput): Promise<RackSummary> {
    return request("/api/racks", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  getRack(rackId: number): Promise<RackDetail> {
    return request(`/api/racks/${rackId}`);
  },
  listTemplates(): Promise<DeviceTemplate[]> {
    return request("/api/device-templates");
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
  excelExportUrl(rackId: number): string {
    return `/api/racks/${rackId}/export.xlsx`;
  },
  pdfExportUrl(rackId: number): string {
    return `/api/racks/${rackId}/export.pdf`;
  }
};
