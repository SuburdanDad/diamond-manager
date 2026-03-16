import { supabase } from "./supabaseClient.js";

// ═══════════════════════════════════════════════════════════════════════════
// Storage Adapter
// Uses Supabase as the primary store with localStorage as offline fallback.
// The app works offline (reads from cache) and syncs when reconnected.
// ═══════════════════════════════════════════════════════════════════════════

const LOCAL_KEY = "pll-diamond-events";

// ── Helpers ─────────────────────────────────────────────────────────────────

function toSnake(ev) {
  return {
    id: ev.id,
    field_id: ev.fieldId,
    date: ev.date,
    start_time: ev.startTime,
    duration: ev.duration,
    division_id: ev.divisionId || "",
    event_type: ev.eventType,
    title: ev.title || "",
    notes: ev.notes || "",
    home_team: ev.homeTeam || "",
    away_team: ev.awayTeam || "",
  };
}

function toCamel(row) {
  return {
    id: row.id,
    fieldId: row.field_id,
    date: row.date,
    startTime: row.start_time,
    duration: row.duration,
    divisionId: row.division_id || "",
    eventType: row.event_type,
    title: row.title || "",
    notes: row.notes || "",
    homeTeam: row.home_team || "",
    awayTeam: row.away_team || "",
  };
}

function cacheLocally(events) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(events));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

function readLocalCache() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function loadEvents() {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("date", { ascending: true });

    if (error) throw error;

    const events = (data || []).map(toCamel);
    cacheLocally(events);
    return events;
  } catch (err) {
    console.warn("Supabase load failed, using local cache:", err.message);
    return readLocalCache();
  }
}

export async function saveEvent(ev) {
  try {
    const { error } = await supabase
      .from("events")
      .upsert(toSnake(ev), { onConflict: "id" });

    if (error) throw error;
  } catch (err) {
    console.warn("Supabase save failed:", err.message);
  }
}

export async function deleteEvent(id) {
  try {
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", id);

    if (error) throw error;
  } catch (err) {
    console.warn("Supabase delete failed:", err.message);
  }
}

export async function saveAllEvents(events) {
  cacheLocally(events);

  try {
    const rows = events.map(toSnake);
    const { error } = await supabase
      .from("events")
      .upsert(rows, { onConflict: "id" });

    if (error) throw error;
  } catch (err) {
    console.warn("Supabase bulk save failed:", err.message);
  }
}
