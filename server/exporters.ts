import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { getEndUnit } from "../shared/rack.js";
import type { RackDetail, RackDevice, RackFace } from "../shared/types.js";

type PdfDocument = InstanceType<typeof PDFDocument>;

const excelPalette = {
  pageBackground: "FF151311",
  panelBackground: "FF1C1916",
  panelBorder: "FF4C433B",
  slotBackground: "FF24201C",
  slotLine: "FF3B332C",
  slotLabel: "FF7F7267",
  accent: "FFC9B39A",
  accentStrong: "FFA88E72",
  textPrimary: "FFF3EDE6",
  textSecondary: "FFD0C1B1",
  deviceFill: "FF3A322B",
  deviceBorder: "FF8F7A66"
} as const;

const pdfPalette = {
  pageBackground: "#151311",
  panelBackground: "#1c1916",
  panelBorder: "#4c433b",
  slotBackground: "#24201c",
  slotLine: "#3b332c",
  slotLabel: "#7f7267",
  accent: "#c9b39a",
  accentStrong: "#a88e72",
  textPrimary: "#f3ede6",
  textSecondary: "#d0c1b1",
  deviceFill: "#3a322b",
  deviceBorder: "#8f7a66"
} as const;

function installedDevices(detail: RackDetail): RackDevice[] {
  return detail.devices.filter((device) => device.placementType === "rack" && device.startUnit !== null);
}

function faceLabel(face: RackFace): string {
  return face === "front" ? "Vorderseite" : "Rueckseite";
}

function deviceFaceLabel(device: RackDevice): string {
  if (device.blocksBothFaces) {
    return "Front + Rear";
  }

  return device.rackFace === "rear" ? "Rueckseite" : "Vorderseite";
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

function deviceVisualLabel(device: RackDevice): string {
  if (device.heightU === 1) {
    return `${devicePrimaryLine(device)} | ${deviceSecondaryLine(device)}`;
  }

  return `${devicePrimaryLine(device)}\n${deviceSecondaryLine(device)}\n${devicePositionLabel(device)} | ${deviceFaceLabel(device)}`;
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

function styleExcelHeaderRow(row: ExcelJS.Row): void {
  row.height = 22;

  row.eachCell((cell) => {
    cell.font = { name: "Bahnschrift", size: 10, bold: true, color: { argb: excelPalette.textPrimary } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: excelPalette.panelBackground } };
    cell.border = createThinBorder(excelPalette.panelBorder);
  });
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

function styleExcelBodyRow(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.font = { name: "Bahnschrift", size: 10, color: { argb: excelPalette.textPrimary } };
    cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: excelPalette.slotBackground } };
    cell.border = createThinBorder(excelPalette.slotLine);
  });
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

