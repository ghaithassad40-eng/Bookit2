import type { EquipmentRow } from "./database.types";
import { DEMO_EQUIPMENT } from "./demoData";

/**
 * Demo-mode persistence for the per-business equipment shelf.
 *
 * Reads merge the localStorage overlay on top of the hardcoded DEMO_EQUIPMENT
 * seed so vendor edits made during a demo session are preserved across reloads
 * without losing the canned data. Writes only touch localStorage — the seed is
 * never mutated.
 */

const KEY = "bookit.demo.equipment";

interface OverlayMap {
  /** Equipment rows added or updated since session start. */
  upserts: Record<string, EquipmentRow>;
  /** Ids that were deleted; we filter the seed by this set. */
  deletes: string[];
}

function readOverlay(): OverlayMap {
  if (typeof window === "undefined") return { upserts: {}, deletes: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { upserts: {}, deletes: [] };
    return JSON.parse(raw) as OverlayMap;
  } catch {
    return { upserts: {}, deletes: [] };
  }
}

function writeOverlay(overlay: OverlayMap): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(overlay));
}

/** Read all equipment for a business, with localStorage edits applied. */
export function getLocalEquipment(businessId: string, onlyActive = false): EquipmentRow[] {
  const overlay = readOverlay();
  const seed = DEMO_EQUIPMENT.filter((e) => e.business_id === businessId);
  const seedFiltered = seed.filter((e) => !overlay.deletes.includes(e.id));
  const seedById = new Map(seedFiltered.map((e) => [e.id, e]));
  // Apply upserts: edited seed rows replace originals, new ids append.
  for (const [id, row] of Object.entries(overlay.upserts)) {
    if (row.business_id !== businessId) continue;
    seedById.set(id, row);
  }
  const merged = Array.from(seedById.values());
  return onlyActive ? merged.filter((e) => e.is_active) : merged;
}

/** Read a single equipment row by id. */
export function getLocalEquipmentById(id: string): EquipmentRow | null {
  const overlay = readOverlay();
  if (overlay.deletes.includes(id)) return null;
  if (overlay.upserts[id]) return overlay.upserts[id];
  return DEMO_EQUIPMENT.find((e) => e.id === id) ?? null;
}

export function upsertLocalEquipment(row: EquipmentRow): EquipmentRow {
  const overlay = readOverlay();
  overlay.upserts[row.id] = { ...row, updated_at: new Date().toISOString() };
  // If this id was previously deleted, re-creating it lifts the tombstone.
  overlay.deletes = overlay.deletes.filter((d) => d !== row.id);
  writeOverlay(overlay);
  return overlay.upserts[row.id];
}

export function deleteLocalEquipment(id: string): void {
  const overlay = readOverlay();
  delete overlay.upserts[id];
  if (!overlay.deletes.includes(id)) overlay.deletes.push(id);
  writeOverlay(overlay);
}

/** Generate a fresh equipment id. Uses crypto.randomUUID when available. */
export function newEquipmentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `eqp-local-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `eqp-local-${Math.random().toString(36).slice(2, 10)}`;
}
