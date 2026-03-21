import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { formatPowerSpec } from "../shared/power.js";
import { formatAuditDateTime, getAuditStatusLabel } from "../shared/audits.js";
import {
  getEndUnit,
  getMountPositionFace,
  getPduLaneSide,
  getRackCapacitySummary,
  getRackMountPositionLabel,
  getVisiblePduMountPositionsForFace,
  isVerticalPduMountPosition,
  type RackFaceCapacityStats,
  type RackFaceCapacityTone
} from "../shared/rack.js";
import type { AuditExportDetail, DeviceIconKey, RackDetail, RackDevice, RackFace, RackMountPosition } from "../shared/types.js";

type PdfDocument = InstanceType<typeof PDFDocument>;

const excelPalette = {
  pageBackground: "FFF4F7FA",
  panelBackground: "FFEFF3F7",
  panelBorder: "FFB6C2CD",
  slotBackground: "FFF8FAFC",
  slotLine: "FFD9E1E8",
  slotLabel: "FF6E7D8C",
  accent: "FF4F6F86",
  accentStrong: "FF2F5067",
  textPrimary: "FF18232D",
  textSecondary: "FF546372",
  deviceFill: "FFDDE6ED",
  deviceBorder: "FF96A8B7",
  capacityTrack: "FFE7EDF2",
  capacityGood: "FF3BA55D",
  capacityMedium: "FF86B94F",
  capacityWarning: "FFDE9646",
  capacityCritical: "FFD45A4C"
} as const;

const pdfPalette = {
  pageBackground: "#e9edf0",
  panelBackground: "#eef2f6",
  panelBorder: "#b8c3cd",
  slotBackground: "#f9fbfc",
  slotLine: "#d9e1e8",
  slotLabel: "#6e7d8c",
  accent: "#4f6f86",
  accentStrong: "#2f5067",
  textPrimary: "#18232d",
  textSecondary: "#546372",
  deviceFill: "#dde6ed",
  deviceBorder: "#96a8b7",
  capacityTrack: "#e7edf2",
  capacityGood: "#3ba55d",
  capacityMedium: "#86b94f",
  capacityWarning: "#de9646",
  capacityCritical: "#d45a4c"
} as const;

const pdfLandscapePageOptions = {
  margin: 36,
  size: "A4",
  layout: "landscape"
} as const;

const pdfPortraitPageOptions = {
  margin: 36,
  size: "A4",
  layout: "portrait"
} as const;

const appBrandName = "Aether C.A.D";
const appBrandSlogan = "Customer Audit Documentation";
const pdfAssetRoot = resolve(process.cwd(), "src", "assets");
const pdfAssetPaths = {
  portraitHeaderBackground: resolve(pdfAssetRoot, "eqx_aqua_bg.png")
} as const;
const pdfPortraitHeaderTop = 0;
const pdfPortraitFooterHeight = 20;
const pdfPortraitFooterBottomInset = 10;
const pdfPortraitFooterReservedSpace = pdfPortraitFooterHeight + pdfPortraitFooterBottomInset + 12;
const pdfPortraitFooterRed = "#e91c24";
const pdfPortraitFooterText = "#18232d";
const pdfWindowsFontPaths = {
  arial: resolve("C:\\Windows\\Fonts", "arial.ttf"),
  arialBold: resolve("C:\\Windows\\Fonts", "arialbd.ttf")
} as const;

const registeredPdfDocs = new WeakSet<PdfDocument>();

function ensurePdfWindowsFonts(pdf: PdfDocument): void {
  if (registeredPdfDocs.has(pdf)) {
    return;
  }

  if (existsSync(pdfWindowsFontPaths.arial)) {
    pdf.registerFont("AetherArial", pdfWindowsFontPaths.arial);
  }

  if (existsSync(pdfWindowsFontPaths.arialBold)) {
    pdf.registerFont("AetherArialBold", pdfWindowsFontPaths.arialBold);
  }

  registeredPdfDocs.add(pdf);
}

function setPdfArialFont(pdf: PdfDocument, bold = false): void {
  ensurePdfWindowsFonts(pdf);

  if (bold && existsSync(pdfWindowsFontPaths.arialBold)) {
    pdf.font("AetherArialBold");
    return;
  }

  if (!bold && existsSync(pdfWindowsFontPaths.arial)) {
    pdf.font("AetherArial");
    return;
  }

  pdf.font(bold ? "Helvetica-Bold" : "Helvetica");
}

function drawPdfDeviceIcon(pdf: PdfDocument, iconKey: DeviceIconKey | null | undefined, x: number, y: number, size: number): void {
  const key = iconKey ?? "generic-device";
  const stroke = pdfPalette.accentStrong;
  const fill = pdfPalette.accent;
  const right = x + size;
  const bottom = y + size;
  const midX = x + size / 2;
  const midY = y + size / 2;

  pdf.save();
  pdf.lineWidth(Math.max(0.9, size * 0.08)).strokeColor(stroke).fillColor(fill);

  switch (key) {
    case "server":
      pdf.roundedRect(x + 1, y + 1, size - 2, size * 0.32, 2).stroke();
      pdf.roundedRect(x + 1, y + size * 0.54, size - 2, size * 0.28, 2).stroke();
      pdf.circle(x + size * 0.2, y + size * 0.18, size * 0.05).fill(fill);
      pdf.circle(x + size * 0.2, y + size * 0.68, size * 0.05).fill(fill);
      break;
    case "switch":
      pdf.roundedRect(x + 1, y + size * 0.18, size - 2, size * 0.52, 3).stroke();
      for (let index = 0; index < 4; index += 1) {
        pdf.rect(x + size * (0.18 + index * 0.15), y + size * 0.38, size * 0.1, size * 0.08).fill(fill);
      }
      break;
    case "router":
      pdf.roundedRect(x + size * 0.12, y + size * 0.34, size * 0.76, size * 0.32, 3).stroke();
      pdf.moveTo(x + size * 0.28, y + size * 0.34).lineTo(x + size * 0.28, y + size * 0.14).stroke();
      pdf.moveTo(x + size * 0.72, y + size * 0.34).lineTo(x + size * 0.72, y + size * 0.14).stroke();
      pdf.moveTo(x + size * 0.34, y + size * 0.2).lineTo(midX, y + size * 0.12).lineTo(x + size * 0.66, y + size * 0.2).stroke();
      break;
    case "patch-panel":
      pdf.roundedRect(x + 1, y + size * 0.26, size - 2, size * 0.42, 2).stroke();
      for (let index = 0; index < 6; index += 1) {
        pdf.circle(x + size * (0.18 + index * 0.12), midY, size * 0.04).fill(fill);
      }
      break;
    case "pdu-vertical":
      pdf.roundedRect(x + size * 0.38, y + 1, size * 0.24, size - 2, 3).stroke();
      for (let index = 0; index < 4; index += 1) {
        pdf.circle(midX, y + size * (0.22 + index * 0.16), size * 0.04).fill(fill);
      }
      break;
    case "storage":
    case "nas":
      pdf.roundedRect(x + size * 0.16, y + 1, size * 0.68, size - 2, 3).stroke();
      pdf.moveTo(x + size * 0.24, y + size * 0.3).lineTo(x + size * 0.76, y + size * 0.3).stroke();
      pdf.moveTo(x + size * 0.24, y + size * 0.5).lineTo(x + size * 0.76, y + size * 0.5).stroke();
      pdf.moveTo(x + size * 0.24, y + size * 0.7).lineTo(x + size * 0.76, y + size * 0.7).stroke();
      break;
    case "firewall":
      pdf.roundedRect(x + 1, y + 1, size - 2, size - 2, 3).stroke();
      pdf.moveTo(x + size * 0.33, y + 1).lineTo(x + size * 0.33, bottom - 1).stroke();
      pdf.moveTo(x + size * 0.66, y + 1).lineTo(x + size * 0.66, bottom - 1).stroke();
      pdf.moveTo(x + 1, y + size * 0.45).lineTo(right - 1, y + size * 0.45).stroke();
      break;
    case "ups":
      pdf.roundedRect(x + size * 0.22, y + 1, size * 0.56, size - 2, 3).stroke();
      pdf.moveTo(midX, y + size * 0.34).lineTo(x + size * 0.42, y + size * 0.56).lineTo(midX, y + size * 0.56).lineTo(x + size * 0.46, y + size * 0.78).stroke();
      break;
    case "modem":
      pdf.roundedRect(x + 1, y + size * 0.34, size - 2, size * 0.28, 3).stroke();
      pdf.moveTo(x + size * 0.28, y + size * 0.34).lineTo(x + size * 0.28, y + size * 0.16).stroke();
      pdf.moveTo(x + size * 0.72, y + size * 0.34).lineTo(x + size * 0.72, y + size * 0.16).stroke();
      break;
    case "access-point":
      pdf.moveTo(x + size * 0.36, y + size * 0.42).lineTo(midX, y + size * 0.3).lineTo(x + size * 0.64, y + size * 0.42).stroke();
      pdf.moveTo(x + size * 0.22, y + size * 0.3).lineTo(midX, y + size * 0.14).lineTo(x + size * 0.78, y + size * 0.3).stroke();
      pdf.roundedRect(x + size * 0.32, y + size * 0.62, size * 0.36, size * 0.14, 2).stroke();
      break;
    case "kvm":
      pdf.roundedRect(x + 1, y + size * 0.2, size - 2, size * 0.3, 2).stroke();
      pdf.moveTo(x + size * 0.28, y + size * 0.68).lineTo(x + size * 0.72, y + size * 0.68).stroke();
      pdf.moveTo(x + size * 0.38, y + size * 0.68).lineTo(x + size * 0.38, bottom - 1).stroke();
      pdf.moveTo(x + size * 0.62, y + size * 0.68).lineTo(x + size * 0.62, bottom - 1).stroke();
      break;
    case "blade-chassis":
      pdf.roundedRect(x + size * 0.16, y + 1, size * 0.68, size - 2, 3).stroke();
      pdf.rect(x + size * 0.24, y + size * 0.18, size * 0.18, size * 0.22).stroke();
      pdf.rect(x + size * 0.58, y + size * 0.18, size * 0.18, size * 0.22).stroke();
      pdf.rect(x + size * 0.24, y + size * 0.56, size * 0.18, size * 0.22).stroke();
      pdf.rect(x + size * 0.58, y + size * 0.56, size * 0.18, size * 0.22).stroke();
      break;
    case "load-balancer":
      pdf.moveTo(midX, y + size * 0.2).lineTo(midX, y + size * 0.62).stroke();
      pdf.moveTo(midX, y + size * 0.2).lineTo(x + size * 0.26, y + size * 0.36).stroke();
      pdf.moveTo(midX, y + size * 0.2).lineTo(x + size * 0.74, y + size * 0.36).stroke();
      pdf.circle(midX, y + size * 0.2, size * 0.04).fill(fill);
      pdf.circle(x + size * 0.26, y + size * 0.36, size * 0.04).fill(fill);
      pdf.circle(x + size * 0.74, y + size * 0.36, size * 0.04).fill(fill);
      break;
    case "media-converter":
      pdf.roundedRect(x + 1, y + size * 0.26, size - 2, size * 0.42, 2).stroke();
      pdf.moveTo(x + size * 0.3, midY).lineTo(x + size * 0.7, midY).stroke();
      pdf.moveTo(x + size * 0.58, midY - size * 0.1).lineTo(x + size * 0.7, midY).lineTo(x + size * 0.58, midY + size * 0.1).stroke();
      break;
    case "terminal-server":
      pdf.roundedRect(x + 1, y + size * 0.22, size - 2, size * 0.46, 2).stroke();
      pdf.moveTo(x + size * 0.24, y + size * 0.38).lineTo(x + size * 0.4, midY).lineTo(x + size * 0.24, y + size * 0.62).stroke();
      pdf.moveTo(x + size * 0.46, y + size * 0.62).lineTo(x + size * 0.62, y + size * 0.62).stroke();
      break;
    default:
      pdf.roundedRect(x + 1, y + size * 0.22, size - 2, size * 0.46, 3).stroke();
      pdf.moveTo(x + size * 0.22, midY).lineTo(x + size * 0.78, midY).stroke();
      pdf.circle(x + size * 0.24, y + size * 0.62, size * 0.04).fill(fill);
      pdf.circle(x + size * 0.4, y + size * 0.62, size * 0.04).fill(fill);
      break;
  }

  pdf.restore();
}