function drawExcelRackFace(
  worksheet: ExcelJS.Worksheet,
  detail: RackDetail,
  face: RackFace,
  startColumn: number,
  startRow: number
): void {
  worksheet.mergeCells(startRow, startColumn, startRow, startColumn + 4);
  const headerCell = worksheet.getCell(startRow, startColumn);
  headerCell.value = `-- ${faceLabel(face)} --`;
  headerCell.font = { name: "Bahnschrift", size: 10, bold: true, color: { argb: excelPalette.accentStrong } };
  headerCell.alignment = { vertical: "middle", horizontal: "center" };

  const rackStartRow = startRow + 2;
  const rackDevices = visibleDevicesForFace(detail, face);

  worksheet.getColumn(startColumn).width = 8;
  for (let columnIndex = startColumn + 1; columnIndex <= startColumn + 4; columnIndex += 1) {
    worksheet.getColumn(columnIndex).width = 12;
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

    for (let columnIndex = startColumn + 1; columnIndex <= startColumn + 4; columnIndex += 1) {
      const cell = worksheet.getCell(rowIndex, columnIndex);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: excelPalette.slotBackground } };
      cell.border = createThinBorder(excelPalette.slotLine);
    }
  }

  rackDevices.forEach((device) => {
    const startUnit = device.startUnit ?? 1;
    const endUnit = getEndUnit(startUnit, device.heightU);
    const topRow = rackStartRow + (detail.totalUnits - endUnit);
    const bottomRow = topRow + device.heightU - 1;

    worksheet.mergeCells(topRow, startColumn + 1, bottomRow, startColumn + 4);
    applyExcelRangeBorder(worksheet, topRow, bottomRow, startColumn + 1, startColumn + 4, excelPalette.deviceBorder);

    const deviceCell = worksheet.getCell(topRow, startColumn + 1);
    deviceCell.value = deviceVisualLabel(device);
    deviceCell.font = {
      name: "Bahnschrift",
      size: device.heightU === 1 ? 8 : 9,
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
  worksheet.mergeCells(footerRow, startColumn, footerRow, startColumn + 4);
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
    { header: "Name", key: "name", width: 24 },
    { header: "Manufacturer", key: "manufacturer", width: 20 },
    { header: "Model", key: "model", width: 22 },
    { header: "Hostname", key: "hostname", width: 18 },
    { header: "Serial", key: "serialNumber", width: 18 },
    { header: "Notes", key: "notes", width: 28 }
  ];

  worksheet.mergeCells("A1:M1");
  styleExcelTitle(worksheet.getCell("A1"), "AetherCab Inventory Export");
  worksheet.mergeCells("A2:M2");
  worksheet.getCell("A2").value = `${detail.siteName} | ${detail.roomName} | ${detail.name} | ${detail.totalUnits}U`;
  styleExcelMeta(worksheet.getCell("A2"));

  worksheet.mergeCells("A3:M3");
  worksheet.getCell("A3").value = detail.notes ? `Notizen: ${detail.notes}` : "Notizen: -";
  styleExcelMeta(worksheet.getCell("A3"));

  const headerRow = worksheet.getRow(5);
  headerRow.values = [null, ...worksheet.columns.map((column) => columnHeaderLabel(column))];
  styleExcelHeaderRow(headerRow);

  sortDevices(installedDevices(detail)).forEach((device) => {
    const row = worksheet.addRow({
      site: detail.siteName,
      room: detail.roomName,
      rack: detail.name,
      startUnit: device.startUnit,
      endUnit: getEndUnit(device.startUnit ?? 1, device.heightU),
      heightU: device.heightU,
      rackFace: deviceFaceLabel(device),
      name: device.name,
      manufacturer: device.manufacturer,
      model: device.model,
      hostname: device.hostname ?? "",
      serialNumber: device.serialNumber ?? "",
      notes: device.notes ?? ""
    });
    styleExcelBodyRow(row);
  });
}

function buildRackViewSheet(workbook: ExcelJS.Workbook, detail: RackDetail): void {
  const worksheet = workbook.addWorksheet("Rack View", {
    properties: { tabColor: { argb: excelPalette.accentStrong } }
  });

  worksheet.views = [{ showGridLines: false }];
  worksheet.properties.defaultRowHeight = 22;

  worksheet.mergeCells("A1:M1");
  styleExcelTitle(worksheet.getCell("A1"), "AetherCab Rack View");
  worksheet.mergeCells("A2:M2");
  worksheet.getCell("A2").value = `${detail.siteName} | ${detail.roomName} | ${detail.name}`;
  styleExcelMeta(worksheet.getCell("A2"));

  worksheet.mergeCells("A3:M3");
  worksheet.getCell("A3").value = detail.notes ? `Notizen: ${detail.notes}` : "Notizen: -";
  styleExcelMeta(worksheet.getCell("A3"));

  drawExcelRackFace(worksheet, detail, "front", 1, 5);
  drawExcelRackFace(worksheet, detail, "rear", 8, 5);

  for (let columnIndex = 1; columnIndex <= 13; columnIndex += 1) {
    worksheet.getColumn(columnIndex).style = {
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: excelPalette.pageBackground } }
    };
  }
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
    pdf.text(`Notizen: ${detail.notes}`, 36, 90, { width: pdf.page.width - 72 });
  }
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
  const unitHeight = Math.max(10, Math.min(13, Math.floor((pdf.page.height - y - 64) / detail.totalUnits)));
  const rackHeight = unitHeight * detail.totalUnits;
  const innerPadding = 8;
  const devices = visibleDevicesForFace(detail, face);

  pdf.fillColor(pdfPalette.accentStrong).fontSize(9).text(`-- ${faceLabel(face)} --`, x, y - 20, { width, align: "center" });

  pdf.save();
  pdf.roundedRect(x + labelWidth, y, rackWidth, rackHeight, 10).fill(pdfPalette.panelBackground);
  pdf.roundedRect(x + labelWidth, y, rackWidth, rackHeight, 10).lineWidth(1).strokeColor(pdfPalette.panelBorder).stroke();
  pdf.restore();

  for (let unit = detail.totalUnits; unit >= 1; unit -= 1) {
    const rowY = y + (detail.totalUnits - unit) * unitHeight;

    pdf.save();
    pdf.rect(x + labelWidth, rowY, rackWidth, unitHeight).fill(pdfPalette.slotBackground);
    pdf.rect(x + labelWidth, rowY, rackWidth, unitHeight).lineWidth(0.5).strokeColor(pdfPalette.slotLine).stroke();
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
    const textX = x + labelWidth + innerPadding;
    const textWidth = rackWidth - innerPadding * 2;
    const label = deviceVisualLabel(device).split("\n");

    pdf.save();
    pdf.roundedRect(textX - 2, topY, textWidth + 4, height, 8).fill(pdfPalette.deviceFill);
    pdf.roundedRect(textX - 2, topY, textWidth + 4, height, 8).lineWidth(0.8).strokeColor(pdfPalette.deviceBorder).stroke();
    pdf.restore();

    pdf.fillColor(pdfPalette.textPrimary).fontSize(device.heightU === 1 ? 6.8 : 7.8).text(label[0] ?? "", textX + 2, topY + 4, {
      width: textWidth - 4,
      ellipsis: true
    });

    if (device.heightU > 1) {
      pdf.fillColor(pdfPalette.textSecondary).fontSize(6.8).text(label[1] ?? "", textX + 2, topY + 15, {
        width: textWidth - 4,
        ellipsis: true
      });
      pdf.text(label[2] ?? "", textX + 2, topY + 25, {
        width: textWidth - 4,
        ellipsis: true
      });
    }
  });

  pdf.fillColor(pdfPalette.accentStrong).fontSize(9).text(`-- ${faceLabel(face)} --`, x, y + rackHeight + 10, {
    width,
    align: "center"
  });
}

