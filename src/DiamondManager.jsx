import React, { useState, useEffect, useCallback, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// DIAMOND MANAGER — PLL Field Scheduler
// Complements GameChanger: cross-division field scheduling, conflict
// detection, rain-out tracking, maintenance windows, CSV/ICS export.
// ═══════════════════════════════════════════════════════════════════════════

// ── League Data ─────────────────────────────────────────────────────────────

const FIELDS = [
  { id: "pavilion", name: "Batting Pavilion", short: "BP", size: "4 Lanes",    lights: false, emoji: "🏏" },
  { id: "f1",       name: "Field 1",          short: "F1", size: "46/60",      lights: true,  emoji: "🥎" },
  { id: "f2",       name: "Field 2",          short: "F2", size: "46/60 · 50/70", lights: true, emoji: "⚾" },
  { id: "f3",       name: "Field 3",          short: "F3", size: "46/60",      lights: false, emoji: "⚾" },
  { id: "f4",       name: "Field 4",          short: "F4", size: "60/90",      lights: false, emoji: "⚾" },
  { id: "f7",       name: "Field 7",          short: "F7", size: "46/60",      lights: false, emoji: "⚾" },
  { id: "church",   name: "Church Field",     short: "CH", size: "Tee",        lights: false, emoji: "🧢" },
  { id: "football", name: "Football Field",   short: "FB", size: "Multi",      lights: false, emoji: "🏟️" },
];

const DIVISIONS = [
  { id: "little-sluggers", name: "Little Sluggers", short: "LS",  ages: "4–5",   type: "both",     fields: ["church", "football"], color: "#E67E22", teams: ["Tigers", "Lions", "Bears", "Sharks", "Eagles", "Hawks"] },
  { id: "sluggers",        name: "Sluggers",        short: "SL",  ages: "6",     type: "both",     fields: ["church", "football"], color: "#D35400", teams: ["Red Sox", "Yankees", "Cubs", "Braves"] },
  { id: "a-baseball",      name: "A Baseball",      short: "A",   ages: "7",     type: "baseball", fields: ["f3", "f7"],           color: "#27AE60", teams: ["Phillies", "Mets", "Dodgers", "Cardinals", "Nationals"] },
  { id: "aa-baseball",     name: "AA Baseball",     short: "AA",  ages: "8",     type: "baseball", fields: ["f3"],                 color: "#2E86C1", teams: ["Astros", "Rangers", "Rays", "Twins"] },
  { id: "aaa-baseball",    name: "AAA Baseball",    short: "AAA", ages: "9–11",  type: "baseball", fields: ["f2", "f3"],           color: "#2874A6", teams: ["Mariners", "Padres", "Brewers", "Reds", "Rockies"] },
  { id: "int-baseball",    name: "Intermediate",    short: "INT", ages: "11–13", type: "baseball", fields: ["f2"],                 color: "#6C3483", teams: ["Blue Jays", "Orioles", "Giants", "Pirates"] },
  { id: "sb-rookies",      name: "SB Rookies",      short: "SBR", ages: "7–8",   type: "softball", fields: ["f1", "f3"],           color: "#C0392B", teams: ["Storm", "Thunder", "Lightning", "Blaze"] },
  { id: "sb-minors",       name: "SB Minors",       short: "SBm", ages: "9–10",  type: "softball", fields: ["f1"],                 color: "#E74C3C", teams: ["Fury", "Sparks", "Flames"] },
  { id: "sb-majors",       name: "SB Majors",       short: "SBM", ages: "11–12", type: "softball", fields: ["f1"],                 color: "#A93226", teams: ["Wildcats", "Panthers", "Vipers"] },
  { id: "sb-juniors",      name: "SB Juniors",      short: "SBJ", ages: "13–14", type: "softball", fields: ["f1"],                 color: "#922B21", teams: ["Raptors", "Falcons"] },
];

const EVENT_TYPES = [
  { id: "game",        label: "Game",        icon: "⚾" },
  { id: "practice",    label: "Practice",    icon: "🏋️" },
  { id: "makeup",      label: "Makeup",      icon: "🔄" },
  { id: "district",    label: "District",    icon: "🏆" },
  { id: "maintenance", label: "Maintenance", icon: "🔧" },
  { id: "closed",      label: "Closed",      icon: "🚫" },
  { id: "rainout",     label: "Rain Out",    icon: "🌧️" },
];

// Baseball-themed row accent colours: grass, dirt, chalk, clay, outfield…
const FIELD_STRIPE = ["#5D4037", "#4A8C3F", "#C49A5C", "#8B7355", "#2E7D32", "#A1887F", "#6D9B3A", "#D4A574"];

// ── Derived constants ───────────────────────────────────────────────────────

const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 8; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 21 && m > 0) break;
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      slots.push({
        value: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
        label: `${h12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`,
      });
    }
  }
  return slots;
})();

const DURATIONS = [
  { value: 60, label: "1 hr" },
  { value: 90, label: "1.5 hr" },
  { value: 120, label: "2 hr" },
  { value: 150, label: "2.5 hr" },
  { value: 180, label: "3 hr" },
];

// ── Persistence ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "pll-diamond-v4";

async function loadEvents() {
  try {
    const r = await window.storage.get(STORAGE_KEY);
    return r ? JSON.parse(r.value) : [];
  } catch {
    return [];
  }
}

async function saveEvents(events) {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(events));
  } catch (e) {
    console.error("Storage write failed:", e);
  }
}

// ── Utility helpers ─────────────────────────────────────────────────────────

