import type { AuditStatus } from "./types.js";

export function getAuditStatusLabel(status: AuditStatus): string {
  switch (status) {
    case "in-progress":
      return "In Bearbeitung";
    case "completed":
      return "Abgeschlossen";
    default:
      return "Erstellt";
  }
}

export function formatAuditDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(date);

  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";

  return `${day}. ${month} ${year} | ${hour}:${minute}`;
}