function installedDevices(rack: RackDetail): RackDevice[] {
  return rack.devices.filter((device) => device.placementType === "rack" && device.startUnit !== null);
}

function faceLabel(face: RackFace): string {
  return face === "front" ? "Front" : "Rear";
}

function deviceFaceLabel(device: RackDevice): string {
  if (isVerticalPduMountPosition(device.mountPosition)) {
    return getMountPositionFace(device.mountPosition) === "front" ? "Front" : "Rear";
  }

  return device.rackFace === "rear" ? "Rear" : "Front";
}

function deviceMountLabel(device: RackDevice): string {
  return getRackMountPositionLabel(device.mountPosition);
}

function devicePositionLabel(device: RackDevice): string {
  const startUnit = device.startUnit ?? 0;
  const endUnit = getEndUnit(startUnit, device.heightU);
  return `${startUnit}U - ${endUnit}U`;
}

function devicePrimaryLine(device: RackDevice): string {
  return device.name;
}

function deviceSecondaryLine(device: RackDevice): string {
  const base = `${device.manufacturer} ${device.model}`.trim();
  const powerSpec = formatPowerSpec(device);

  if (!powerSpec) {
    return base;
  }

  if (!base) {
    return powerSpec;
  }

  return `${base} | ${powerSpec}`;
}

function deviceVisualLines(device: RackDevice): string[] {
  if (isVerticalPduMountPosition(device.mountPosition)) {
    return [devicePrimaryLine(device), deviceSecondaryLine(device), devicePositionLabel(device)];
  }

  if (device.heightU === 1) {
    return [`${devicePrimaryLine(device)} | ${deviceSecondaryLine(device)}`];
  }

  if (device.heightU === 2) {
    return [devicePrimaryLine(device), deviceSecondaryLine(device)];
  }

  return [devicePrimaryLine(device), deviceSecondaryLine(device), `${devicePositionLabel(device)} | ${deviceFaceLabel(device)}`];
}

function deviceVisualLabel(device: RackDevice): string {
  return deviceVisualLines(device).join("\n");
}

function faceSortValue(device: RackDevice): number {
  if (device.blocksBothFaces) {
    return 2;
  }

  return device.rackFace === "rear" ? 1 : 0;
}

function compareSortedDevices(left: RackDevice, right: RackDevice): number {
  const faceDelta = faceSortValue(left) - faceSortValue(right);
  if (faceDelta !== 0) {
    return faceDelta;
  }

  const leftStart = left.startUnit ?? 0;
  const rightStart = right.startUnit ?? 0;
  if (leftStart !== rightStart) {
    return rightStart - leftStart;
  }

  if (left.mountPosition !== right.mountPosition) {
    return left.mountPosition.localeCompare(right.mountPosition);
  }

  return left.name.localeCompare(right.name);
}

function deviceExportGroup(device: RackDevice): string {
  if (!isVerticalPduMountPosition(device.mountPosition)) {
    return "Rack Devices";
  }

  return getMountPositionFace(device.mountPosition) === "front" ? "Front PDUs" : "Rear PDUs";
}

function deviceExportGroupOrder(device: RackDevice): number {
  if (!isVerticalPduMountPosition(device.mountPosition)) {
    return 0;
  }

  return getMountPositionFace(device.mountPosition) === "front" ? 1 : 2;
}

function compareDevicesForGroupedExport(left: RackDevice, right: RackDevice): number {
  const leftStart = left.startUnit ?? 0;
  const rightStart = right.startUnit ?? 0;
  if (leftStart !== rightStart) {
    return rightStart - leftStart;
  }

  const leftEnd = getEndUnit(leftStart, left.heightU);
  const rightEnd = getEndUnit(rightStart, right.heightU);
  if (leftEnd !== rightEnd) {
    return rightEnd - leftEnd;
  }

  const faceDelta = faceSortValue(left) - faceSortValue(right);
  if (faceDelta !== 0) {
    return faceDelta;
  }

  if (left.mountPosition !== right.mountPosition) {
    return left.mountPosition.localeCompare(right.mountPosition);
  }

  return left.name.localeCompare(right.name);
}

function sortDevicesForGroupedExport(devices: RackDevice[]): RackDevice[] {
  return [...devices].sort((left, right) => {
    const groupDelta = deviceExportGroupOrder(left) - deviceExportGroupOrder(right);
    if (groupDelta !== 0) {
      return groupDelta;
    }

    return compareDevicesForGroupedExport(left, right);
  });
}

function groupDevicesForExport(devices: RackDevice[]): Array<{ label: string; devices: RackDevice[] }> {
  const orderedGroups = ["Rack Devices", "Front PDUs", "Rear PDUs"] as const;
  const sortedDevices = sortDevicesForGroupedExport(devices);

  return orderedGroups
    .map((label) => ({
      label,
      devices: sortedDevices.filter((device) => deviceExportGroup(device) === label)
    }))
    .filter((group) => group.devices.length > 0);
}

function visibleDevicesForFace(rack: RackDetail, face: RackFace): RackDevice[] {
  return installedDevices(rack)
    .filter((device) => {
      if (device.blocksBothFaces) {
        return true;
      }

      const deviceFace = device.rackFace ?? "front";
      return deviceFace === face;
    })
    .sort((left, right) => {
      const leftMirrored = left.blocksBothFaces && left.rackFace !== null && left.rackFace !== face;
      const rightMirrored = right.blocksBothFaces && right.rackFace !== null && right.rackFace !== face;

      if (leftMirrored !== rightMirrored) {
        return leftMirrored ? -1 : 1;
      }

      return compareSortedDevices(left, right);
    });
}

function deviceCoversUnitRange(device: RackDevice, startUnit: number, endUnit: number): boolean {
  const deviceStart = device.startUnit ?? 0;
  const deviceEnd = getEndUnit(deviceStart, device.heightU);
  return deviceStart <= endUnit && startUnit <= deviceEnd;
}

function isMirroredDeviceOnFace(device: RackDevice, face: RackFace): boolean {
  return device.blocksBothFaces && device.rackFace !== null && device.rackFace !== face;
}

function hasSharedDepthConflictOnFace(device: RackDevice, rack: RackDetail, face: RackFace): boolean {
  if (!isMirroredDeviceOnFace(device, face) || device.startUnit === null) {
    return false;
  }

  const deviceEnd = getEndUnit(device.startUnit, device.heightU);

  return installedDevices(rack).some((candidate) => {
    if (candidate.id === device.id || candidate.rackFace !== face || !candidate.allowSharedDepth || candidate.startUnit === null) {
      return false;
    }

    return deviceCoversUnitRange(candidate, device.startUnit!, deviceEnd);
  });
}

function createThinBorder(color: string): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin", color: { argb: color } },
    left: { style: "thin", color: { argb: color } },
    bottom: { style: "thin", color: { argb: color } },
    right: { style: "thin", color: { argb: color } }
  };
}

function styleExcelTitle(cell: ExcelJS.Cell, text: string): void {
  cell.value = text;
  cell.font = { name: "Bahnschrift", size: 16, bold: true, color: { argb: excelPalette.textPrimary } };
  cell.alignment = { vertical: "middle", horizontal: "left" };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: excelPalette.panelBackground } };
}

function styleExcelMeta(cell: ExcelJS.Cell): void {
  cell.font = { name: "Bahnschrift", size: 10, color: { argb: excelPalette.textSecondary } };
  cell.alignment = { vertical: "middle", horizontal: "left" };
}

function getExcelCapacityFill(tone: RackFaceCapacityTone): string {
  switch (tone) {
    case "good":
      return excelPalette.capacityGood;
    case "medium":
      return excelPalette.capacityMedium;
    case "warning":
      return excelPalette.capacityWarning;
    default:
      return excelPalette.capacityCritical;
  }
}

function getPdfCapacityFill(tone: RackFaceCapacityTone): string {
  switch (tone) {
    case "good":
      return pdfPalette.capacityGood;
    case "medium":
      return pdfPalette.capacityMedium;
    case "warning":
      return pdfPalette.capacityWarning;
    default:
      return pdfPalette.capacityCritical;
  }
}

function capacityLabel(stats: RackFaceCapacityStats): string {
  return `${faceLabel(stats.face)} occupied ${stats.usedPercent}% | free ${stats.freePercent}%`;
}

function capacityBarSegments(usedPercent: number, segmentCount: number): number {
  return Math.max(0, Math.min(segmentCount, Math.ceil((usedPercent / 100) * segmentCount)));
}

function drawExcelCapacityBar(
  worksheet: ExcelJS.Worksheet,
  rowIndex: number,
  labelStartColumn: number,
  labelEndColumn: number,
  barStartColumn: number,
  barEndColumn: number,
  stats: RackFaceCapacityStats
): void {
  worksheet.mergeCells(rowIndex, labelStartColumn, rowIndex, labelEndColumn);
  const labelCell = worksheet.getCell(rowIndex, labelStartColumn);
  labelCell.value = capacityLabel(stats);
  labelCell.font = { name: "Bahnschrift", size: 9, bold: true, color: { argb: excelPalette.textPrimary } };
  labelCell.alignment = { vertical: "middle", horizontal: "left" };
  labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
  labelCell.border = createThinBorder(excelPalette.slotLine);

  const segmentCount = barEndColumn - barStartColumn + 1;
  const filledSegments = capacityBarSegments(stats.usedPercent, segmentCount);
  for (let columnIndex = barStartColumn; columnIndex <= barEndColumn; columnIndex += 1) {
    const cell = worksheet.getCell(rowIndex, columnIndex);
    cell.value = "";
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: columnIndex - barStartColumn < filledSegments ? getExcelCapacityFill(stats.tone) : excelPalette.capacityTrack
      }
    };
    cell.border = createThinBorder(excelPalette.slotLine);
  }
}