function getWeekDates(offset = 0) {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getMonthData(offset = 0) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + offset;
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDow = first.getDay() === 0 ? 6 : first.getDay() - 1; // Monday = 0
  const days = [];
  // Fill leading blanks
  for (let i = 0; i < startDow; i++) {
    const d = new Date(first);
    d.setDate(d.getDate() - (startDow - i));
    days.push({ date: d, inMonth: false });
  }
  // Fill month days
  for (let i = 1; i <= last.getDate(); i++) {
    days.push({ date: new Date(year, month, i), inMonth: true });
  }
  // Fill trailing to complete grid (6 rows × 7 cols max)
  while (days.length < 42 && days.length % 7 !== 0) {
    const d = new Date(last);
    d.setDate(d.getDate() + (days.length - startDow - last.getDate() + 1));
    days.push({ date: d, inMonth: false });
  }
  return { year: first.getFullYear(), month: first.getMonth(), days, label: first.toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
}

const fmtDate  = (d) => d.toISOString().split("T")[0];
const fmtShort = (d) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const fmtLong  = (d) => d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const toMin    = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

function fmtTime(t) {
  const [h, m] = t.split(":").map(Number);
  return `${h > 12 ? h - 12 : h || 12}:${String(m).padStart(2, "0")}${h >= 12 ? "p" : "a"}`;
}

function fmtEndTime(start, duration) {
  const total = toMin(start) + duration;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h > 12 ? h - 12 : h || 12}:${String(m).padStart(2, "0")}${h >= 12 ? "p" : "a"}`;
}

function isToday(d) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function hasConflict(events, fieldId, date, startTime, duration, excludeId = null) {
  const newStart = toMin(startTime);
  const newEnd = newStart + duration;
  return events
    .filter((e) => e.id !== excludeId && e.fieldId === fieldId && e.date === date)
    .some((e) => {
      const s = toMin(e.startTime);
      return newStart < s + e.duration && newEnd > s;
    });
}

function getEventLabel(ev) {
  if (ev.title) return ev.title;
  const div = DIVISIONS.find((d) => d.id === ev.divisionId);
  const type = EVENT_TYPES.find((t) => t.id === ev.eventType);
  return div ? `${div.short} ${type?.label || ""}` : type?.label || "Event";
}

// ── Export helpers ───────────────────────────────────────────────────────────

function exportGameChangerCSV(events) {
  const gameEvents = events
    .filter((e) => ["game", "makeup", "district"].includes(e.eventType))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  const rows = gameEvents.map((e) => {
    const [y, mo, da] = e.date.split("-");
    const mins = toMin(e.startTime);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const field = FIELDS.find((f) => f.id === e.fieldId);
    return [
      `${mo}/${da}/${y}`,
      `${h12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`,
      e.duration,
      e.homeTeam || "TBD",
      e.awayTeam || "TBD",
      `East Plymouth Valley Park - ${field?.name || "TBD"}`,
    ].join(",");
  });

  return ["date,start_time,duration,home_team,away_team,location", ...rows].join("\n");
}

function exportICS(events) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PLL Diamond Manager//EN"];
  for (const e of events) {
    const field = FIELDS.find((f) => f.id === e.fieldId);
    const [y, mo, da] = e.date.split("-");
    const [h, m] = e.startTime.split(":");
    const endMins = toMin(e.startTime) + e.duration;
    const eh = String(Math.floor(endMins / 60)).padStart(2, "0");
    const em = String(endMins % 60).padStart(2, "0");
    lines.push(
      "BEGIN:VEVENT",
      `DTSTART:${y}${mo}${da}T${h}${m}00`,
      `DTEND:${y}${mo}${da}T${eh}${em}00`,
      `SUMMARY:${getEventLabel(e)}`,
      `LOCATION:EPVP ${field?.name || ""}`,
      ...(e.notes ? [`DESCRIPTION:${e.notes}`] : []),
      `UID:${e.id}@pll-diamond`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function exportFullCSV(events) {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const rows = sorted.map((e) => {
    const f = FIELDS.find((x) => x.id === e.fieldId);
    const d = DIVISIONS.find((x) => x.id === e.divisionId);
    return [e.date, fmtTime(e.startTime), fmtEndTime(e.startTime, e.duration), f?.name || "", d?.name || "", e.eventType, e.title || "", (e.notes || "").replace(/,/g, ";")].join(",");
  });
  return ["Date,Time,End,Field,Division,Type,Title,Notes", ...rows].join("\n");
}

function downloadFile(content, filename, mimeType = "text/csv") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

// ── Diamond Logo ────────────────────────────────────────────────────────────
// Emoji-style flat baseball field. The foul lines form a perfect 90° angle
// at home plate, extending through 1B/3B all the way to the outfield wall.
//
// Geometry (100×100 viewBox, circle center=50,50 r=48):
//   Home = 50, 80       (bottom of diamond)
//   1B   = 70, 60       (right — 45° from home)
//   3B   = 30, 60       (left  — 45° from home)
//   2B   = 50, 40       (top of diamond)
//   Mound ≈ 50, 60
//
// Foul lines: 45° from vertical → right line from (50,80) toward upper-right,
// left line toward upper-left. Extended to circle edge:
//   Right foul line: (50,80) → (98,32)
//   Left  foul line: (50,80) → (2, 32)

function DiamondLogo({ size = 44 }) {
  // Circle: center (50,50), radius 48.
  // Foul lines at 45° from home (50,80) intersect the circle at:
  //   Right: (95.5, 34.5)   Left: (4.5, 34.5)
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: "block" }}>
      {/* Grass circle */}
      <circle cx="50" cy="50" r="48" fill="#4A8C3F" />

      {/* Fair territory wedge */}
      <path d="M50,80 L4.5,34.5 A48,48 0 0,1 95.5,34.5 Z" fill="#3D7A32" />

      {/* Foul lines */}
      <line x1="50" y1="80" x2="95.5" y2="34.5" stroke="#fff" strokeWidth="2" />
      <line x1="50" y1="80" x2="4.5"  y2="34.5" stroke="#fff" strokeWidth="2" />

      {/* Infield dirt */}
      <polygon points="50,40 70,60 50,80 30,60" fill="#DEB887" />
      {/* Infield grass */}
      <polygon points="50,47 63,60 50,73 37,60" fill="#5AAE4A" />

      {/* Pitcher's mound */}
      <circle cx="50" cy="60" r="4.5" fill="#C8A86C" />
      <rect x="47.5" y="58.5" width="5" height="2.5" rx="1" fill="#fff" />

      {/* Home plate */}
      <polygon points="50,80 46,76 46,73 54,73 54,76" fill="#fff" />
      {/* 1st base */}
      <rect x="66.5" y="56.5" width="7" height="7" rx="1" fill="#fff" transform="rotate(45 70 60)" />
      {/* 2nd base */}
      <rect x="46.5" y="36.5" width="7" height="7" rx="1" fill="#fff" transform="rotate(45 50 40)" />
      {/* 3rd base */}
      <rect x="26.5" y="56.5" width="7" height="7" rx="1" fill="#fff" transform="rotate(45 30 60)" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════

export default function DiamondManager() {
  const [events, setEvents] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [view, setView] = useState("week");
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [modalEvent, setModalEvent] = useState(null);
  const [filterDivision, setFilterDivision] = useState("all");
  const [filterField, setFilterField] = useState("all");
  const [toast, setToast] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Load / save
  useEffect(() => { loadEvents().then((d) => { setEvents(d); setLoaded(true); }); }, []);
  useEffect(() => { if (loaded) saveEvents(events); }, [events, loaded]);

  // Derived
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const monthData = useMemo(() => getMonthData(monthOffset), [monthOffset]);
  const filteredEvents = useMemo(
    () => events.filter((e) => (filterDivision === "all" || e.divisionId === filterDivision) && (filterField === "all" || e.fieldId === filterField)),
    [events, filterDivision, filterField]
  );

  const weekStats = useMemo(() => {
    const weekKeys = weekDates.map(fmtDate);
    const weekEvts = events.filter((e) => weekKeys.includes(e.date));
    return {
      games: weekEvts.filter((e) => ["game", "makeup", "district"].includes(e.eventType)).length,
      practices: weekEvts.filter((e) => e.eventType === "practice").length,
      rainouts: events.filter((e) => e.eventType === "rainout").length,
      total: events.length,
    };
  }, [events, weekDates]);

  // Actions
  const flash = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const openNewEvent = useCallback((fieldId, date, startTime) => {
    setModalEvent({
      fieldId: fieldId || "f1",
      date: date || fmtDate(new Date()),
      startTime: startTime || "17:00",
      duration: 120,
      divisionId: "",
      eventType: "game",
      title: "",
      notes: "",
      homeTeam: "",
      awayTeam: "",
    });
  }, []);

  const openEditEvent = useCallback((ev) => setModalEvent({ ...ev }), []);

  const saveEvent = useCallback((ev) => {
    if (hasConflict(events, ev.fieldId, ev.date, ev.startTime, ev.duration, ev.id)) {
      flash("⚠️ Field conflict — another event occupies this slot.", "error");
      return;
    }
    if (ev.id) {
      setEvents((prev) => prev.map((e) => (e.id === ev.id ? ev : e)));
      flash("Updated!");
    } else {
      setEvents((prev) => [...prev, { ...ev, id: uid() }]);
      flash("Scheduled! ⚾");
    }
    setModalEvent(null);
  }, [events, flash]);

  const deleteEvent = useCallback((id) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setModalEvent(null);
    flash("Removed");
  }, [flash]);

  const markRainout = useCallback((ev) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === ev.id
          ? { ...e, eventType: "rainout", notes: `RAINED OUT — ${fmtTime(e.startTime)} on ${e.date}. ${e.notes || ""}`.trim() }
          : e
      )
    );
    flash("Marked as rain out 🌧️");
    setModalEvent(null);
  }, [flash]);

  // ── Render ──

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #C5D5BC; border-radius: 3px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        button:active { transform: scale(0.97); }
        select:focus, input:focus, textarea:focus { border-color: #4A8C3F !important; outline: none; box-shadow: 0 0 0 3px rgba(74,140,63,0.15); }
      `}</style>

      {/* ── Header ── */}
      <header style={S.header}>
        <div style={S.brand}>
          <div style={S.logoRow}>
            <DiamondLogo size={44} />
            <div>
              <div style={S.brandName}>Diamond Manager</div>
              <div style={S.brandSub}>Plymouth Little League · EPVP</div>
            </div>
          </div>
          <div style={S.headerButtons}>
            <button style={S.iconBtn} onClick={() => setShowExport((p) => !p)}>📤</button>
            <button style={S.primaryBtn} onClick={() => openNewEvent()}>+ New Event</button>
          </div>
        </div>

        {/* Stats */}
        <div style={S.statsRow}>
          {[
            { label: "Games", value: weekStats.games, icon: "⚾" },
            { label: "Practices", value: weekStats.practices, icon: "🏋️" },
            { label: "Rain Outs", value: weekStats.rainouts, icon: "🌧️" },
            { label: "Total", value: weekStats.total, icon: "📋" },
          ].map((s, i) => (
            <div key={i} style={S.statPill}>
              <span>{s.icon}</span>
              <span style={S.statNum}>{s.value}</span>
              <span style={S.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Export panel */}
        {showExport && (
          <>
            <div style={S.backdrop} onClick={() => setShowExport(false)} />
            <div style={S.exportDrop}>
              <div style={S.exportHead}>Export Schedule</div>
              {[
                { icon: "📊", title: "GameChanger CSV", sub: "Bulk import at web.gc.com", action: () => { downloadFile(exportGameChangerCSV(events), `PLL_GC_${fmtDate(new Date())}.csv`); flash("GameChanger CSV exported!"); } },
                { icon: "📅", title: "Calendar (.ics)", sub: "Apple, Google, Outlook", action: () => { downloadFile(exportICS(events), "PLL_Schedule.ics", "text/calendar"); flash("Calendar exported!"); } },
                { icon: "📋", title: "Full CSV", sub: "All events + details", action: () => { downloadFile(exportFullCSV(events), `PLL_Full_${fmtDate(new Date())}.csv`); flash("Full CSV exported!"); } },
              ].map((item, i) => (
                <button key={i} style={S.exportBtn} onClick={() => { item.action(); setShowExport(false); }}>
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: "#8B7355" }}>{item.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Toolbar */}
        <div style={S.toolbar}>
          <div style={S.toolbarLeft}>
            <div style={S.viewToggle}>
              {[["month", "Month"], ["week", "Week"], ["day", "Day"], ["list", "List"]].map(([key, label]) => (
                <button key={key} style={{ ...S.toggleBtn, ...(view === key ? S.toggleActive : {}) }} onClick={() => setView(key)}>{label}</button>
              ))}
            </div>
            <div style={S.navGroup}>
              <button style={S.navBtn} onClick={() => { setWeekOffset(0); setMonthOffset(0); setSelectedDay(new Date()); }}>Today</button>
              <button style={S.navBtn} onClick={() => {
                if (view === "day") setSelectedDay((p) => { const d = new Date(p); d.setDate(d.getDate() - 1); return d; });
                else if (view === "month") setMonthOffset((m) => m - 1);
                else setWeekOffset((w) => w - 1);
              }}>‹</button>
              <span style={S.navLabel}>{
                view === "day" ? fmtLong(selectedDay) :
                view === "month" ? monthData.label :
                `${fmtShort(weekDates[0])} — ${fmtShort(weekDates[6])}`
              }</span>
              <button style={S.navBtn} onClick={() => {
                if (view === "day") setSelectedDay((p) => { const d = new Date(p); d.setDate(d.getDate() + 1); return d; });
                else if (view === "month") setMonthOffset((m) => m + 1);
                else setWeekOffset((w) => w + 1);
              }}>›</button>
            </div>
          </div>
          <div style={S.filters}>
            <select style={S.select} value={filterDivision} onChange={(e) => setFilterDivision(e.target.value)}>
              <option value="all">All Divisions</option>
              <optgroup label="⚾ Baseball">{DIVISIONS.filter((d) => d.type === "baseball" || d.type === "both").map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</optgroup>
              <optgroup label="🥎 Softball">{DIVISIONS.filter((d) => d.type === "softball").map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</optgroup>
            </select>
            <select style={S.select} value={filterField} onChange={(e) => setFilterField(e.target.value)}>
              <option value="all">All Fields</option>
              {FIELDS.map((f) => <option key={f.id} value={f.id}>{f.emoji} {f.name}</option>)}
            </select>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main style={{ minHeight: "50vh" }}>
        {view === "month" && <MonthView monthData={monthData} events={filteredEvents} onAdd={openNewEvent} onEdit={openEditEvent} onDayClick={(d) => { setSelectedDay(d); setView("day"); }} />}
        {view === "week" && <WeekView dates={weekDates} events={filteredEvents} onAdd={openNewEvent} onEdit={openEditEvent} onDayClick={(d) => { setSelectedDay(d); setView("day"); }} />}
        {view === "day"  && <DayView date={selectedDay} events={filteredEvents} onAdd={openNewEvent} onEdit={openEditEvent} />}
        {view === "list" && <ListView events={filteredEvents} onEdit={openEditEvent} />}
      </main>

      {/* ── Footer legend ── */}
      <footer style={S.footer}>
        <div style={S.footerScroll}>
          {FIELDS.map((f, i) => (
            <div key={f.id} style={{ ...S.fieldTag, borderLeft: `3px solid ${FIELD_STRIPE[i % FIELD_STRIPE.length]}` }}>
              <span>{f.emoji}</span>
              <span style={{ fontWeight: 800 }}>{f.short}</span>
              {f.lights && <span style={{ fontSize: 10 }}>💡</span>}
            </div>
          ))}
          <div style={S.fieldTag}><span style={{ fontSize: 10, color: "#8B7355" }}>💡 = Night games</span></div>
        </div>
      </footer>

      {/* ── Modal ── */}
      {modalEvent && (
        <EventModal
          event={modalEvent}
          allEvents={events}
          onSave={saveEvent}
          onDelete={deleteEvent}
          onRainout={markRainout}
          onClose={() => setModalEvent(null)}
        />
      )}

      {/* ── Toast ── */}
      {toast && <div style={{ ...S.toast, background: toast.type === "error" ? "#C0392B" : "#27AE60" }}>{toast.msg}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MONTH VIEW
// ═══════════════════════════════════════════════════════════════════════════

function MonthView({ monthData, events, onAdd, onEdit, onDayClick }) {
  const DOW = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  return (
    <div style={{ padding: "12px 16px" }}>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1,
        background: "#E0D5C5", borderRadius: 12, overflow: "hidden",
      }}>
        {/* Day-of-week headers */}
        {DOW.map((d) => (
          <div key={d} style={{ background: "#F7F3ED", padding: "8px 4px", textAlign: "center", fontSize: 9, fontWeight: 800, color: "#A0936E", letterSpacing: "0.1em" }}>{d}</div>
        ))}
        {/* Day cells */}
        {monthData.days.map(({ date, inMonth }, i) => {
          const dateStr = fmtDate(date);
          const dayEvents = events.filter((e) => e.date === dateStr);
          const today = isToday(date);
          return (
            <div key={i} onClick={() => onDayClick(date)} style={{
              background: today ? "#E8F5E9" : inMonth ? "#fff" : "#F7F3ED",
              padding: 4, minHeight: 72, cursor: "pointer",
              opacity: inMonth ? 1 : 0.4,
            }}>
              <div style={{
                fontSize: 12, fontWeight: 800, marginBottom: 3,
                color: today ? "#fff" : inMonth ? "#3E2723" : "#A0936E",
                ...(today ? {
                  background: "#4A8C3F", borderRadius: "50%", width: 22, height: 22,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                } : {}),
              }}>
                {date.getDate()}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {dayEvents.slice(0, 3).map((ev) => (
                  <EventChip key={ev.id} event={ev} onClick={(e) => { e.stopPropagation(); onEdit(ev); }} />
                ))}
                {dayEvents.length > 3 && (
                  <div style={{ fontSize: 9, color: "#8B7355", fontWeight: 700, paddingLeft: 4 }}>+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WEEK VIEW
// ═══════════════════════════════════════════════════════════════════════════

function WeekView({ dates, events, onAdd, onEdit, onDayClick }) {
  return (
    <div style={S.scrollContainer}>
      <div style={S.weekGrid}>
        {/* Corner cell */}
        <div style={S.gridCorner} />

        {/* Day headers */}
        {dates.map((d) => (
          <div key={d.toISOString()} style={{ ...S.dayHeader, ...(isToday(d) ? { background: "#E8F5E9" } : {}) }} onClick={() => onDayClick(d)}>
            <span style={S.dayName}>{d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</span>
            <span style={{ ...S.dayNum, ...(isToday(d) ? S.todayBadge : {}) }}>{d.getDate()}</span>
          </div>
        ))}

        {/* Field rows */}
        {FIELDS.map((field, fi) => {
          const stripe = FIELD_STRIPE[fi % FIELD_STRIPE.length];
          const rowBg = fi % 2 === 0 ? "#F7F3ED" : "#F1EDE5";
          return (
            <React.Fragment key={field.id}>
              {/* Field label */}
              <div style={{ ...S.fieldLabel, background: rowBg, borderLeft: `3px solid ${stripe}` }}>
                <span style={{ fontSize: 14 }}>{field.emoji}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>{field.short}</div>
                  <div style={{ fontSize: 9, color: "#A0936E", fontWeight: 600 }}>{field.size}</div>
                </div>
                {field.lights && <span style={{ fontSize: 10, marginLeft: "auto" }}>💡</span>}
              </div>

              {/* Day cells */}
              {dates.map((d) => {
                const dateStr = fmtDate(d);
                const cellEvents = events.filter((e) => e.fieldId === field.id && e.date === dateStr);
                const bg = isToday(d)
                  ? fi % 2 === 0 ? "#EFF8EF" : "#E8F3E8"
                  : fi % 2 === 0 ? "#FFFFFF" : "#FAFAF6";
                return (
                  <div key={field.id + dateStr} style={{ ...S.weekCell, background: bg }} onClick={() => onAdd(field.id, dateStr)}>
                    {cellEvents.map((ev) => <EventChip key={ev.id} event={ev} onClick={(e) => { e.stopPropagation(); onEdit(ev); }} />)}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ── Event Chip ──────────────────────────────────────────────────────────────

function EventChip({ event, onClick }) {
  const div = DIVISIONS.find((d) => d.id === event.divisionId);
  const type = EVENT_TYPES.find((t) => t.id === event.eventType);
  const isRain = event.eventType === "rainout";
  const isClosed = event.eventType === "closed" || event.eventType === "maintenance";
  const color = isRain ? "#9E9E9E" : isClosed ? "#78909C" : (div?.color || "#4A8C3F");

  return (
    <div onClick={onClick} style={{
      background: `${color}15`, borderLeft: `3px solid ${color}`, color: "#3E2723",
      padding: "2px 6px", borderRadius: 4, fontSize: 10, cursor: "pointer",
      display: "flex", alignItems: "center", gap: 3, overflow: "hidden",
      textDecoration: isRain ? "line-through" : "none", opacity: isRain ? 0.5 : 1,
    }}>
      <span style={{ flexShrink: 0 }}>{type?.icon}</span>
      <span style={{ fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {div?.short || event.eventType.slice(0, 4).toUpperCase()}
      </span>
      <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, opacity: 0.45, flexShrink: 0 }}>{fmtTime(event.startTime)}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DAY VIEW
// ═══════════════════════════════════════════════════════════════════════════

function DayView({ date, events, onAdd, onEdit }) {
  const dateStr = fmtDate(date);
  const hours = Array.from({ length: 14 }, (_, i) => i + 8);

  return (
    <div style={S.scrollContainer}>
      <div style={S.dayGrid}>
        {/* Time gutter */}
        <div style={S.dayGutter}>
          <div style={{ height: 48 }} />
          {hours.map((h) => (
            <div key={h} style={S.dayTimeLabel}>{h > 12 ? h - 12 : h}{h >= 12 ? "p" : "a"}</div>
          ))}
        </div>

        {/* Field columns */}
        {FIELDS.map((field, fi) => {
          const fieldEvents = events.filter((e) => e.fieldId === field.id && e.date === dateStr);
          const stripe = FIELD_STRIPE[fi % FIELD_STRIPE.length];
          return (
            <div key={field.id} style={S.dayColumn}>
              <div style={{ ...S.dayColumnHeader, borderBottom: `3px solid ${stripe}` }}>
                <span style={{ fontSize: 13 }}>{field.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 800 }}>{field.short}</span>
              </div>
              <div style={{ position: "relative" }}>
                {hours.map((h) => (
                  <div key={h} style={S.dayHourRow} onClick={() => onAdd(field.id, dateStr, `${String(h).padStart(2, "0")}:00`)} />
                ))}
                {fieldEvents.map((ev) => {
                  const div = DIVISIONS.find((d) => d.id === ev.divisionId);
                  const bg = div?.color || "#4A8C3F";
                  const topPx = ((toMin(ev.startTime) - 480) / 60) * 56;
                  const heightPx = (ev.duration / 60) * 56;
                  const isRain = ev.eventType === "rainout";
                  return (
                    <div key={ev.id} onClick={(e) => { e.stopPropagation(); onEdit(ev); }} style={{
                      position: "absolute", top: topPx, left: 2, right: 2,
                      height: Math.max(heightPx - 2, 22), background: `${bg}15`,
                      borderLeft: `3px solid ${bg}`, borderRadius: 4,
                      padding: "3px 5px", cursor: "pointer", overflow: "hidden", zIndex: 2,
                      textDecoration: isRain ? "line-through" : "none", opacity: isRain ? 0.5 : 1,
                    }}>
                      <div style={{ fontSize: 9, fontFamily: "'JetBrains Mono'", color: "#8B7355" }}>{fmtTime(ev.startTime)}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#3E2723" }}>{getEventLabel(ev)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LIST VIEW
// ═══════════════════════════════════════════════════════════════════════════

function ListView({ events, onEdit }) {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const grouped = {};
  sorted.forEach((e) => { (grouped[e.date] ??= []).push(e); });

  if (!sorted.length) {
    return (
      <div style={{ textAlign: "center", padding: "60px 24px" }}>
        <DiamondLogo size={80} />
        <div style={{ color: "#8B7355", fontSize: 15, fontWeight: 500, marginTop: 16 }}>
          No events yet — tap <b>+ New Event</b> to get started.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 20px" }}>
      {Object.entries(grouped).map(([date, dayEvents]) => (
        <div key={date} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#A0936E", marginBottom: 8, letterSpacing: "0.05em" }}>
            {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).toUpperCase()}
          </div>
          {dayEvents.map((ev) => {
            const field = FIELDS.find((f) => f.id === ev.fieldId);
            const div = DIVISIONS.find((d) => d.id === ev.divisionId);
            const type = EVENT_TYPES.find((t) => t.id === ev.eventType);
            const isRain = ev.eventType === "rainout";
            return (
              <div key={ev.id} onClick={() => onEdit(ev)} style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "#fff", borderRadius: 10, padding: "12px 14px",
                marginBottom: 6, cursor: "pointer", border: "1px solid #E8E0D4",
                borderLeft: `4px solid ${div?.color || "#4A8C3F"}`,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                opacity: isRain ? 0.5 : 1, textDecoration: isRain ? "line-through" : "none",
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono'", color: "#8B7355" }}>{fmtTime(ev.startTime)} – {fmtEndTime(ev.startTime, ev.duration)}</span>
                    <span style={{ fontSize: 11, color: "#A0936E", fontWeight: 600 }}>{field?.emoji} {field?.short}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#3E2723" }}>{type?.icon} {getEventLabel(ev)}</div>
                  {ev.notes && <div style={{ fontSize: 11, color: "#A0936E", marginTop: 2 }}>{ev.notes}</div>}
                </div>
                {div && <div style={{ background: div.color, color: "#fff", fontSize: 10, fontWeight: 800, padding: "4px 8px", borderRadius: 6 }}>{div.short}</div>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT MODAL
// ═══════════════════════════════════════════════════════════════════════════

function EventModal({ event, allEvents, onSave, onDelete, onRainout, onClose }) {
  const [form, setForm] = useState({ ...event });
  const [conflict, setConflict] = useState(false);
  const isEdit = !!event.id;

  const update = (key, value) => {
    const next = { ...form, [key]: value };
    // Auto-assign correct field when division changes
    if (key === "divisionId" && value) {
      const div = DIVISIONS.find((d) => d.id === value);
      if (div && !div.fields.includes(next.fieldId)) next.fieldId = div.fields[0];
    }
    setForm(next);
    setConflict(hasConflict(allEvents, next.fieldId, next.date, next.startTime, next.duration, next.id));
  };

  const selectedDivision = DIVISIONS.find((d) => d.id === form.divisionId);
  const fieldMismatch = selectedDivision && !selectedDivision.fields.includes(form.fieldId);

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={S.modalHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <DiamondLogo size={28} />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#3E2723" }}>{isEdit ? "Edit Event" : "New Event"}</h2>
          </div>
          <button style={{ background: "none", border: "none", color: "#A0936E", fontSize: 18, cursor: "pointer" }} onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px" }}>
          {/* Event type */}
          <div style={S.formGroup}>
            <label style={S.formLabel}>Event Type</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              {EVENT_TYPES.filter((t) => t.id !== "rainout").map((t) => (
                <button key={t.id} onClick={() => update("eventType", t.id)} style={{
                  ...S.typeButton,
                  ...(form.eventType === t.id ? { borderColor: "#4A8C3F", background: "rgba(74,140,63,0.08)", color: "#2E5A24" } : {}),
                }}>
                  <span>{t.icon}</span>
                  <span style={{ fontSize: 10 }}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Division */}
          {!["maintenance", "closed"].includes(form.eventType) && (
            <div style={S.formGroup}>
              <label style={S.formLabel}>Division</label>
              <select style={S.formInput} value={form.divisionId} onChange={(e) => update("divisionId", e.target.value)}>
                <option value="">Select division…</option>
                <optgroup label="⚾ Baseball">{DIVISIONS.filter((d) => d.type === "baseball" || d.type === "both").map((d) => <option key={d.id} value={d.id}>{d.name} ({d.ages})</option>)}</optgroup>
                <optgroup label="🥎 Softball">{DIVISIONS.filter((d) => d.type === "softball").map((d) => <option key={d.id} value={d.id}>{d.name} ({d.ages})</option>)}</optgroup>
              </select>
            </div>
          )}

          {/* Team selectors */}
          {form.divisionId && selectedDivision && form.eventType === "game" && (
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={S.formLabel}>Home</label>
                <select style={S.formInput} value={form.homeTeam || ""} onChange={(e) => update("homeTeam", e.target.value)}>
                  <option value="">Select…</option>
                  {selectedDivision.teams.map((t) => <option key={t} value={t}>{t}</option>)}
                  <option value="TBD">TBD</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 8, fontWeight: 800, color: "#A0936E" }}>vs</div>
              <div style={{ flex: 1 }}>
                <label style={S.formLabel}>Away</label>
                <select style={S.formInput} value={form.awayTeam || ""} onChange={(e) => update("awayTeam", e.target.value)}>
                  <option value="">Select…</option>
                  {selectedDivision.teams.filter((t) => t !== form.homeTeam).map((t) => <option key={t} value={t}>{t}</option>)}
                  <option value="TBD">TBD</option>
                </select>
              </div>
            </div>
          )}

          {/* Title (non-game events) */}
          {(!form.divisionId || form.eventType !== "game") && (
            <div style={S.formGroup}>
              <label style={S.formLabel}>Title</label>
              <input style={S.formInput} placeholder="e.g. Cardinals vs Phillies" value={form.title} onChange={(e) => update("title", e.target.value)} />
            </div>
          )}

          {/* Field picker */}
          <div style={S.formGroup}>
            <label style={S.formLabel}>Field</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
              {FIELDS.map((field) => {
                const recommended = selectedDivision?.fields.includes(field.id);
                const selected = form.fieldId === field.id;
                return (
                  <button key={field.id} onClick={() => update("fieldId", field.id)} style={{
                    border: `2px solid ${selected ? "#4A8C3F" : "#E0D5C5"}`,
                    background: selected ? "rgba(74,140,63,0.08)" : "#fff",
                    color: "#3E2723", borderRadius: 8, padding: "6px 4px",
                    fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                  }}>
                    {field.emoji} {field.short}
                    {recommended && <span style={{ color: "#27AE60", fontSize: 10 }}>✓</span>}
                  </button>
                );
              })}
            </div>
            {fieldMismatch && (
              <div style={{ marginTop: 6, fontSize: 11, color: "#D35400", background: "rgba(211,84,0,0.06)", padding: "6px 10px", borderRadius: 6 }}>
                ⚠️ {selectedDivision.name} typically plays on {selectedDivision.fields.map((fid) => FIELDS.find((fi) => fi.id === fid)?.short).join(", ")}
              </div>
            )}
          </div>

          {/* Date / Time / Duration */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 120px" }}>
              <label style={S.formLabel}>Date</label>
              <input type="date" style={S.formInput} value={form.date} onChange={(e) => update("date", e.target.value)} />
            </div>
            <div style={{ flex: "1 1 100px" }}>
              <label style={S.formLabel}>Start</label>
              <select style={S.formInput} value={form.startTime} onChange={(e) => update("startTime", e.target.value)}>
                {TIME_SLOTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ flex: "1 1 80px" }}>
              <label style={S.formLabel}>Duration</label>
              <select style={S.formInput} value={form.duration} onChange={(e) => update("duration", Number(e.target.value))}>
                {DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>

          {/* Conflict warning */}
          {conflict && (
            <div style={{ background: "rgba(192,57,43,0.06)", border: "1px solid rgba(192,57,43,0.2)", color: "#C0392B", borderRadius: 8, padding: "10px 14px", fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
              🚨 Field conflict — adjust time or field
            </div>
          )}

          {/* Notes */}
          <div style={S.formGroup}>
            <label style={S.formLabel}>Notes</label>
            <textarea style={{ ...S.formInput, resize: "vertical" }} rows={2} placeholder="Optional notes…" value={form.notes} onChange={(e) => update("notes", e.target.value)} />
          </div>
        </div>

        {/* Footer */}
        <div style={S.modalFooter}>
          {isEdit && (
            <div style={{ display: "flex", gap: 6 }}>
              <button style={{ ...S.dangerBtn, color: "#C0392B", borderColor: "rgba(192,57,43,0.3)", background: "rgba(192,57,43,0.05)" }} onClick={() => { if (confirm("Delete this event?")) onDelete(event.id); }}>Delete</button>
              {event.eventType !== "rainout" && (
                <button style={{ ...S.dangerBtn, color: "#2874A6", borderColor: "rgba(40,116,166,0.3)", background: "rgba(40,116,166,0.05)" }} onClick={() => onRainout(event)}>🌧️ Rain Out</button>
              )}
            </div>
          )}
          <div style={{ flex: 1 }} />
          <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...S.saveBtn, opacity: conflict ? 0.4 : 1 }}
            disabled={conflict}
            onClick={() => {
              const final = { ...form };
              if (form.homeTeam && form.awayTeam && form.eventType === "game") {
                final.title = `${form.homeTeam} vs ${form.awayTeam}`;
              }
              onSave(final);
            }}
          >
            {isEdit ? "Update" : "Schedule ⚾"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const S = {
  // App shell
  app:            { fontFamily: "'Outfit', system-ui, sans-serif", background: "#F7F3ED", color: "#3E2723", minHeight: "100vh", fontSize: 14, position: "relative" },
  header:         { background: "#fff", borderBottom: "2px solid #E0D5C5", borderTop: "4px solid #4A8C3F", position: "sticky", top: 0, zIndex: 100, padding: "12px 16px 0", boxShadow: "0 2px 8px rgba(62,39,35,0.06)" },

  // Brand
  brand:          { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  logoRow:        { display: "flex", alignItems: "center", gap: 10 },
  brandName:      { fontSize: 19, fontWeight: 900, letterSpacing: "-0.5px", background: "linear-gradient(135deg, #2E7D32, #4A8C3F, #C49A5C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" },
  brandSub:       { fontSize: 11, color: "#8B7355", fontWeight: 600 },
  headerButtons:  { display: "flex", gap: 8, alignItems: "center" },
  iconBtn:        { background: "#F7F3ED", border: "1.5px dashed rgba(192,57,43,0.25)", borderRadius: 8, padding: "7px 10px", cursor: "pointer", fontSize: 15 },
  primaryBtn:     { background: "#4A8C3F", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(74,140,63,0.25)" },

  // Stats
  statsRow:       { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 },
  statPill:       { background: "#F7F3ED", borderRadius: 8, padding: "7px 10px", display: "flex", alignItems: "center", gap: 6, border: "1.5px dashed rgba(192,57,43,0.2)" },
  statNum:        { fontSize: 17, fontWeight: 900, fontFamily: "'JetBrains Mono'" },
  statLabel:      { fontSize: 9, fontWeight: 700, color: "#8B7355", textTransform: "uppercase" },

  // Export
  backdrop:       { position: "fixed", inset: 0, zIndex: 150 },
  exportDrop:     { position: "absolute", top: 52, right: 16, background: "#fff", border: "1px solid #E0D5C5", borderRadius: 12, padding: 12, zIndex: 200, width: 260, boxShadow: "0 12px 40px rgba(62,39,35,0.12)", animation: "slideIn 0.15s ease" },
  exportHead:     { fontSize: 11, fontWeight: 800, color: "#8B7355", marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" },
  exportBtn:      { display: "flex", alignItems: "center", gap: 10, width: "100%", background: "#F7F3ED", border: "1.5px dashed rgba(192,57,43,0.2)", color: "#3E2723", borderRadius: 8, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit", marginBottom: 6, textAlign: "left", fontSize: 13 },

  // Toolbar
  toolbar:        { display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, flexWrap: "wrap" },
  toolbarLeft:    { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  viewToggle:     { display: "flex", background: "#F7F3ED", borderRadius: 8, padding: 2, border: "1.5px dashed rgba(192,57,43,0.25)" },
  toggleBtn:      { background: "transparent", border: "none", color: "#8B7355", padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  toggleActive:   { background: "#4A8C3F", color: "#fff" },
  navGroup:       { display: "flex", alignItems: "center", gap: 4 },
  navBtn:         { background: "#F7F3ED", border: "1.5px dashed rgba(192,57,43,0.2)", color: "#3E2723", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  navLabel:       { fontSize: 12, fontWeight: 700, minWidth: 160, textAlign: "center", color: "#5D4037" },
  filters:        { display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" },
  select:         { background: "#fff", border: "1px solid #E0D5C5", color: "#3E2723", borderRadius: 6, padding: "5px 8px", fontSize: 12, fontFamily: "inherit", cursor: "pointer" },

  // Shared scroll wrapper
  scrollContainer: { overflow: "auto", padding: "12px 16px", WebkitOverflowScrolling: "touch" },

  // Week grid
  weekGrid:       { display: "grid", gridTemplateColumns: "80px repeat(7, 1fr)", gap: 1, background: "#E0D5C5", borderRadius: 12, overflow: "hidden", minWidth: 680 },
  gridCorner:     { background: "#F7F3ED", padding: 8 },
  dayHeader:      { background: "#F7F3ED", padding: "8px 4px", textAlign: "center", cursor: "pointer" },
  dayName:        { display: "block", fontSize: 9, fontWeight: 800, color: "#A0936E", letterSpacing: "0.1em" },
  dayNum:         { display: "inline-block", fontSize: 16, fontWeight: 900, marginTop: 2, color: "#3E2723" },
  todayBadge:     { background: "#4A8C3F", color: "#fff", borderRadius: "50%", width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center" },
  fieldLabel:     { background: "#F7F3ED", padding: "8px 8px", display: "flex", alignItems: "center", gap: 6 },
  weekCell:       { background: "#fff", padding: 3, minHeight: 48, cursor: "pointer", display: "flex", flexDirection: "column", gap: 2 },

  // Day grid
  dayGrid:        { display: "flex", gap: 1, background: "#E0D5C5", borderRadius: 12, overflow: "hidden", minWidth: 680 },
  dayGutter:      { width: 40, flexShrink: 0, background: "#F7F3ED" },
  dayTimeLabel:   { height: 56, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", paddingRight: 6, fontSize: 9, color: "#A0936E", fontFamily: "'JetBrains Mono'", fontWeight: 600 },
  dayColumn:      { flex: 1, minWidth: 72, background: "#fff" },
  dayColumnHeader:{ background: "#F7F3ED", padding: "8px 4px", textAlign: "center", height: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 },
  dayHourRow:     { height: 56, borderBottom: "1px solid #F0EBE3", cursor: "pointer" },

  // Footer
  footer:         { background: "#fff", borderTop: "1px solid #E0D5C5", padding: "10px 16px", position: "sticky", bottom: 0, boxShadow: "0 -2px 8px rgba(62,39,35,0.04)" },
  footerScroll:   { display: "flex", gap: 8, overflow: "auto", alignItems: "center", WebkitOverflowScrolling: "touch" },
  fieldTag:       { display: "flex", alignItems: "center", gap: 4, background: "#F7F3ED", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600, flexShrink: 0, color: "#5D4037", border: "1.5px dashed rgba(192,57,43,0.18)" },

  // Modal
  overlay:        { position: "fixed", inset: 0, background: "rgba(62,39,35,0.35)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(3px)" },
  modal:          { background: "#fff", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 520, maxHeight: "92vh", overflow: "auto", border: "1px solid #E0D5C5", boxShadow: "0 -12px 40px rgba(62,39,35,0.15)", animation: "fadeUp 0.2s ease" },
  modalHeader:    { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #E8E0D4" },
  modalFooter:    { display: "flex", gap: 8, padding: "14px 20px", borderTop: "1px solid #E8E0D4", alignItems: "center", flexWrap: "wrap", paddingBottom: "max(14px, env(safe-area-inset-bottom))" },

  // Form elements
  formGroup:      { marginBottom: 16 },
  formLabel:      { display: "block", fontSize: 10, fontWeight: 800, color: "#8B7355", marginBottom: 5, letterSpacing: "0.06em", textTransform: "uppercase" },
  formInput:      { width: "100%", background: "#F7F3ED", border: "1px solid #E0D5C5", color: "#3E2723", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", WebkitAppearance: "none" },
  typeButton:     { background: "#F7F3ED", border: "1.5px solid #E0D5C5", color: "#8B7355", borderRadius: 8, padding: "7px 4px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontWeight: 700 },
  dangerBtn:      { border: "1px solid", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: "transparent" },
  cancelBtn:      { background: "#F7F3ED", border: "1.5px dashed rgba(192,57,43,0.25)", color: "#5D4037", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  saveBtn:        { background: "#4A8C3F", border: "2px dashed rgba(192,57,43,0.5)", color: "#fff", borderRadius: 8, padding: "7px 18px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(74,140,63,0.25)" },
  toast:          { position: "fixed", bottom: "max(70px, calc(60px + env(safe-area-inset-bottom)))", left: "50%", transform: "translateX(-50%)", padding: "10px 22px", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'Outfit', sans-serif", zIndex: 2000, boxShadow: "0 8px 24px rgba(0,0,0,0.2)", animation: "fadeUp 0.2s ease", maxWidth: "90vw", textAlign: "center" },
};
