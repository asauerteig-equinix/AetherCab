export type PlacementType = "rack" | "spare";
export type RackFace = "front" | "rear";

export interface RackSummary {
  id: number;
  name: string;
  totalUnits: number;
  roomId: number;
  roomName: string;
  siteId: number;
  siteName: string;
  notes: string | null;
}

export interface DeviceTemplate {
  id: number;
  templateType: string;
  name: string;
  manufacturer: string;
  model: string;
  defaultHeightU: number;
  blocksBothFaces: boolean;
}

export interface DeviceTemplateInput {
  templateType: string;
  name: string;
  manufacturer: string;
  model: string;
  defaultHeightU: number;
  blocksBothFaces: boolean;
}

export interface RackDevice {
  id: number;
  rackId: number;
  placementType: PlacementType;
  rackFace: RackFace | null;
  blocksBothFaces: boolean;
  startUnit: number | null;
  heightU: number;
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string | null;
  hostname: string | null;
  notes: string | null;
  storageLocation: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RackDetail extends RackSummary {
  devices: RackDevice[];
}

export interface RackDeviceInput {
  placementType: PlacementType;
  rackFace: RackFace | null;
  blocksBothFaces: boolean;
  startUnit: number | null;
  heightU: number;
  name: string;
  manufacturer: string;
  model: string;
  serialNumber?: string | null;
  hostname?: string | null;
  notes?: string | null;
  storageLocation?: string | null;
}

export interface RackCreateInput {
  siteName: string;
  roomName: string;
  rackName: string;
  totalUnits: number;
  notes?: string | null;
}