function columnHeaderLabel(column: Partial<ExcelJS.Column>): string {
  if (typeof column.header === "string") {
    return column.header;
  }

  if (Array.isArray(column.header)) {
    return column.header.join(" ");
  }

  return typeof column.key === "string" ? column.key : "";
}

function applyExcelRangeBorder(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  startColumn: number,
  endColumn: number,
  color: string
): void {
  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
    for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
      worksheet.getCell(rowIndex, columnIndex).border = createThinBorder(color);
    }
  }
}

function getExcelFaceSpan(): number {
  return 9;
}

function getExcelDeviceRange(startColumn: number, mountPosition: RackMountPosition): { startColumn: number; endColumn: number } {
  if (isVerticalPduMountPosition(mountPosition)) {
    const laneColumnMap = {
      "front-left-outer": startColumn + 1,
      "front-left-inner": startColumn + 2,
      "front-right-inner": startColumn + 7,
      "front-right-outer": startColumn + 8,
      "rear-left-outer": startColumn + 1,
      "rear-left-inner": startColumn + 2,
      "rear-right-inner": startColumn + 7,
      "rear-right-outer": startColumn + 8
    } satisfies Record<Exclude<RackMountPosition, "full">, number>;

    const laneColumn = laneColumnMap[mountPosition as Exclude<RackMountPosition, "full">];
    return { startColumn: laneColumn, endColumn: laneColumn };
  }

  return { startColumn: startColumn + 3, endColumn: startColumn + 6 };
}

function drawExcelRackFace(worksheet: ExcelJS.Worksheet, rack: RackDetail, face: RackFace, startColumn: number, startRow: number): void {
  const faceSpan = getExcelFaceSpan();

  worksheet.mergeCells(startRow, startColumn, startRow, startColumn + faceSpan - 1);
  const headerCell = worksheet.getCell(startRow, startColumn);
  headerCell.value = `-- ${faceLabel(face)} --`;
  headerCell.font = { name: "Bahnschrift", size: 10, bold: true, color: { argb: excelPalette.accentStrong } };
  headerCell.alignment = { vertical: "middle", horizontal: "center" };

  const rackStartRow = startRow + 2;
  const rackDevices = visibleDevicesForFace(rack, face);

  worksheet.getColumn(startColumn).width = 8;
  worksheet.getColumn(startColumn + 1).width = 5.2;
  worksheet.getColumn(startColumn + 2).width = 5.2;
  worksheet.getColumn(startColumn + 3).width = 10.5;
  worksheet.getColumn(startColumn + 4).width = 10.5;
  worksheet.getColumn(startColumn + 5).width = 10.5;
  worksheet.getColumn(startColumn + 6).width = 10.5;
  worksheet.getColumn(startColumn + 7).width = 5.2;
  worksheet.getColumn(startColumn + 8).width = 5.2;

  for (let unit = rack.totalUnits; unit >= 1; unit -= 1) {
    const rowIndex = rackStartRow + (rack.totalUnits - unit);
    const row = worksheet.getRow(rowIndex);
    row.height = 22;

    const labelCell = worksheet.getCell(rowIndex, startColumn);
    labelCell.value = `${unit}U`;
    labelCell.font = { name: "Bahnschrift", size: 9, color: { argb: excelPalette.slotLabel } };
    labelCell.alignment = { vertical: "middle", horizontal: "center" };
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: excelPalette.panelBackground } };
    labelCell.border = createThinBorder(excelPalette.panelBorder);

    for (let columnIndex = startColumn + 1; columnIndex <= startColumn + faceSpan - 1; columnIndex += 1) {
      const cell = worksheet.getCell(rowIndex, columnIndex);
      const isPduLane = [startColumn + 1, startColumn + 2, startColumn + 7, startColumn + 8].includes(columnIndex);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isPduLane ? excelPalette.panelBackground : excelPalette.slotBackground }
      };
      cell.border = createThinBorder(excelPalette.slotLine);
    }
  }

  rackDevices.forEach((device) => {
    if (hasSharedDepthConflictOnFace(device, rack, face)) {
      return;
    }

    const startUnit = device.startUnit ?? 1;
    const endUnit = getEndUnit(startUnit, device.heightU);
    const topRow = rackStartRow + (rack.totalUnits - endUnit);
    const bottomRow = topRow + device.heightU - 1;
    const deviceRange = getExcelDeviceRange(startColumn, device.mountPosition);

    worksheet.mergeCells(topRow, deviceRange.startColumn, bottomRow, deviceRange.endColumn);
    applyExcelRangeBorder(worksheet, topRow, bottomRow, deviceRange.startColumn, deviceRange.endColumn, excelPalette.deviceBorder);

    const deviceCell = worksheet.getCell(topRow, deviceRange.startColumn);
    deviceCell.value = deviceVisualLabel(device);
    deviceCell.font = {
      name: "Bahnschrift",
      size: isVerticalPduMountPosition(device.mountPosition) ? 7 : device.heightU === 1 ? 8 : 9,
      bold: true,
      color: { argb: excelPalette.textPrimary }
    };
    deviceCell.alignment = {
      vertical: device.heightU > 1 ? "top" : "middle",
      horizontal: "left",
      wrapText: true
    };
    deviceCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: device.allowSharedDepth ? "FFE8F3E6" : excelPalette.deviceFill }
    };
  });

  const footerRow = rackStartRow + rack.totalUnits;
  worksheet.mergeCells(footerRow, startColumn, footerRow, startColumn + faceSpan - 1);
  const footerCell = worksheet.getCell(footerRow, startColumn);
  footerCell.value = `-- ${faceLabel(face)} --`;
  footerCell.font = { name: "Bahnschrift", size: 10, bold: true, color: { argb: excelPalette.accentStrong } };
  footerCell.alignment = { vertical: "middle", horizontal: "center" };
}

function buildInventorySheet(workbook: ExcelJS.Workbook, audit: AuditExportDetail): void {
  const worksheet = workbook.addWorksheet("Inventory List", {
    properties: { tabColor: { argb: excelPalette.accent } },
    views: [{ state: "frozen", ySplit: 5 }]
  });

  worksheet.columns = [
    { header: "Site", key: "site", width: 18 },
    { header: "Room", key: "room", width: 18 },
    { header: "Audit", key: "audit", width: 20 },
    { header: "Rack", key: "rack", width: 18 },
    { header: "Group", key: "group", width: 16 },
    { header: "Start U", key: "startUnit", width: 10 },
    { header: "End U", key: "endUnit", width: 10 },
    { header: "Height U", key: "heightU", width: 10 },
    { header: "Face", key: "rackFace", width: 16 },
    { header: "Mount", key: "mountPosition", width: 24 },
    { header: "Name", key: "name", width: 24 },
    { header: "Manufacturer", key: "manufacturer", width: 20 },
    { header: "Model", key: "model", width: 22 },
    { header: "Power", key: "powerSpec", width: 14 },
    { header: "Hostname", key: "hostname", width: 18 },
    { header: "Serial", key: "serialNumber", width: 18 },
    { header: "Notes", key: "notes", width: 28 }
  ];

  worksheet.mergeCells("A1:Q1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = `${appBrandName} Inventory Export`;
  titleCell.font = { name: "Bahnschrift", size: 16, bold: true, color: { argb: excelPalette.textPrimary } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };

  worksheet.mergeCells("A2:Q2");
  const metaCell = worksheet.getCell("A2");
  metaCell.value = `${audit.siteName} | ${audit.roomName} | ${audit.name} | SO: ${audit.salesOrder ?? "-"} | ${getAuditStatusLabel(audit.status)} | ${formatAuditDateTime(audit.createdAt)} | ${audit.rackCount} rack${audit.rackCount === 1 ? "" : "s"}`;
  styleExcelMeta(metaCell);

  worksheet.mergeCells("A3:Q3");
  const notesCell = worksheet.getCell("A3");
  notesCell.value = audit.notes ? `Notes: ${audit.notes}` : "Notes: -";
  styleExcelMeta(notesCell);

  const headerRow = worksheet.getRow(5);
  headerRow.values = [null, ...worksheet.columns.map((column) => columnHeaderLabel(column))];
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Bahnschrift", size: 10, bold: true, color: { argb: excelPalette.textPrimary } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = createThinBorder("FFD6D0C9");
  });

  audit.racks.forEach((rack) => {
    const capacitySummary = getRackCapacitySummary(rack.totalUnits, rack.devices);
    const rackRow = worksheet.addRow({
      site: "",
      room: "",
      audit: "",
      rack: `${rack.name} (${rack.totalUnits}U)`
    });
    worksheet.mergeCells(`A${rackRow.number}:Q${rackRow.number}`);
    const rackCell = worksheet.getCell(`A${rackRow.number}`);
    rackCell.value = `Rack: ${rack.name} (${rack.totalUnits}U | ${rack.widthMm}x${rack.depthMm}x${rack.heightMm} mm) | SO: ${audit.salesOrder ?? "-"} | ${getAuditStatusLabel(audit.status)}`;
    rackCell.font = { name: "Bahnschrift", size: 10, bold: true, color: { argb: excelPalette.accentStrong } };
    rackCell.alignment = { vertical: "middle", horizontal: "left" };
    rackCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: excelPalette.panelBackground } };
    rackCell.border = createThinBorder(excelPalette.panelBorder);

    const capacityRow = worksheet.addRow([]);
    capacityRow.height = 18;
    drawExcelCapacityBar(worksheet, capacityRow.number, 1, 2, 3, 8, capacitySummary.front);
    drawExcelCapacityBar(worksheet, capacityRow.number, 9, 10, 11, 16, capacitySummary.rear);

    const rackDevices = installedDevices(rack);
    const groups = groupDevicesForExport(rackDevices);
    if (groups.length === 0) {
      const emptyRow = worksheet.addRow({
        site: audit.siteName,
        room: audit.roomName,
        audit: audit.name,
        rack: rack.name,
        group: "No devices documented"
      });
      emptyRow.eachCell((cell) => {
        cell.font = { name: "Bahnschrift", size: 10, color: { argb: excelPalette.textSecondary } };
        cell.alignment = { vertical: "middle", horizontal: "left" };
        cell.border = createThinBorder("FFE0DBD4");
      });
      return;
    }

    groups.forEach((group) => {
      const groupRow = worksheet.addRow({
        group: group.label
      });
      worksheet.mergeCells(`A${groupRow.number}:Q${groupRow.number}`);
      const groupCell = worksheet.getCell(`A${groupRow.number}`);
      groupCell.value = group.label;
      groupCell.font = { name: "Bahnschrift", size: 10, bold: true, color: { argb: excelPalette.accentStrong } };
      groupCell.alignment = { vertical: "middle", horizontal: "left" };
      groupCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      groupCell.border = createThinBorder(excelPalette.slotLine);

      group.devices.forEach((device) => {
        const row = worksheet.addRow({
          site: audit.siteName,
          room: audit.roomName,
          audit: audit.name,
          rack: rack.name,
          group: group.label,
          startUnit: device.startUnit,
          endUnit: getEndUnit(device.startUnit ?? 1, device.heightU),
          heightU: device.heightU,
          rackFace: deviceFaceLabel(device),
          mountPosition: deviceMountLabel(device),
          name: device.name,
          manufacturer: device.manufacturer,
          model: device.model,
          powerSpec: formatPowerSpec(device) ?? "",
          hostname: device.hostname ?? "",
          serialNumber: device.serialNumber ?? "",
          notes: [device.allowSharedDepth ? "Shared depth shelf placement" : null, device.notes ?? null].filter(Boolean).join(" | ")
        });
        row.eachCell((cell) => {
          cell.font = { name: "Bahnschrift", size: 10, color: { argb: excelPalette.textPrimary } };
          cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
          cell.border = createThinBorder("FFE0DBD4");
        });
      });
    });
  });
}

