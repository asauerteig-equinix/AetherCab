import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { getEndUnit, getRackMountPositionLabel, isVerticalPduMountPosition } from "../shared/rack.js";
import type { RackDetail, RackDevice, RackFace, RackMountPosition } from "../shared/types.js";

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
  deviceBorder: "FF96A8B7"
} as const;

const pdfPalette = {
  pageBackground: "#f5f7fa",
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
  deviceBorder: "#96a8b7"
} as const;

const pdfPageOptions = {
  margin: 36,
  size: "A4",
  layout: "landscape"
} as const;

function installedDevices(detail: RackDetail): RackDevice[] {
  return detail.devices.filter((device) => device.placementType === "rack" && device.startUnit !== null);
}

function faceLabel(face: RackFace): string {
  return face === "front" ? "Front" : "Rear";
}

function deviceFaceLabel(device: RackDevice): string {
  if (isVerticalPduMountPosition(device.mountPosition)) {
    return "Rear";
  }

  if (device.blocksBothFaces) {
    return "Front + Rear";
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
  return `${device.manufacturer} ${device.model}`.trim();
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

function sortDevices(devices: RackDevice[]): RackDevice[] {
  return [...devices].sort((left, right) => {
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
  });
}

function visibleDevicesForFace(detail: RackDetail, face: RackFace): RackDevice[] {
  return sortDevices(
    installedDevices(detail).filter((device) => {
      if (device.blocksBothFaces) {
        return true;
      }

      const deviceFace = device.rackFace ?? "front";
      return deviceFace === face;
    })
  );
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

function getExcelFaceSpan(face: RackFace): number {
  return face === "rear" ? 9 : 5;
}

function getExcelDeviceRange(face: RackFace, startColumn: number, mountPosition: RackMountPosition): { startColumn: number; endColumn: number } {
  if (face === "rear" && isVerticalPduMountPosition(mountPosition)) {
    const laneColumnMap = {
      "rear-left-outer": startColumn + 1,
      "rear-left-inner": startColumn + 2,
      "rear-right-inner": startColumn + 7,
      "rear-right-outer": startColumn + 8
    } satisfies Record<Exclude<RackMountPosition, "full">, number>;

    const laneColumn = laneColumnMap[mountPosition as Exclude<RackMountPosition, "full">];
    return { startColumn: laneColumn, endColumn: laneColumn };
  }

  return face === "rear"
    ? { startColumn: startColumn + 3, endColumn: startColumn + 6 }
    : { startColumn: startColumn + 1, endColumn: startColumn + 4 };
}

function drawExcelRackFace(
  worksheet: ExcelJS.Worksheet,
  detail: RackDetail,
  face: RackFace,
  startColumn: number,
  startRow: number
): void {
  const faceSpan = getExcelFaceSpan(face);

  worksheet.mergeCells(startRow, startColumn, startRow, startColumn + faceSpan - 1);
  const headerCell = worksheet.getCell(startRow, startColumn);
  headerCell.value = `-- ${faceLabel(face)} --`;
  headerCell.font = { name: "Bahnschrift", size: 10, bold: true, color: { argb: excelPalette.accentStrong } };
  headerCell.alignment = { vertical: "middle", horizontal: "center" };

  const rackStartRow = startRow + 2;
  const rackDevices = visibleDevicesForFace(detail, face);

  worksheet.getColumn(startColumn).width = 8;
  if (face === "rear") {
    worksheet.getColumn(startColumn + 1).width = 5.2;
    worksheet.getColumn(startColumn + 2).width = 5.2;
    worksheet.getColumn(startColumn + 3).width = 10.5;
    worksheet.getColumn(startColumn + 4).width = 10.5;
    worksheet.getColumn(startColumn + 5).width = 10.5;
    worksheet.getColumn(startColumn + 6).width = 10.5;
    worksheet.getColumn(startColumn + 7).width = 5.2;
    worksheet.getColumn(startColumn + 8).width = 5.2;
  } else {
    for (let columnIndex = startColumn + 1; columnIndex <= startColumn + 4; columnIndex += 1) {
      worksheet.getColumn(columnIndex).width = 12;
    }
  }

  for (let unit = detail.totalUnits; unit >= 1; unit -= 1) {
    const rowIndex = rackStartRow + (detail.totalUnits - unit);
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
      const isRearPduLane =
        face === "rear" && [startColumn + 1, startColumn + 2, startColumn + 7, startColumn + 8].includes(columnIndex);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isRearPduLane ? excelPalette.panelBackground : excelPalette.slotBackground }
      };
      cell.border = createThinBorder(excelPalette.slotLine);
    }
  }

  rackDevices.forEach((device) => {
    const startUnit = device.startUnit ?? 1;
    const endUnit = getEndUnit(startUnit, device.heightU);
    const topRow = rackStartRow + (detail.totalUnits - endUnit);
    const bottomRow = topRow + device.heightU - 1;
    const deviceRange = getExcelDeviceRange(face, startColumn, device.mountPosition);

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
      vertical: "middle",
      horizontal: "left",
      wrapText: true
    };
    deviceCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: excelPalette.deviceFill } };
  });

  const footerRow = rackStartRow + detail.totalUnits;
  worksheet.mergeCells(footerRow, startColumn, footerRow, startColumn + faceSpan - 1);
  const footerCell = worksheet.getCell(footerRow, startColumn);
  footerCell.value = `-- ${faceLabel(face)} --`;
  footerCell.font = { name: "Bahnschrift", size: 10, bold: true, color: { argb: excelPalette.accentStrong } };
  footerCell.alignment = { vertical: "middle", horizontal: "center" };
}

