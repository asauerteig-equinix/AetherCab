export type PlacementType = "rack" | "spare";
export type RackFace = "front" | "rear";
export type TemplateMountStyle = "full" | "vertical-pdu";
export type RackMountPosition =
  | "full"
  | "front-left-outer"
  | "front-left-inner"
  | "front-right-inner"
  | "front-right-outer"
  | "rear-left-outer"
  | "rear-left-inner"
  | "rear-right-inner"
  | "rear-right-outer";

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
  mountStyle: TemplateMountStyle;
  name: string;
  manufacturer: string;
  model: string;
  defaultHeightU: number;
  blocksBothFaces: boolean;
}

export interface DeviceTemplateInput {
  templateType: string;
  mountStyle: TemplateMountStyle;
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
  mountPosition: RackMountPosition;
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
  mountPosition: RackMountPosition;
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

export interface RackUpdateInput {
  siteName: string;
  roomName: string;
  rackName: string;
  totalUnits: number;
  notes?: string | null;
}
