import { BISTRO_CONFIG } from '../constants/config';

export const formatMoney = (cents: number) => `${(cents / 100).toFixed(2)} ${BISTRO_CONFIG.currency}`;

// Name des Karteninhabers oder, solange keiner vergeben ist, die letzten Stellen der Karten-ID
export const cardLabel = (uid: string, name?: string) => name || `Karte …${uid.slice(-4)}`;

const pad = (n: number) => String(n).padStart(2, '0');

export const formatDateTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}. ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// Mit Jahr, z.B. für Exporte
export const formatDateTimeFull = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// Für Dateinamen, z.B. 2026-10-24_09-15-30
export const formatFileTimestamp = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
