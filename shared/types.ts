export type PlacementType = "rack" | "spare";
export type RackFace = "front" | "rear";
export type TemplateMountStyle = "full" | "vertical-pdu";
export type AuditStatus = "created" | "in-progress" | "completed";
export type DeviceIconKey =
  | "generic-device"
  | "server"
  | "switch"
  | "router"
  | "patch-panel"
  | "pdu-vertical"
  | "storage"
  | "firewall"
  | "ups"
  | "modem"
  | "access-point"
  | "kvm"
  | "blade-chassis"
  | "load-balancer"
  | "media-converter"
  | "terminal-server"
  | "nas";
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

export interface AuditSummary {
  id: number;
  name: string;
  roomId: number;
  roomName: string;
  siteId: number;
  siteName: string;
  salesOrder: string | null;
  status: AuditStatus;
  createdAt: string;
  notes: string | null;
  rackCount: number;
}

export interface RackSummary {
  id: number;
  auditId: number;
  auditName: string;
  name: string;
  totalUnits: number;
  widthMm: number;
  depthMm: number;
  heightMm: number;
}

export interface DeviceType {
  id: number;
  key: string;
  label: string;
}

export interface DeviceTypeInput {
  key: string;
  label: string;
}

export interface DeviceTemplate {
  id: number;
  templateType: string;
  mountStyle: TemplateMountStyle;
  iconKey: DeviceIconKey;
  name: string;
  manufacturer: string;
  model: string;
  defaultHeightU: number;
  blocksBothFaces: boolean;
  allowSharedDepth: boolean;
}

export interface DeviceTemplateInput {
  templateType: string;
  mountStyle: TemplateMountStyle;
  iconKey: DeviceIconKey;
  name: string;
  manufacturer: string;
  model: string;
  defaultHeightU: number;
  blocksBothFaces: boolean;
  allowSharedDepth: boolean;
}

export interface RackDevice {
  id: number;
  rackId: number;
  templateId: number | null;
  placementType: PlacementType;
  rackFace: RackFace | null;
  mountPosition: RackMountPosition;
  blocksBothFaces: boolean;
  allowSharedDepth: boolean;
  startUnit: number | null;
  heightU: number;
  iconKey: DeviceIconKey | null;
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

export interface AuditDetail extends AuditSummary {
  racks: RackSummary[];
}

export interface AuditExportDetail extends AuditSummary {
  racks: RackDetail[];
}

export interface RackDeviceInput {
  templateId?: number | null;
  placementType: PlacementType;
  rackFace: RackFace | null;
  mountPosition: RackMountPosition;
  blocksBothFaces: boolean;
  allowSharedDepth: boolean;
  startUnit: number | null;
  heightU: number;
  iconKey?: DeviceIconKey | null;
  name: string;
  manufacturer: string;
  model: string;
  serialNumber?: string | null;
  hostname?: string | null;
  notes?: string | null;
  storageLocation?: string | null;
}

export interface AuditCreateInput {
  siteName: string;
  roomName: string;
  auditName: string;
  salesOrder: string;
  status: AuditStatus;
  initialRackName: string;
  initialRackUnits: number;
  notes?: string | null;
}

export interface RackCreateInput {
  rackName: string;
  totalUnits: number;
  widthMm: number;
  depthMm: number;
  heightMm: number;
}

export interface AuditUpdateInput {
  siteName: string;
  roomName: string;
  auditName: string;
  salesOrder: string;
  status: AuditStatus;
  notes?: string | null;
}

export interface RackUpdateInput {
  rackName: string;
  totalUnits: number;
  widthMm: number;
  depthMm: number;
  heightMm: number;
}

export interface FeedbackInput {
  userName: string;
  message: string;
  contextPath?: string | null;
  auditName?: string | null;
}