function ensurePdfTextSpace(pdf: PdfDocument, neededHeight = 36): void {
  if (pdf.y + neededHeight <= pdf.page.height - 36) {
    return;
  }

  pdf.addPage({ margin: 36, size: "A4" });
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
  const metadataParts = [`${devicePositionLabel(device)}`, `${device.heightU}U`, deviceFaceLabel(device)];
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
    pdf.text(`Notizen: ${device.notes}`);
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
    const pdf = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
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
    drawPdfHeader(pdf, detail, "AetherCab Rack View", "Visuelle Rack-Dokumentation");
    drawPdfRackFace(pdf, detail, "front", 42, 130, 340);
    drawPdfRackFace(pdf, detail, "rear", 430, 130, 340);

    pdf.addPage({ margin: 36, size: "A4" });
    drawPdfPageBackground(pdf);
    drawPdfHeader(pdf, detail, "AetherCab Textliste", "Strukturierte Inventarliste zum Rack");
    pdf.moveDown(4);

    drawPdfTextSectionTitle(pdf, "Installierte Geraete");
    const devices = sortDevices(installedDevices(detail));
    if (devices.length === 0) {
      pdf.fillColor(pdfPalette.textSecondary).fontSize(10).text("Keine installierten Geraete dokumentiert.");
    } else {
      devices.forEach((device) => {
        drawPdfDeviceTextLine(pdf, device);
      });
    }

    pdf.end();
  });
}