function safeSheetName(base: string, usedNames: Set<string>): string {
  const normalizedBase = base.replace(/[\\/*?:[\]]/g, " ").trim() || "Rack";
  let candidate = normalizedBase.slice(0, 31);
  let counter = 2;

  while (usedNames.has(candidate)) {
    const suffix = ` ${counter}`;
    candidate = `${normalizedBase.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
    counter += 1;
  }

  usedNames.add(candidate);
  return candidate;
}

function buildRackViewSheet(workbook: ExcelJS.Workbook, audit: AuditExportDetail, rack: RackDetail, usedNames: Set<string>): void {
  const worksheet = workbook.addWorksheet(safeSheetName(`Rack ${rack.name}`, usedNames), {
    properties: { tabColor: { argb: excelPalette.accentStrong } }
  });
  const capacitySummary = getRackCapacitySummary(rack.totalUnits, rack.devices);

  worksheet.views = [{ showGridLines: false }];
  worksheet.properties.defaultRowHeight = 22;

  worksheet.mergeCells("A1:R1");
  styleExcelTitle(worksheet.getCell("A1"), `${appBrandName} Rack View`);

  worksheet.mergeCells("A2:R2");
  worksheet.getCell("A2").value = `${audit.siteName} | ${audit.roomName} | ${audit.name} | SO: ${audit.salesOrder ?? "-"} | ${getAuditStatusLabel(audit.status)} | ${formatAuditDateTime(audit.createdAt)} | ${rack.name} | ${rack.totalUnits}U | ${rack.widthMm}x${rack.depthMm}x${rack.heightMm} mm`;
  styleExcelMeta(worksheet.getCell("A2"));

  worksheet.mergeCells("A3:R3");
  worksheet.getCell("A3").value = audit.notes ? `Notes: ${audit.notes}` : "Notes: -";
  styleExcelMeta(worksheet.getCell("A3"));

  worksheet.getRow(4).height = 18;
  drawExcelCapacityBar(worksheet, 4, 1, 2, 3, 9, capacitySummary.front);
  drawExcelCapacityBar(worksheet, 4, 10, 11, 12, 18, capacitySummary.rear);

  drawExcelRackFace(worksheet, rack, "front", 1, 6);
  drawExcelRackFace(worksheet, rack, "rear", 10, 6);
}

function drawPdfPageBackground(pdf: PdfDocument): void {
  pdf.save();
  pdf.rect(0, 0, pdf.page.width, pdf.page.height).fill(pdfPalette.pageBackground);
  pdf.restore();
}

function drawPdfCapacityBar(pdf: PdfDocument, x: number, y: number, width: number, stats: RackFaceCapacityStats): void {
  const labelWidth = 76;
  const valueWidth = 90;
  const barGap = 8;
  const barWidth = Math.max(52, width - labelWidth - valueWidth - barGap * 2);
  const barHeight = 8;
  const barY = y + 1;
  const fillWidth = Math.max(0, Math.min(barWidth, Math.round((stats.usedPercent / 100) * barWidth)));
  const fillRadiusWidth = fillWidth > 0 ? Math.max(fillWidth, barHeight) : 0;

  pdf.fillColor(pdfPalette.textSecondary).fontSize(7.8).text(faceLabel(stats.face).toUpperCase(), x, y + 1, {
    width: labelWidth
  });

  pdf.save();
  pdf.roundedRect(x + labelWidth + barGap, barY, barWidth, barHeight, 999).fill(pdfPalette.capacityTrack);
  pdf
    .roundedRect(x + labelWidth + barGap, barY, barWidth, barHeight, 999)
    .lineWidth(0.45)
    .strokeColor("#d7e0e7")
    .stroke();
  if (fillRadiusWidth > 0) {
    pdf.roundedRect(x + labelWidth + barGap, barY, fillRadiusWidth, barHeight, 999).fill(getPdfCapacityFill(stats.tone));
  }
  pdf.restore();

  pdf
    .fillColor(pdfPalette.textPrimary)
    .fontSize(7.8)
    .text(`${stats.usedPercent}% used`, x + labelWidth + barGap + barWidth + barGap, y + 1, {
      width: valueWidth,
      align: "right"
    });
}

function drawPdfHeader(
  pdf: PdfDocument,
  audit: AuditExportDetail,
  title: string,
  subtitle: string,
  rack?: RackDetail,
  capacitySections?: Array<{ x: number; width: number; stats: RackFaceCapacityStats }>,
  metaPartsOverride?: string[]
): number {
  const headerX = 36;
  const headerWidth = pdf.page.width - 72;
  const metaParts = metaPartsOverride ?? (rack
    ? [
        audit.siteName,
        audit.roomName,
        audit.name,
        `SO: ${audit.salesOrder ?? "-"}`,
        getAuditStatusLabel(audit.status),
        formatAuditDateTime(audit.createdAt),
        rack.name,
        `${rack.totalUnits}U`,
        `${rack.widthMm}x${rack.depthMm}x${rack.heightMm} mm`
      ]
    : [
        audit.siteName,
        audit.roomName,
        audit.name,
        `SO: ${audit.salesOrder ?? "-"}`,
        getAuditStatusLabel(audit.status),
        formatAuditDateTime(audit.createdAt),
        `${audit.rackCount} rack${audit.rackCount === 1 ? "" : "s"}`
      ]);

  if (!metaPartsOverride && audit.notes) {
    metaParts.push(`Notes: ${audit.notes}`);
  }

  const metaText = metaParts.join(" | ");
  const metaY = 50;
  pdf.fontSize(9.5);
  const metaHeight = Math.max(
    12,
    pdf.heightOfString(metaText, {
      width: headerWidth
    })
  );

  pdf.fillColor(pdfPalette.textPrimary).fontSize(17).text(title, headerX, 28, {
    width: 220
  });
  pdf.fillColor(pdfPalette.textSecondary).fontSize(9).text(subtitle, headerX + 224, 32, {
    width: headerWidth - 224,
    align: "right"
  });
  pdf.fillColor(pdfPalette.textSecondary).fontSize(9.5).text(metaText, headerX, metaY, {
    width: headerWidth,
    ellipsis: true
  });

  if (rack) {
    const capacitySummary = getRackCapacitySummary(rack.totalUnits, rack.devices);
    const sections = capacitySections ?? [
      { x: headerX, width: (headerWidth - 14) / 2, stats: capacitySummary.front },
      { x: headerX + (headerWidth / 2) + 7, width: (headerWidth - 14) / 2, stats: capacitySummary.rear }
    ];
    const barY = metaY + metaHeight + 8;

    sections.forEach((section) => {
      drawPdfCapacityBar(pdf, section.x, barY, section.width, section.stats);
    });

    pdf.y = barY + 20;
    return pdf.y;
  }

  pdf.y = metaY + metaHeight + 10;
  return pdf.y;
}

function drawPdfPortraitHeaderBackground(pdf: PdfDocument, x: number, y: number, width: number, height: number): void {
  if (existsSync(pdfAssetPaths.portraitHeaderBackground)) {
    pdf.image(pdfAssetPaths.portraitHeaderBackground, x, y, { width, height });
  } else {
    pdf.save();
    pdf.rect(x, y, width, height).fill("#afe6e9");
    pdf.restore();
  }
}

function drawPdfPortraitFooter(pdf: PdfDocument): void {
  const currentY = pdf.y;
  const footerX = 36;
  const footerY = pdf.page.height - pdfPortraitFooterBottomInset - pdfPortraitFooterHeight;
  const footerTextX = footerX;
  const footerTextY = footerY + 8;

  setPdfArialFont(pdf, true);
  pdf.fillColor(pdfPortraitFooterRed).fontSize(10).text("Equinix.com", footerTextX, footerTextY, {
    lineBreak: false
  });

  const equinixWidth = pdf.widthOfString("Equinix.com");
  setPdfArialFont(pdf);
  pdf.fillColor(pdfPortraitFooterText).fontSize(8).text("     © 2026 Equinix, Inc. ", footerTextX + equinixWidth + 6, footerTextY + 1, {
    lineBreak: false
  });
  pdf.y = currentY;
}

function drawPdfPortraitHeader(
  pdf: PdfDocument,
  audit: AuditExportDetail,
  title: string,
  subtitle: string,
  rack?: RackDetail,
  capacitySections?: Array<{ x: number; width: number; stats: RackFaceCapacityStats }>,
  metaPartsOverride?: string[]
): number {
  const headerX = 0;
  const headerWidth = pdf.page.width;
  const innerX = 36;
  const innerWidth = pdf.page.width - 72;
  const metaParts = metaPartsOverride ?? (rack
    ? [
        audit.siteName,
        audit.roomName,
        audit.name,
        `SO: ${audit.salesOrder ?? "-"}`,
        getAuditStatusLabel(audit.status),
        formatAuditDateTime(audit.createdAt),
        rack.name,
        `${rack.totalUnits}U`,
        `${rack.widthMm}x${rack.depthMm}x${rack.heightMm} mm`
      ]
    : [
        audit.siteName,
        audit.roomName,
        audit.name,
        `SO: ${audit.salesOrder ?? "-"}`,
        getAuditStatusLabel(audit.status),
        formatAuditDateTime(audit.createdAt),
        `${audit.rackCount} rack${audit.rackCount === 1 ? "" : "s"}`
      ]);

  if (!metaPartsOverride && audit.notes) {
    metaParts.push(`Notes: ${audit.notes}`);
  }

  const metaText = metaParts.join(" | ");
  const titleY = pdfPortraitHeaderTop + 24;
  const subtitleY = pdfPortraitHeaderTop + 28;
  const metaY = pdfPortraitHeaderTop + 46;
  pdf.fontSize(9.5);
  const metaHeight = Math.max(
    12,
    pdf.heightOfString(metaText, {
      width: innerWidth
    })
  );
  const headerBottomY = rack ? metaY + metaHeight + 28 : metaY + metaHeight + 12;
  const headerHeight = headerBottomY - pdfPortraitHeaderTop;

  drawPdfPortraitHeaderBackground(pdf, headerX, pdfPortraitHeaderTop, headerWidth, headerHeight);

  pdf.fillColor(pdfPalette.textPrimary).fontSize(17).text(title, innerX, titleY, {
    width: 230
  });
  pdf.fillColor(pdfPalette.textSecondary).fontSize(9).text(subtitle, innerX + 234, subtitleY, {
    width: innerWidth - 234,
    align: "right"
  });
  pdf.fillColor(pdfPalette.textSecondary).fontSize(9.5).text(metaText, innerX, metaY, {
    width: innerWidth,
    ellipsis: true
  });

  if (rack) {
    const capacitySummary = getRackCapacitySummary(rack.totalUnits, rack.devices);
    const sections = capacitySections ?? [
      { x: 36, width: (pdf.page.width - 86) / 2, stats: capacitySummary.front },
      { x: 36 + ((pdf.page.width - 72) / 2) + 7, width: (pdf.page.width - 86) / 2, stats: capacitySummary.rear }
    ];
    const barY = metaY + metaHeight + 8;

    sections.forEach((section) => {
      drawPdfCapacityBar(pdf, section.x, barY, section.width, section.stats);
    });

    pdf.y = headerBottomY + 10;
    return pdf.y;
  }

  pdf.y = headerBottomY + 10;
  return pdf.y;
}

function buildPdfRackHeaderMetaParts(audit: AuditExportDetail, rack: RackDetail): string[] {
  return [
    audit.siteName,
    audit.roomName,
    audit.name,
    `SO: ${audit.salesOrder ?? "-"}`,
    `Exported: ${formatAuditDateTime(new Date())}`,
    `Rack number: ${rack.name}`,
    `Cabinet information: ${rack.totalUnits}U | ${rack.widthMm}x${rack.depthMm}x${rack.heightMm} mm`
  ];
}

function getPdfRackDeviceFrame(
  layout: Pick<
    ReturnType<typeof getPdfRackFaceLayoutForFace>,
    "rackX" | "rackWidth" | "leftPduMountPositions" | "rightPduMountPositions" | "sidePadding" | "pduLaneWidth" | "laneGap" | "fullX" | "fullWidth"
  >,
  mountPosition: RackMountPosition
): { x: number; width: number } {
  if (mountPosition === "full") {
    return { x: layout.fullX, width: layout.fullWidth };
  }

  const leftIndex = layout.leftPduMountPositions.indexOf(mountPosition);
  if (leftIndex >= 0) {
    return {
      x: layout.rackX + layout.sidePadding + leftIndex * (layout.pduLaneWidth + layout.laneGap),
      width: layout.pduLaneWidth
    };
  }

  const rightIndex = layout.rightPduMountPositions.indexOf(mountPosition);
  if (rightIndex >= 0) {
    return {
      x: layout.rackX + layout.rackWidth - layout.sidePadding - layout.pduLaneWidth - rightIndex * (layout.pduLaneWidth + layout.laneGap),
      width: layout.pduLaneWidth
    };
  }

  return { x: layout.fullX, width: layout.fullWidth };
}

function getPdfDeviceCornerRadius(height: number, isPdu: boolean): number {
  if (isPdu) {
    return Math.max(1.5, Math.min(3, height * 0.12));
  }

  return Math.max(1.5, Math.min(3.5, height * 0.1));
}

function getPdfRackFaceLayoutForFace(
  x: number,
  width: number,
  leftPduMountPositions: RackMountPosition[],
  rightPduMountPositions: RackMountPosition[]
): {
  labelX: number;
  labelWidth: number;
  leftCalloutX: number;
  calloutWidth: number;
  rackX: number;
  rackWidth: number;
  rightCalloutX: number;
  leftPduMountPositions: RackMountPosition[];
  rightPduMountPositions: RackMountPosition[];
  sidePadding: number;
  pduLaneWidth: number;
  laneGap: number;
  fullX: number;
  fullWidth: number;
} {
  const labelWidth = 28;
  const calloutWidth = 94;
  const calloutGap = 6;
  const leftCalloutWidth = leftPduMountPositions.length > 0 ? calloutWidth : 0;
  const rightCalloutWidth = rightPduMountPositions.length > 0 ? calloutWidth : 0;
  const leftCalloutGap = leftCalloutWidth > 0 ? calloutGap : 0;
  const rightCalloutGap = rightCalloutWidth > 0 ? calloutGap : 0;
  const labelX = x + leftCalloutWidth + leftCalloutGap;
  const rackX = labelX + labelWidth;
  const rackWidth = width - labelWidth - leftCalloutWidth - rightCalloutWidth - leftCalloutGap - rightCalloutGap;
  const sidePadding = 10;
  const pduLaneWidth = 18;
  const laneGap = 8;
  const centerGap = 16;
  const leftPduWidth =
    leftPduMountPositions.length * pduLaneWidth +
    Math.max(0, leftPduMountPositions.length - 1) * laneGap +
    (leftPduMountPositions.length > 0 ? centerGap : 0);
  const rightPduWidth =
    rightPduMountPositions.length * pduLaneWidth +
    Math.max(0, rightPduMountPositions.length - 1) * laneGap +
    (rightPduMountPositions.length > 0 ? centerGap : 0);
  const fullX = rackX + sidePadding + leftPduWidth;
  const fullWidth = rackWidth - sidePadding * 2 - leftPduWidth - rightPduWidth;

  return {
    labelX,
    labelWidth,
    leftCalloutX: x,
    calloutWidth,
    rackX,
    rackWidth,
    rightCalloutX: rackX + rackWidth + rightCalloutGap,
    leftPduMountPositions,
    rightPduMountPositions,
    sidePadding,
    pduLaneWidth,
    laneGap,
    fullX,
    fullWidth
  };
}

function getPdfPduCalloutSide(mountPosition: RackMountPosition): "left" | "right" {
  return mountPosition.includes("-left-") ? "left" : "right";
}

function getPdfPduLegendColors(mountPosition: RackMountPosition): { fill: string; border: string; text: string } {
  return mountPosition.includes("-outer")
    ? { fill: "#fee2e2", border: "#dc2626", text: "#991b1b" }
    : { fill: "#dbeafe", border: "#2563eb", text: "#1d4ed8" };
}

function getPdfPortraitSingleLaneColors(side: "left" | "right"): { fill: string; border: string; text: string } {
  return side === "left"
    ? { fill: "#fee2e2", border: "#dc2626", text: "#991b1b" }
    : { fill: "#dbeafe", border: "#2563eb", text: "#1d4ed8" };
}

function getPdfPortraitRenderedPduMeta(
  face: RackFace,
  mountPosition: RackMountPosition,
  visiblePduMountPositions: RackMountPosition[]
): { fill: string; border: string; text: string; label: string } {
  const side = getPduLaneSide(mountPosition);
  if (side === null) {
    return {
      ...getPdfPduLegendColors(mountPosition),
      label: getRackMountPositionLabel(mountPosition)
    };
  }

  const sideVisibleMountPositions = visiblePduMountPositions.filter((entry) => getPduLaneSide(entry) === side);
  if (sideVisibleMountPositions.length <= 1) {
    return {
      ...getPdfPortraitSingleLaneColors(side),
      label: `${faceLabel(face)} ${side} PDU lane`
    };
  }

  const renderedIndex = Math.max(0, sideVisibleMountPositions.indexOf(mountPosition));
  const colors = renderedIndex === 0 ? getPdfPortraitSingleLaneColors("left") : getPdfPortraitSingleLaneColors("right");
  return {
    ...colors,
    label: `${faceLabel(face)} ${side} ${renderedIndex === 0 ? "outer" : "inner"} PDU lane`
  };
}

function getPdfPortraitRackFaceFixedWidthAdjustment(leftPduCount: number, rightPduCount: number): number {
  const labelWidth = 24;
  const labelGap = 4;
  const sidePadding = 6;
  const pduLaneWidth = 18;
  const laneGap = 4;
  const centerGap = 8;
  const leftPduWidth = leftPduCount * pduLaneWidth + Math.max(0, leftPduCount - 1) * laneGap + (leftPduCount > 0 ? centerGap : 0);
  const rightPduWidth = rightPduCount * pduLaneWidth + Math.max(0, rightPduCount - 1) * laneGap + (rightPduCount > 0 ? centerGap : 0);

  return labelWidth + labelGap + sidePadding * 2 + leftPduWidth + rightPduWidth;
}

function getPdfPortraitRackFaceLayout(
  x: number,
  width: number,
  leftPduMountPositions: RackMountPosition[],
  rightPduMountPositions: RackMountPosition[]
): {
  labelX: number;
  labelWidth: number;
  rackX: number;
  rackWidth: number;
  leftPduMountPositions: RackMountPosition[];
  rightPduMountPositions: RackMountPosition[];
  sidePadding: number;
  pduLaneWidth: number;
  laneGap: number;
  fullX: number;
  fullWidth: number;
} {
  const labelWidth = 24;
  const labelGap = 4;
  const rackX = x + labelWidth + labelGap;
  const rackWidth = width - labelWidth - labelGap;
  const sidePadding = 6;
  const pduLaneWidth = 18;
  const laneGap = 4;
  const centerGap = 8;
  const leftPduWidth =
    leftPduMountPositions.length * pduLaneWidth +
    Math.max(0, leftPduMountPositions.length - 1) * laneGap +
    (leftPduMountPositions.length > 0 ? centerGap : 0);
  const rightPduWidth =
    rightPduMountPositions.length * pduLaneWidth +
    Math.max(0, rightPduMountPositions.length - 1) * laneGap +
    (rightPduMountPositions.length > 0 ? centerGap : 0);

  return {
    labelX: x,
    labelWidth,
    rackX,
    rackWidth,
    leftPduMountPositions,
    rightPduMountPositions,
    sidePadding,
    pduLaneWidth,
    laneGap,
    fullX: rackX + sidePadding + leftPduWidth,
    fullWidth: rackWidth - sidePadding * 2 - leftPduWidth - rightPduWidth
  };
}

function getPdfPortraitPduLegendHeight(devices: RackDevice[]): number {
  const pduDevices = devices.filter((device) => isVerticalPduMountPosition(device.mountPosition));
  if (pduDevices.length === 0) {
    return 0;
  }

  return 20 + pduDevices.length * 28 + Math.max(0, pduDevices.length - 1) * 6;
}

function drawPdfPortraitPduLegend(
  pdf: PdfDocument,
  face: RackFace,
  devices: RackDevice[],
  visiblePduMountPositions: RackMountPosition[],
  x: number,
  y: number,
  width: number
): number {
  const pduDevices = devices
    .filter((device) => isVerticalPduMountPosition(device.mountPosition))
    .sort((left, right) => compareDevicesForGroupedExport(left, right));

  if (pduDevices.length === 0) {
    return y;
  }

  pdf.fillColor(pdfPalette.accentStrong).fontSize(9).text("PDU legend", x, y, {
    width
  });

  let currentY = y + 14;
  pduDevices.forEach((device) => {
    const colors = getPdfPortraitRenderedPduMeta(face, device.mountPosition, visiblePduMountPositions);
    const cardHeight = 22;
    const swatchSize = 12;
    const line = `${colors.label} | ${device.name} | ${deviceSecondaryLine(device)} | ${devicePositionLabel(device)}`;

    pdf.save();
    pdf.roundedRect(x, currentY, width, cardHeight, 8).fill("#ffffff");
    pdf.roundedRect(x, currentY, width, cardHeight, 8).lineWidth(0.8).strokeColor(pdfPalette.panelBorder).stroke();
    pdf.roundedRect(x + 6, currentY + 5, swatchSize, swatchSize, 4).fill(colors.fill);
    pdf.roundedRect(x + 6, currentY + 5, swatchSize, swatchSize, 4).lineWidth(0.8).strokeColor(colors.border).stroke();
    pdf.restore();

    pdf.fillColor(colors.text).fontSize(7.2).text(line, x + 24, currentY + 6, {
      width: width - 30,
      ellipsis: true
    });

    currentY += cardHeight + 6;
  });

  return currentY;
}

function drawPdfPduCallouts(
  pdf: PdfDocument,
  devices: RackDevice[],
  leftCalloutX: number,
  rightCalloutX: number,
  rackY: number,
  calloutWidth: number,
  unitHeight: number,
  rackUnits: number,
  layout: ReturnType<typeof getPdfRackFaceLayoutForFace>
): void {
  const pduDevices = devices.filter((device) => isVerticalPduMountPosition(device.mountPosition));
  if (pduDevices.length === 0) {
    return;
  }

  const sideOrder: Array<"left" | "right"> = ["left", "right"];
  const lineHeight = 7.4;
  const calloutGap = 6;
  const calloutPadding = 6;
  const calloutStartY = rackY + 10;

  sideOrder.forEach((side) => {
    const sideDevices = pduDevices
      .filter((device) => getPdfPduCalloutSide(device.mountPosition) === side)
      .sort((left, right) => left.mountPosition.localeCompare(right.mountPosition));

    sideDevices.forEach((device, index) => {
      const startUnit = device.startUnit ?? 1;
      const endUnit = getEndUnit(startUnit, device.heightU);
      const topY = rackY + (rackUnits - endUnit) * unitHeight + 1;
      const height = Math.max(unitHeight * device.heightU - 2, unitHeight - 2);
      const frame = getPdfRackDeviceFrame(layout, device.mountPosition);
      const anchorX = side === "left" ? frame.x + frame.width : frame.x;
      const anchorY = topY + height / 2;
      const lines = deviceVisualLines(device);
      const calloutHeight = lines.length * lineHeight + calloutPadding * 2;
      const calloutX = side === "left" ? leftCalloutX : rightCalloutX;
      const calloutY = calloutStartY + index * (calloutHeight + calloutGap);
      const lineStartX = side === "left" ? calloutX + calloutWidth : calloutX;
      const lineStartY = calloutY + calloutHeight / 2;

      pdf.save();
      pdf.roundedRect(calloutX, calloutY, calloutWidth, calloutHeight, 6).fill("#ffffff");
      pdf.roundedRect(calloutX, calloutY, calloutWidth, calloutHeight, 6).lineWidth(0.7).strokeColor(pdfPalette.deviceBorder).stroke();
      pdf.restore();

      pdf.save();
      pdf.moveTo(lineStartX, lineStartY).lineTo(anchorX, anchorY).lineWidth(0.7).strokeColor(pdfPalette.accentStrong).stroke();
      pdf.restore();

      lines.forEach((line, lineIndex) => {
        pdf
          .fillColor(lineIndex === 0 ? pdfPalette.textPrimary : pdfPalette.textSecondary)
          .fontSize(lineIndex === 0 ? 6.4 : 5.8)
          .text(line, calloutX + calloutPadding, calloutY + calloutPadding + lineIndex * lineHeight, {
            width: calloutWidth - calloutPadding * 2,
            lineBreak: false,
            ellipsis: true
          });
      });
    });
  });
}

function drawPdfRackFace(pdf: PdfDocument, rack: RackDetail, face: RackFace, x: number, y: number, width: number): void {
  const unitHeight = Math.max(8, Math.min(11, Math.floor((pdf.page.height - y - 52) / rack.totalUnits)));
  const rackHeight = unitHeight * rack.totalUnits;
  const innerPadding = 8;
  const devices = visibleDevicesForFace(rack, face);
  const visiblePduMountPositions = getVisiblePduMountPositionsForFace(face, rack.devices);
  const layout = getPdfRackFaceLayoutForFace(
    x,
    width,
    visiblePduMountPositions.filter((mountPosition) => getPduLaneSide(mountPosition) === "left"),
    visiblePduMountPositions.filter((mountPosition) => getPduLaneSide(mountPosition) === "right")
  );

  pdf.fillColor(pdfPalette.accentStrong).fontSize(9).text(`-- ${faceLabel(face)} --`, layout.rackX, y - 20, {
    width: layout.rackWidth,
    align: "center"
  });

  pdf.save();
  pdf.roundedRect(layout.rackX, y, layout.rackWidth, rackHeight, 10).fill(pdfPalette.panelBackground);
  pdf.roundedRect(layout.rackX, y, layout.rackWidth, rackHeight, 10).lineWidth(1).strokeColor(pdfPalette.panelBorder).stroke();
  pdf.restore();

  for (let unit = rack.totalUnits; unit >= 1; unit -= 1) {
    const rowY = y + (rack.totalUnits - unit) * unitHeight;

    pdf.save();
    pdf.rect(layout.rackX, rowY, layout.rackWidth, unitHeight).fill(pdfPalette.slotBackground);
    pdf.rect(layout.rackX, rowY, layout.rackWidth, unitHeight).lineWidth(0.5).strokeColor(pdfPalette.slotLine).stroke();
    pdf.restore();

    pdf.fillColor(pdfPalette.slotLabel).fontSize(7).text(`${unit}U`, layout.labelX, rowY + 3, {
      width: layout.labelWidth - 6,
      align: "right"
    });
  }

  devices.forEach((device) => {
    const startUnit = device.startUnit ?? 1;
    const endUnit = getEndUnit(startUnit, device.heightU);
    const topY = y + (rack.totalUnits - endUnit) * unitHeight + 1;
    const height = Math.max(unitHeight * device.heightU - 2, unitHeight - 2);
    const frame = getPdfRackDeviceFrame(layout, device.mountPosition);
    const iconSize = Math.min(14, Math.max(8, Math.min(height - 6, frame.width * 0.22)));
    const isPdu = isVerticalPduMountPosition(device.mountPosition);
    const isMirroredFromOppositeFace = device.blocksBothFaces && device.rackFace !== null && device.rackFace !== face;
    const isSharedDepthDevice = device.allowSharedDepth && !isMirroredFromOppositeFace;
    const showIcon = frame.width >= 24 && height >= 12 && !isPdu;
    const cornerRadius = getPdfDeviceCornerRadius(height, isPdu);
    const textX = frame.x + innerPadding + (showIcon ? iconSize + 6 : 0);
    const textWidth = frame.width - innerPadding * 2 - (showIcon ? iconSize + 6 : 0);
    const lines = deviceVisualLines(device);
    const baseFontSize = isPdu ? 5.8 : device.heightU === 1 ? 6.2 : device.heightU === 2 ? 6.8 : 7.2;
    const minimumFontSize = isPdu ? 5.2 : device.heightU === 1 ? 4.8 : 5.2;
    const verticalPadding = isPdu ? 3 : device.heightU === 1 ? 1.5 : 2.5;
    const availableTextHeight = Math.max(4, height - verticalPadding * 2);
    const fontSize = Math.min(
      baseFontSize,
      Math.max(minimumFontSize, (availableTextHeight - Math.max(0, lines.length - 1) * 1.2) / lines.length)
    );
    const lineHeight = fontSize + 1.2;
    const textBlockHeight = lines.length * lineHeight;
    const startTextY = isPdu ? topY + 3 : topY + Math.max(verticalPadding, (height - textBlockHeight) / 2);

    pdf.save();
    pdf
      .roundedRect(frame.x, topY, frame.width, height, cornerRadius)
      .fill(isMirroredFromOppositeFace ? "#edf3f7" : isSharedDepthDevice ? "#e8f3e6" : pdfPalette.deviceFill);
    if (isSharedDepthDevice) {
      pdf.dash(3, { space: 2 });
    }
    pdf
      .roundedRect(frame.x, topY, frame.width, height, cornerRadius)
      .lineWidth(0.8)
      .strokeColor(isSharedDepthDevice ? "#6f9d62" : pdfPalette.deviceBorder)
      .stroke();
    if (isSharedDepthDevice) {
      pdf.undash();
    }

    if (isMirroredFromOppositeFace) {
      pdf.save();
      pdf.roundedRect(frame.x, topY, frame.width, height, isPdu ? 6 : 8).clip();
      pdf.opacity(0.22);
      for (let offset = -height; offset < frame.width + height; offset += 8) {
        pdf
          .moveTo(frame.x + offset, topY + height)
          .lineTo(frame.x + offset + height, topY)
          .lineWidth(0.55)
          .strokeColor(pdfPalette.accentStrong)
          .stroke();
      }
      pdf.restore();
    }
    pdf.restore();

    if (showIcon) {
      const iconY = device.heightU > 1 ? topY + Math.max(2, verticalPadding) : topY + Math.max(2, (height - iconSize) / 2);
      drawPdfDeviceIcon(pdf, device.iconKey, frame.x + innerPadding, iconY, iconSize);
    }

    if (!isPdu) {
      lines.forEach((line, index) => {
        pdf.fillColor(index === 0 ? pdfPalette.textPrimary : pdfPalette.textSecondary).fontSize(fontSize).text(line, textX + 2, startTextY + index * lineHeight, {
          width: textWidth - 4,
          lineBreak: false,
          ellipsis: true
        });
      });
    }
  });

  drawPdfPduCallouts(
    pdf,
    devices,
    layout.leftCalloutX,
    layout.rightCalloutX,
    y,
    layout.calloutWidth,
    unitHeight,
    rack.totalUnits,
    layout
  );

  const footerY = y + rackHeight + 4;
  pdf.fillColor(pdfPalette.accentStrong).fontSize(9).text(`-- ${faceLabel(face)} --`, layout.rackX, footerY, {
    width: layout.rackWidth,
    align: "center"
  });
}

function drawPdfPortraitRackFace(
  pdf: PdfDocument,
  rack: RackDetail,
  face: RackFace,
  x: number,
  y: number,
  width: number,
  unitHeight: number
): number {
  const visiblePduMountPositions = getVisiblePduMountPositionsForFace(face, rack.devices);
  const leftPduMountPositions = visiblePduMountPositions.filter((mountPosition) => getPduLaneSide(mountPosition) === "left");
  const rightPduMountPositions = visiblePduMountPositions.filter((mountPosition) => getPduLaneSide(mountPosition) === "right");
  const layout = getPdfPortraitRackFaceLayout(x, width, leftPduMountPositions, rightPduMountPositions);
  const devices = visibleDevicesForFace(rack, face);
  const rackHeight = unitHeight * rack.totalUnits;
  const innerPadding = 6;

  pdf.fillColor(pdfPalette.accentStrong).fontSize(9.2).text(`-- ${faceLabel(face)} --`, layout.rackX, y - 20, {
    width: layout.rackWidth,
    align: "center"
  });

  pdf.save();
  pdf.roundedRect(layout.rackX, y, layout.rackWidth, rackHeight, 10).fill(pdfPalette.panelBackground);
  pdf.roundedRect(layout.rackX, y, layout.rackWidth, rackHeight, 10).lineWidth(1).strokeColor(pdfPalette.panelBorder).stroke();
  pdf.restore();

  for (let unit = rack.totalUnits; unit >= 1; unit -= 1) {
    const rowY = y + (rack.totalUnits - unit) * unitHeight;

    pdf.save();
    pdf.rect(layout.rackX, rowY, layout.rackWidth, unitHeight).fill(pdfPalette.slotBackground);
    pdf.rect(layout.rackX, rowY, layout.rackWidth, unitHeight).lineWidth(0.5).strokeColor(pdfPalette.slotLine).stroke();
    pdf.restore();

    pdf.fillColor(pdfPalette.slotLabel).fontSize(7).text(`${unit}U`, layout.labelX, rowY + 3, {
      width: layout.labelWidth - 4,
      align: "right"
    });
  }

  devices.forEach((device) => {
    const startUnit = device.startUnit ?? 1;
    const endUnit = getEndUnit(startUnit, device.heightU);
    const topY = y + (rack.totalUnits - endUnit) * unitHeight + 1;
    const height = Math.max(unitHeight * device.heightU - 2, unitHeight - 2);
    const frame = getPdfRackDeviceFrame(layout, device.mountPosition);
    const iconSize = Math.min(13, Math.max(7, Math.min(height - 5, frame.width * 0.16)));
    const isPdu = isVerticalPduMountPosition(device.mountPosition);
    const isMirroredFromOppositeFace = device.blocksBothFaces && device.rackFace !== null && device.rackFace !== face;
    const isSharedDepthDevice = device.allowSharedDepth && !isMirroredFromOppositeFace;
    const pduColors = isPdu ? getPdfPortraitRenderedPduMeta(face, device.mountPosition, visiblePduMountPositions) : null;
    const showIcon = frame.width >= 30 && height >= 12 && !isPdu;
    const cornerRadius = getPdfDeviceCornerRadius(height, isPdu);
    const textX = frame.x + innerPadding + (showIcon ? iconSize + 4 : 0);
    const textWidth = frame.width - innerPadding * 2 - (showIcon ? iconSize + 4 : 0);
    const lines = deviceVisualLines(device);
    const baseFontSize = device.heightU === 1 ? 6.4 : device.heightU === 2 ? 7 : 7.4;
    const minimumFontSize = device.heightU === 1 ? 5 : 5.4;
    const verticalPadding = device.heightU === 1 ? 1.5 : 2.5;
    const availableTextHeight = Math.max(4, height - verticalPadding * 2);
    const fontSize = Math.min(
      baseFontSize,
      Math.max(minimumFontSize, (availableTextHeight - Math.max(0, lines.length - 1) * 1.2) / lines.length)
    );
    const lineHeight = fontSize + 1.2;
    const textBlockHeight = lines.length * lineHeight;
    const startTextY = topY + Math.max(verticalPadding, (height - textBlockHeight) / 2);

    pdf.save();
    pdf
      .roundedRect(frame.x, topY, frame.width, height, cornerRadius)
      .fill(
        isMirroredFromOppositeFace
          ? "#edf3f7"
          : isPdu
            ? pduColors!.fill
            : isSharedDepthDevice
              ? "#e8f3e6"
              : pdfPalette.deviceFill
      );
    if (isSharedDepthDevice) {
      pdf.dash(3, { space: 2 });
    }
    pdf
      .roundedRect(frame.x, topY, frame.width, height, cornerRadius)
      .lineWidth(0.8)
      .strokeColor(isPdu ? pduColors!.border : isSharedDepthDevice ? "#6f9d62" : pdfPalette.deviceBorder)
      .stroke();
    if (isSharedDepthDevice) {
      pdf.undash();
    }

    if (isMirroredFromOppositeFace) {
      pdf.save();
      pdf.roundedRect(frame.x, topY, frame.width, height, cornerRadius).clip();
      pdf.opacity(0.22);
      for (let offset = -height; offset < frame.width + height; offset += 8) {
        pdf
          .moveTo(frame.x + offset, topY + height)
          .lineTo(frame.x + offset + height, topY)
          .lineWidth(0.55)
          .strokeColor(pdfPalette.accentStrong)
          .stroke();
      }
      pdf.restore();
    }
    pdf.restore();

    if (showIcon) {
      const iconY = device.heightU > 1 ? topY + Math.max(2, verticalPadding) : topY + Math.max(2, (height - iconSize) / 2);
      drawPdfDeviceIcon(pdf, device.iconKey, frame.x + innerPadding, iconY, iconSize);
    }

    if (!isPdu) {
      lines.forEach((line, index) => {
        pdf.fillColor(index === 0 ? pdfPalette.textPrimary : pdfPalette.textSecondary).fontSize(fontSize).text(line, textX + 2, startTextY + index * lineHeight, {
          width: textWidth - 4,
          lineBreak: false,
          ellipsis: true
        });
      });
    }
  });

  const footerY = y + rackHeight + 4;
  pdf.fillColor(pdfPalette.accentStrong).fontSize(9.2).text(`-- ${faceLabel(face)} --`, layout.rackX, footerY, {
    width: layout.rackWidth,
    align: "center"
  });

  return drawPdfPortraitPduLegend(pdf, face, devices, visiblePduMountPositions, layout.rackX, footerY + 18, layout.rackWidth);
}

function drawPdfPortraitRackViewPage(pdf: PdfDocument, audit: AuditExportDetail, rack: RackDetail): void {
  drawPdfPageBackground(pdf);

  const contentX = 36;
  const contentWidth = pdf.page.width - 72;
  const rackGap = 12;
  const frontVisiblePduMountPositions = getVisiblePduMountPositionsForFace("front", rack.devices);
  const rearVisiblePduMountPositions = getVisiblePduMountPositionsForFace("rear", rack.devices);
  const frontAdjustment = getPdfPortraitRackFaceFixedWidthAdjustment(
    frontVisiblePduMountPositions.filter((mountPosition) => getPduLaneSide(mountPosition) === "left").length,
    frontVisiblePduMountPositions.filter((mountPosition) => getPduLaneSide(mountPosition) === "right").length
  );
  const rearAdjustment = getPdfPortraitRackFaceFixedWidthAdjustment(
    rearVisiblePduMountPositions.filter((mountPosition) => getPduLaneSide(mountPosition) === "left").length,
    rearVisiblePduMountPositions.filter((mountPosition) => getPduLaneSide(mountPosition) === "right").length
  );
  const sharedDeviceWidth = Math.max(150, (contentWidth - rackGap - frontAdjustment - rearAdjustment) / 2);
  const frontWidth = sharedDeviceWidth + frontAdjustment;
  const rearWidth = sharedDeviceWidth + rearAdjustment;

  const frontX = contentX;
  const rearX = frontX + frontWidth + rackGap;
  const capacitySummary = getRackCapacitySummary(rack.totalUnits, rack.devices);
  const frontLegendHeight = getPdfPortraitPduLegendHeight(visibleDevicesForFace(rack, "front"));
  const rearLegendHeight = getPdfPortraitPduLegendHeight(visibleDevicesForFace(rack, "rear"));
  const bottomPadding = Math.max(frontLegendHeight, rearLegendHeight, 26) + pdfPortraitFooterReservedSpace + 10;
  const headerMetaParts = buildPdfRackHeaderMetaParts(audit, rack);
  const rackStartY = drawPdfPortraitHeader(pdf, audit, `${appBrandName} Rack View`, `${appBrandSlogan} | Portrait`, rack, [
    { x: frontX, width: frontWidth, stats: capacitySummary.front },
    { x: rearX, width: rearWidth, stats: capacitySummary.rear }
  ], headerMetaParts);
  const unitHeight = Math.max(8, Math.min(12, Math.floor((pdf.page.height - rackStartY - bottomPadding) / rack.totalUnits)));

  drawPdfPortraitRackFace(pdf, rack, "front", frontX, rackStartY, frontWidth, unitHeight);
  drawPdfPortraitRackFace(pdf, rack, "rear", rearX, rackStartY, rearWidth, unitHeight);
  drawPdfPortraitFooter(pdf);
}

function ensurePdfTextSpace(pdf: PdfDocument, neededHeight = 36, bottomInset = 36): boolean {
  return pdf.y + neededHeight <= pdf.page.height - bottomInset;
}

function drawPdfGroupLabel(pdf: PdfDocument, title: string): void {
  pdf.moveDown(0.2);
  const currentY = pdf.y;
  pdf.fillColor(pdfPalette.accentStrong).fontSize(11).text(title, 36, currentY, {
    width: pdf.page.width - 72,
    align: "left"
  });
  pdf.moveDown(0.1);
}

function drawPdfInventoryTableHeader(pdf: PdfDocument): void {
  const x = 36;
  const y = pdf.y;
  const columns = [
    { label: "", width: 30 },
    { label: "Rack", width: 68 },
    { label: "Pos", width: 48 },
    { label: "Face", width: 42 },
    { label: "Hostname", width: 96 },
    { label: "Serial number", width: 88 },
    { label: "Power", width: 72 },
    { label: "Model", width: 150 },
    { label: "Manufacturer", width: 176 }
  ] as const;

  let columnX = x;
  columns.forEach((column) => {
    pdf.save();
    pdf.rect(columnX, y, column.width, 18).fill(pdfPalette.panelBackground);
    pdf.rect(columnX, y, column.width, 18).lineWidth(0.6).strokeColor(pdfPalette.panelBorder).stroke();
    pdf.restore();
    pdf.fillColor(pdfPalette.textPrimary).fontSize(8.3).text(column.label, columnX + 4, y + 5, {
      width: column.width - 8,
      ellipsis: true
    });
    columnX += column.width;
  });

  pdf.y = y + 18;
}

function drawPdfInventoryRow(pdf: PdfDocument, rack: RackDetail, device: RackDevice): void {
  const x = 36;
  const y = pdf.y;
  const values = [
    rack.name,
    devicePositionLabel(device),
    deviceFaceLabel(device),
    device.hostname ?? "-",
    device.serialNumber ?? "-",
    formatPowerSpec(device) ?? "-",
    device.model || "-",
    device.manufacturer || "-"
  ];
  const columns = [30, 68, 48, 42, 96, 88, 72, 150, 176];

  let columnX = x;
  columns.forEach((columnWidth, index) => {
    pdf.save();
    pdf.rect(columnX, y, columnWidth, 20).fill("#ffffff");
    pdf.rect(columnX, y, columnWidth, 20).lineWidth(0.5).strokeColor(pdfPalette.slotLine).stroke();
    pdf.restore();

    if (index === 0) {
      drawPdfDeviceIcon(pdf, device.iconKey, columnX + 6, y + 3, 14);
      columnX += columnWidth;
      return;
    }

      const value = values[index - 1];
      pdf.fillColor(pdfPalette.textPrimary).fontSize(7.6).text(value, columnX + 4, y + 5, {
        width: columnWidth - 8,
        ellipsis: true
      });
    columnX += columnWidth;
  });

  pdf.y = y + 20;
}

function startPdfInventoryPage(pdf: PdfDocument, audit: AuditExportDetail, rack: RackDetail, continuation = false): void {
  pdf.addPage(pdfLandscapePageOptions);
  drawPdfPageBackground(pdf);
  drawPdfHeader(
    pdf,
    audit,
    `${appBrandName} Device List`,
    continuation ? `${appBrandSlogan} | continued for ${rack.name}` : appBrandSlogan,
    rack,
    undefined,
    buildPdfRackHeaderMetaParts(audit, rack)
  );
}

function drawPdfGroupedInventory(pdf: PdfDocument, audit: AuditExportDetail, rack: RackDetail): void {
  const rackDevices = installedDevices(rack);

  if (rackDevices.length === 0) {
    pdf.fillColor(pdfPalette.textSecondary).fontSize(10).text("No installed devices documented.");
    return;
  }

  groupDevicesForExport(rackDevices).forEach((group) => {
    if (!ensurePdfTextSpace(pdf, 42)) {
      startPdfInventoryPage(pdf, audit, rack, true);
    }

    drawPdfGroupLabel(pdf, group.label);
    drawPdfInventoryTableHeader(pdf);

    group.devices.forEach((device) => {
      if (!ensurePdfTextSpace(pdf, 22)) {
        startPdfInventoryPage(pdf, audit, rack, true);
        drawPdfGroupLabel(pdf, group.label);
        drawPdfInventoryTableHeader(pdf);
      }

      drawPdfInventoryRow(pdf, rack, device);
    });
  });
}

function drawPdfPortraitInventoryTableHeader(pdf: PdfDocument): void {
  const x = 36;
  const y = pdf.y;
  const columns = [
    { label: "", width: 24 },
    { label: "Rack", width: 44 },
    { label: "Pos", width: 38 },
    { label: "Face", width: 34 },
    { label: "Hostname", width: 58 },
    { label: "Serial", width: 56 },
    { label: "Power", width: 52 },
    { label: "Model", width: 96 },
    { label: "Manufacturer", width: 121 }
  ] as const;

  let columnX = x;
  columns.forEach((column) => {
    pdf.save();
    pdf.rect(columnX, y, column.width, 18).fill(pdfPalette.panelBackground);
    pdf.rect(columnX, y, column.width, 18).lineWidth(0.6).strokeColor(pdfPalette.panelBorder).stroke();
    pdf.restore();
      pdf.fillColor(pdfPalette.textPrimary).fontSize(7.1).text(column.label, columnX + 3, y + 5, {
        width: column.width - 8,
        ellipsis: true
      });
    columnX += column.width;
  });

  pdf.y = y + 18;
}

function drawPdfPortraitInventoryRow(pdf: PdfDocument, rack: RackDetail, device: RackDevice): void {
  const x = 36;
  const y = pdf.y;
  const values = [
    rack.name,
    devicePositionLabel(device),
    deviceFaceLabel(device),
    device.hostname ?? "-",
    device.serialNumber ?? "-",
    formatPowerSpec(device) ?? "-",
    device.model || "-",
    device.manufacturer || "-"
  ];
  const columns = [24, 44, 38, 34, 58, 56, 52, 96, 121];

  let columnX = x;
  columns.forEach((columnWidth, index) => {
    pdf.save();
    pdf.rect(columnX, y, columnWidth, 22).fill("#ffffff");
    pdf.rect(columnX, y, columnWidth, 22).lineWidth(0.5).strokeColor(pdfPalette.slotLine).stroke();
    pdf.restore();

    if (index === 0) {
      drawPdfDeviceIcon(pdf, device.iconKey, columnX + 5, y + 4, 12);
      columnX += columnWidth;
      return;
    }

      const value = values[index - 1];
      pdf.fillColor(pdfPalette.textPrimary).fontSize(7.1).text(value, columnX + 3, y + 6, {
        width: columnWidth - 8,
        ellipsis: true
      });
    columnX += columnWidth;
  });

  pdf.y = y + 22;
}

function startPdfPortraitInventoryPage(pdf: PdfDocument, audit: AuditExportDetail, rack: RackDetail, continuation = false): void {
  pdf.addPage(pdfPortraitPageOptions);
  drawPdfPageBackground(pdf);
  drawPdfPortraitHeader(
    pdf,
    audit,
    `${appBrandName} Device List`,
    continuation ? `${appBrandSlogan} | portrait continued for ${rack.name}` : `${appBrandSlogan} | Portrait`,
    rack,
    undefined,
    buildPdfRackHeaderMetaParts(audit, rack)
  );
  drawPdfPortraitFooter(pdf);
}

function drawPdfPortraitGroupedInventory(pdf: PdfDocument, audit: AuditExportDetail, rack: RackDetail): void {
  const rackDevices = installedDevices(rack);

  if (rackDevices.length === 0) {
    pdf.fillColor(pdfPalette.textSecondary).fontSize(10).text("No installed devices documented.");
    return;
  }

  groupDevicesForExport(rackDevices).forEach((group) => {
    if (!ensurePdfTextSpace(pdf, 42, pdfPortraitFooterReservedSpace)) {
      startPdfPortraitInventoryPage(pdf, audit, rack, true);
    }

    drawPdfGroupLabel(pdf, group.label);
    drawPdfPortraitInventoryTableHeader(pdf);

    group.devices.forEach((device) => {
      if (!ensurePdfTextSpace(pdf, 24, pdfPortraitFooterReservedSpace)) {
        startPdfPortraitInventoryPage(pdf, audit, rack, true);
        drawPdfGroupLabel(pdf, group.label);
        drawPdfPortraitInventoryTableHeader(pdf);
      }

      drawPdfPortraitInventoryRow(pdf, rack, device);
    });
  });
}

export async function buildExcelExport(audit: AuditExportDetail): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const usedSheetNames = new Set<string>(["Inventory List"]);

  workbook.creator = appBrandName;
  workbook.created = new Date();
  workbook.modified = new Date();

  buildInventorySheet(workbook, audit);
  audit.racks.forEach((rack) => {
    buildRackViewSheet(workbook, audit, rack, usedSheetNames);
  });

  const workbookBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(workbookBuffer) ? workbookBuffer : Buffer.from(workbookBuffer);
}

export function buildPdfExport(audit: AuditExportDetail): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument(pdfLandscapePageOptions);
    const chunks: Buffer[] = [];

    pdf.on("data", (chunk: unknown) => {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
        return;
      }

      if (chunk instanceof Uint8Array) {
        chunks.push(Buffer.from(chunk));
      }
    });
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    audit.racks.forEach((rack, index) => {
      if (index > 0) {
        pdf.addPage(pdfLandscapePageOptions);
      }

      const contentX = 36;
      const contentWidth = pdf.page.width - 72;
      const rackGap = 18;
      const frontHasPdus = getVisiblePduMountPositionsForFace("front", rack.devices).length > 0;
      const rearHasPdus = getVisiblePduMountPositionsForFace("rear", rack.devices).length > 0;
      let frontWidth = (contentWidth - rackGap) / 2;
      let rearWidth = (contentWidth - rackGap) / 2;

      if (frontHasPdus !== rearHasPdus) {
        const narrowWidth = 300;
        const wideWidth = contentWidth - rackGap - narrowWidth;

        if (frontHasPdus) {
          frontWidth = wideWidth;
          rearWidth = narrowWidth;
        } else {
          frontWidth = narrowWidth;
          rearWidth = wideWidth;
        }
      }

      const frontX = contentX;
      const rearX = frontX + frontWidth + rackGap;
      const frontVisiblePduMountPositions = getVisiblePduMountPositionsForFace("front", rack.devices);
      const rearVisiblePduMountPositions = getVisiblePduMountPositionsForFace("rear", rack.devices);
      const frontLayout = getPdfRackFaceLayoutForFace(
        frontX,
        frontWidth,
        frontVisiblePduMountPositions.filter((mountPosition) => getPduLaneSide(mountPosition) === "left"),
        frontVisiblePduMountPositions.filter((mountPosition) => getPduLaneSide(mountPosition) === "right")
      );
      const rearLayout = getPdfRackFaceLayoutForFace(
        rearX,
        rearWidth,
        rearVisiblePduMountPositions.filter((mountPosition) => getPduLaneSide(mountPosition) === "left"),
        rearVisiblePduMountPositions.filter((mountPosition) => getPduLaneSide(mountPosition) === "right")
      );
      const capacitySummary = getRackCapacitySummary(rack.totalUnits, rack.devices);
      const headerMetaParts = buildPdfRackHeaderMetaParts(audit, rack);

      drawPdfPageBackground(pdf);
      const rackStartY = drawPdfHeader(pdf, audit, `${appBrandName} Rack View`, appBrandSlogan, rack, [
        { x: frontLayout.rackX, width: frontLayout.rackWidth, stats: capacitySummary.front },
        { x: rearLayout.rackX, width: rearLayout.rackWidth, stats: capacitySummary.rear }
      ], headerMetaParts);
      drawPdfRackFace(pdf, rack, "front", frontX, rackStartY, frontWidth);
      drawPdfRackFace(pdf, rack, "rear", rearX, rackStartY, rearWidth);

      startPdfInventoryPage(pdf, audit, rack);
      drawPdfGroupedInventory(pdf, audit, rack);
    });

    pdf.end();
  });
}

export function buildPdfPortraitExport(audit: AuditExportDetail): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument(pdfPortraitPageOptions);
    const chunks: Buffer[] = [];

    pdf.on("data", (chunk: unknown) => {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
        return;
      }

      if (chunk instanceof Uint8Array) {
        chunks.push(Buffer.from(chunk));
      }
    });
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    audit.racks.forEach((rack, index) => {
      if (index > 0) {
        pdf.addPage(pdfPortraitPageOptions);
      }

      drawPdfPortraitRackViewPage(pdf, audit, rack);
      startPdfPortraitInventoryPage(pdf, audit, rack);
      drawPdfPortraitGroupedInventory(pdf, audit, rack);
    });

    pdf.end();
  });
}