function buildInventorySheet(workbook: ExcelJS.Workbook, detail: RackDetail): void {
  const worksheet = workbook.addWorksheet("Inventory List", {
    properties: { tabColor: { argb: excelPalette.accent } },
    views: [{ state: "frozen", ySplit: 5 }]
  });

  worksheet.columns = [
    { header: "Site", key: "site", width: 18 },
    { header: "Room", key: "room", width: 18 },
    { header: "Audit", key: "rack", width: 18 },
    { header: "Start U", key: "startUnit", width: 10 },
    { header: "End U", key: "endUnit", width: 10 },
    { header: "Height U", key: "heightU", width: 10 },
    { header: "Face", key: "rackFace", width: 16 },
    { header: "Mount", key: "mountPosition", width: 24 },
    { header: "Name", key: "name", width: 24 },
    { header: "Manufacturer", key: "manufacturer", width: 20 },
    { header: "Model", key: "model", width: 22 },
    { header: "Hostname", key: "hostname", width: 18 },
    { header: "Serial", key: "serialNumber", width: 18 },
    { header: "Notes", key: "notes", width: 28 }
  ];

  worksheet.mergeCells("A1:N1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "AetherCab Inventory Export";
  titleCell.font = { name: "Bahnschrift", size: 16, bold: true, color: { argb: "FF2B2520" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  worksheet.mergeCells("A2:N2");
  const metaCell = worksheet.getCell("A2");
  metaCell.value = `${detail.siteName} | ${detail.roomName} | ${detail.name} | ${detail.totalUnits}U`;
  metaCell.font = { name: "Bahnschrift", size: 10, color: { argb: "FF4C433B" } };
  metaCell.alignment = { vertical: "middle", horizontal: "left" };

  worksheet.mergeCells("A3:N3");
  const notesCell = worksheet.getCell("A3");
  notesCell.value = detail.notes ? `Notes: ${detail.notes}` : "Notes: -";
  notesCell.font = { name: "Bahnschrift", size: 10, color: { argb: "FF4C433B" } };
  notesCell.alignment = { vertical: "middle", horizontal: "left" };

  const headerRow = worksheet.getRow(5);
  headerRow.values = [null, ...worksheet.columns.map((column) => columnHeaderLabel(column))];
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Bahnschrift", size: 10, bold: true, color: { argb: "FF2B2520" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = createThinBorder("FFD6D0C9");
  });

  sortDevices(installedDevices(detail)).forEach((device) => {
    const row = worksheet.addRow({
      site: detail.siteName,
      room: detail.roomName,
      rack: detail.name,
      startUnit: device.startUnit,
      endUnit: getEndUnit(device.startUnit ?? 1, device.heightU),
      heightU: device.heightU,
      rackFace: deviceFaceLabel(device),
      mountPosition: deviceMountLabel(device),
      name: device.name,
      manufacturer: device.manufacturer,
      model: device.model,
      hostname: device.hostname ?? "",
      serialNumber: device.serialNumber ?? "",
      notes: device.notes ?? ""
    });
    row.eachCell((cell) => {
      cell.font = { name: "Bahnschrift", size: 10, color: { argb: "FF2B2520" } };
      cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
      cell.border = createThinBorder("FFE0DBD4");
    });
  });
}

function buildRackViewSheet(workbook: ExcelJS.Workbook, detail: RackDetail): void {
  const worksheet = workbook.addWorksheet("Rack View", {
    properties: { tabColor: { argb: excelPalette.accentStrong } }
  });

  worksheet.views = [{ showGridLines: false }];
  worksheet.properties.defaultRowHeight = 22;

  worksheet.mergeCells("A1:R1");
  styleExcelTitle(worksheet.getCell("A1"), "AetherCab Rack View");
  worksheet.mergeCells("A2:R2");
  worksheet.getCell("A2").value = `${detail.siteName} | ${detail.roomName} | ${detail.name}`;
  styleExcelMeta(worksheet.getCell("A2"));

  worksheet.mergeCells("A3:R3");
  worksheet.getCell("A3").value = detail.notes ? `Notes: ${detail.notes}` : "Notes: -";
  styleExcelMeta(worksheet.getCell("A3"));

  drawExcelRackFace(worksheet, detail, "front", 1, 5);
  drawExcelRackFace(worksheet, detail, "rear", 10, 5);

}

function drawPdfPageBackground(pdf: PdfDocument): void {
  pdf.save();
  pdf.rect(0, 0, pdf.page.width, pdf.page.height).fill(pdfPalette.pageBackground);
  pdf.restore();
}

function drawPdfHeader(pdf: PdfDocument, detail: RackDetail, title: string, subtitle: string): void {
  pdf.fillColor(pdfPalette.textPrimary).fontSize(20).text(title, 36, 32);
  pdf.fillColor(pdfPalette.textSecondary).fontSize(11).text(subtitle, 36, 58);
  pdf.text(`${detail.siteName} | ${detail.roomName} | ${detail.name} | ${detail.totalUnits}U`, 36, 74);

  if (detail.notes) {
    pdf.text(`Notes: ${detail.notes}`, 36, 90, { width: pdf.page.width - 72 });
  }
}

function getPdfRackDeviceFrame(
  face: RackFace,
  rackX: number,
  rackWidth: number,
  mountPosition: RackMountPosition
): { x: number; width: number } {
  if (face === "rear") {
    const sidePadding = 10;
    const pduLaneWidth = 18;
    const laneGap = 8;
    const centerGap = 16;
    const fullX = rackX + sidePadding + pduLaneWidth * 2 + laneGap + centerGap;
    const fullWidth = rackWidth - sidePadding * 2 - pduLaneWidth * 4 - laneGap * 2 - centerGap * 2;

    if (mountPosition === "rear-left-outer") {
      return { x: rackX + sidePadding, width: pduLaneWidth };
    }

    if (mountPosition === "rear-left-inner") {
      return { x: rackX + sidePadding + pduLaneWidth + laneGap, width: pduLaneWidth };
    }

    if (mountPosition === "rear-right-inner") {
      return { x: rackX + rackWidth - sidePadding - pduLaneWidth * 2 - laneGap, width: pduLaneWidth };
    }

    if (mountPosition === "rear-right-outer") {
      return { x: rackX + rackWidth - sidePadding - pduLaneWidth, width: pduLaneWidth };
    }

    return { x: fullX, width: fullWidth };
  }

  return { x: rackX + 8, width: rackWidth - 16 };
}

function drawPdfRackFace(
  pdf: PdfDocument,
  detail: RackDetail,
  face: RackFace,
  x: number,
  y: number,
  width: number
): void {
  const labelWidth = 42;
  const rackWidth = width - labelWidth;
  const rackX = x + labelWidth;
  const unitHeight = Math.max(8, Math.min(10, Math.floor((pdf.page.height - y - 90) / detail.totalUnits)));
  const rackHeight = unitHeight * detail.totalUnits;
  const innerPadding = 8;
  const devices = visibleDevicesForFace(detail, face);

  pdf.fillColor(pdfPalette.accentStrong).fontSize(9).text(`-- ${faceLabel(face)} --`, x, y - 20, { width, align: "center" });

  pdf.save();
  pdf.roundedRect(rackX, y, rackWidth, rackHeight, 10).fill(pdfPalette.panelBackground);
  pdf.roundedRect(rackX, y, rackWidth, rackHeight, 10).lineWidth(1).strokeColor(pdfPalette.panelBorder).stroke();
  pdf.restore();

  if (face === "rear") {
    (["rear-left-outer", "rear-left-inner", "rear-right-inner", "rear-right-outer"] as const).forEach((mountPosition) => {
      const laneFrame = getPdfRackDeviceFrame(face, rackX, rackWidth, mountPosition);
      pdf.save();
      pdf.roundedRect(laneFrame.x, y + 2, laneFrame.width, rackHeight - 4, 6).fillOpacity(0.18).fill(pdfPalette.accent);
      pdf.restore();
    });
  }

  for (let unit = detail.totalUnits; unit >= 1; unit -= 1) {
    const rowY = y + (detail.totalUnits - unit) * unitHeight;

    pdf.save();
    pdf.rect(rackX, rowY, rackWidth, unitHeight).fill(pdfPalette.slotBackground);
    pdf.rect(rackX, rowY, rackWidth, unitHeight).lineWidth(0.5).strokeColor(pdfPalette.slotLine).stroke();
    pdf.restore();

    pdf.fillColor(pdfPalette.slotLabel).fontSize(7).text(`${unit}U`, x, rowY + 3, {
      width: labelWidth - 8,
      align: "right"
    });
  }

  devices.forEach((device) => {
    const startUnit = device.startUnit ?? 1;
    const endUnit = getEndUnit(startUnit, device.heightU);
    const topY = y + (detail.totalUnits - endUnit) * unitHeight + 1;
    const height = Math.max(unitHeight * device.heightU - 2, unitHeight - 2);
    const frame = getPdfRackDeviceFrame(face, rackX, rackWidth, device.mountPosition);
    const textX = frame.x + innerPadding;
    const textWidth = frame.width - innerPadding * 2;
    const lines = deviceVisualLines(device);
    const fontSize = isVerticalPduMountPosition(device.mountPosition) ? 5.8 : device.heightU === 1 ? 6.2 : device.heightU === 2 ? 6.8 : 7.2;
    const lineHeight = fontSize + 1.5;
    const textBlockHeight = lines.length * lineHeight;
    const startTextY = topY + Math.max(3, (height - textBlockHeight) / 2);

    pdf.save();
    pdf.roundedRect(frame.x, topY, frame.width, height, isVerticalPduMountPosition(device.mountPosition) ? 6 : 8).fill(pdfPalette.deviceFill);
    pdf
      .roundedRect(frame.x, topY, frame.width, height, isVerticalPduMountPosition(device.mountPosition) ? 6 : 8)
      .lineWidth(0.8)
      .strokeColor(pdfPalette.deviceBorder)
      .stroke();
    pdf.restore();

    lines.forEach((line, index) => {
      pdf.fillColor(index === 0 ? pdfPalette.textPrimary : pdfPalette.textSecondary).fontSize(fontSize).text(line, textX + 2, startTextY + index * lineHeight, {
        width: textWidth - 4,
        ellipsis: true
      });
    });
  });

  const footerY = y + rackHeight + 4;
  pdf.fillColor(pdfPalette.accentStrong).fontSize(9).text(`-- ${faceLabel(face)} --`, x, footerY, {
    width,
    align: "center"
  });
}

function ensurePdfTextSpace(pdf: PdfDocument, neededHeight = 36): void {
  if (pdf.y + neededHeight <= pdf.page.height - 36) {
    return;
  }

  pdf.addPage(pdfPageOptions);
  drawPdfPageBackground(pdf);
}

function drawPdfTextSectionTitle(pdf: PdfDocument, title: string): void {
  ensurePdfTextSpace(pdf, 28);
  pdf.moveDown(0.5);
  pdf.fillColor(pdfPalette.accentStrong).fontSize(13).text(title);
  pdf.moveDown(0.25);
}

function drawPdfDeviceTextLine(pdf: PdfDocument, device: RackDevice): void {
  ensurePdfTextSpace(pdf, 48);
  const metadataParts = [`${devicePositionLabel(device)}`, `${device.heightU}U`, deviceFaceLabel(device), deviceMountLabel(device)];
  if (device.hostname) {
    metadataParts.push(`Hostname: ${device.hostname}`);
  }
  if (device.serialNumber) {
    metadataParts.push(`Serial: ${device.serialNumber}`);
  }

  pdf.fillColor(pdfPalette.textPrimary).fontSize(11).text(device.name, { continued: false });
  pdf.fillColor(pdfPalette.textSecondary).fontSize(9).text(`${device.manufacturer} ${device.model}`.trim());
  pdf.text(metadataParts.join(" | "));

  if (device.notes) {
    pdf.text(`Notes: ${device.notes}`);
  }

  pdf.moveDown(0.45);
}

export async function buildExcelExport(detail: RackDetail): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AetherCab";
  workbook.created = new Date();
  workbook.modified = new Date();

  buildInventorySheet(workbook, detail);
  buildRackViewSheet(workbook, detail);

  const workbookBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(workbookBuffer) ? workbookBuffer : Buffer.from(workbookBuffer);
}

export function buildPdfExport(detail: RackDetail): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument(pdfPageOptions);
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

    drawPdfPageBackground(pdf);
    drawPdfHeader(pdf, detail, "AetherCab Rack View", "Visual rack documentation");
    drawPdfRackFace(pdf, detail, "front", 42, 124, 340);
    drawPdfRackFace(pdf, detail, "rear", 430, 124, 340);

    pdf.addPage(pdfPageOptions);
    drawPdfPageBackground(pdf);
    drawPdfHeader(pdf, detail, "AetherCab Device List", "Structured inventory list for this rack");
    pdf.moveDown(4);

    drawPdfTextSectionTitle(pdf, "Installed Devices");
    const devices = sortDevices(installedDevices(detail));
    if (devices.length === 0) {
      pdf.fillColor(pdfPalette.textSecondary).fontSize(10).text("No installed devices documented.");
    } else {
      devices.forEach((device) => {
        drawPdfDeviceTextLine(pdf, device);
      });
    }

    pdf.end();
  });
}
