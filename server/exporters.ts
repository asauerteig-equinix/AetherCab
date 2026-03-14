import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { getEndUnit } from "../shared/rack.js";
import type { RackDetail, RackDevice } from "../shared/types.js";

function installedDevices(detail: RackDetail): RackDevice[] {
  return detail.devices.filter((device) => device.placementType === "rack");
}

function spareParts(detail: RackDetail): RackDevice[] {
  return detail.devices.filter((device) => device.placementType === "spare");
}

export async function buildExcelExport(detail: RackDetail): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const inventorySheet = workbook.addWorksheet("Inventory");
  const spareSheet = workbook.addWorksheet("Spare Parts");

  inventorySheet.columns = [
    { header: "Site", key: "site", width: 20 },
    { header: "Room", key: "room", width: 20 },
    { header: "Rack", key: "rack", width: 16 },
    { header: "Start U", key: "startUnit", width: 10 },
    { header: "End U", key: "endUnit", width: 10 },
    { header: "Height U", key: "heightU", width: 10 },
    { header: "Name", key: "name", width: 24 },
    { header: "Manufacturer", key: "manufacturer", width: 20 },
    { header: "Model", key: "model", width: 24 },
    { header: "Hostname", key: "hostname", width: 20 },
    { header: "Serial", key: "serialNumber", width: 20 },
    { header: "Notes", key: "notes", width: 30 }
  ];

  installedDevices(detail).forEach((device) => {
    inventorySheet.addRow({
      site: detail.siteName,
      room: detail.roomName,
      rack: detail.name,
      startUnit: device.startUnit,
      endUnit: device.startUnit === null ? null : getEndUnit(device.startUnit, device.heightU),
      heightU: device.heightU,
      name: device.name,
      manufacturer: device.manufacturer,
      model: device.model,
      hostname: device.hostname,
      serialNumber: device.serialNumber,
      notes: device.notes
    });
  });

  spareSheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Manufacturer", key: "manufacturer", width: 20 },
    { header: "Model", key: "model", width: 24 },
    { header: "Storage", key: "storageLocation", width: 18 },
    { header: "Serial", key: "serialNumber", width: 20 },
    { header: "Notes", key: "notes", width: 30 }
  ];

  spareParts(detail).forEach((device) => {
    spareSheet.addRow({
      name: device.name,
      manufacturer: device.manufacturer,
      model: device.model,
      storageLocation: device.storageLocation,
      serialNumber: device.serialNumber,
      notes: device.notes
    });
  });

  const workbookBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(workbookBuffer) ? workbookBuffer : Buffer.from(workbookBuffer);
}

export function buildPdfExport(detail: RackDetail): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ margin: 36, size: "A4" });
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

    pdf.fontSize(22).text("AetherCab Rack Documentation");
    pdf.moveDown(0.5);
    pdf.fontSize(12).text(`Site: ${detail.siteName}`);
    pdf.text(`Room: ${detail.roomName}`);
    pdf.text(`Rack: ${detail.name}`);
    pdf.text(`Units: ${detail.totalUnits}U`);
    if (detail.notes) {
      pdf.text(`Notes: ${detail.notes}`);
    }

    pdf.moveDown();
    pdf.fontSize(16).text("Rack Layout");
    pdf.moveDown(0.5);

    installedDevices(detail).forEach((device) => {
      const startUnit = device.startUnit ?? "-";
      const endUnit = device.startUnit === null ? "-" : getEndUnit(device.startUnit, device.heightU);
      pdf
        .fontSize(11)
        .text(`${startUnit}U-${endUnit}U | ${device.heightU}U | ${device.name} | ${device.manufacturer} ${device.model}`);
    });

    pdf.moveDown();
    pdf.fontSize(16).text("Spare Parts");
    pdf.moveDown(0.5);

    const looseParts = spareParts(detail);
    if (looseParts.length === 0) {
      pdf.fontSize(11).text("No spare parts documented.");
    } else {
      looseParts.forEach((device) => {
        pdf
          .fontSize(11)
          .text(`${device.name} | ${device.manufacturer} ${device.model} | ${device.storageLocation ?? "Unspecified"}`);
      });
    }

    pdf.end();
  });
}
