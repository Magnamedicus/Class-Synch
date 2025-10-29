// src/utils/scheduleImport.ts
// Utility to parse uploaded .ics or .csv class schedules and persist them
// into questionnaire answers in the same structure as manual entry.

import { readAnswers, writeAnswers, emailKey as toEmailKey } from "./qaStorage";

type DayName = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export type ParsedClass = {
  code: string;             // e.g., BIO101
  days: DayName[];          // e.g., ["monday","wednesday","friday"]
  start: string;            // e.g., "09:00 AM"
  end: string;              // e.g., "10:15 AM"
};

const ICAL_DAY_TO_DAY: Record<string, DayName> = {
  MO: "monday",
  TU: "tuesday",
  WE: "wednesday",
  TH: "thursday",
  FR: "friday",
  SA: "saturday",
  SU: "sunday",
};

const DAY_WORD_TO_DAY: Record<string, DayName> = {
  mon: "monday",
  monday: "monday",
  m: "monday",
  tue: "tuesday",
  tues: "tuesday",
  tu: "tuesday",
  t: "tuesday", // caution: "t" often maps to Tuesday
  tuesday: "tuesday",
  wed: "wednesday",
  w: "wednesday",
  wednesday: "wednesday",
  thu: "thursday",
  th: "thursday",
  r: "thursday", // common shorthand
  thursday: "thursday",
  fri: "friday",
  f: "friday",
  friday: "friday",
  sat: "saturday",
  saturday: "saturday",
  s: "saturday",
  sun: "sunday",
  su: "sunday",
  sunday: "sunday",
};

function pad2(n: number) { return String(n).padStart(2, "0"); }

function toAmPm(h24: number, m: number) {
  const ap = h24 >= 12 ? "PM" : "AM";
  let h = h24 % 12; if (h === 0) h = 12;
  return `${pad2(h)}:${pad2(m)} ${ap}`;
}

// Heuristic: what looks like a real course code?
// Examples: BIO101, CHE-302, ENG204A, BIO101-LAB, CHE302-LEC
const COURSE_RE = /^[A-Za-z]{2,8}[- ]?\d{2,4}[A-Za-z]?(?:-[A-Z]{2,5})?$/;
function isLikelyCourse(code: string) {
  return COURSE_RE.test(code);
}
function normalizeTimeToken(token: string): string | null {
  const s = token.trim().toUpperCase().replace(/\./g, ":");
  // Support HMM/HHMM without colon (e.g., 900, 1330)
  const m4 = s.match(/^(\d{3,4})\s*(AM|PM)?$/i);
  if (m4) {
    const digits = m4[1];
    const ap2 = m4[2] ? m4[2].toUpperCase() : "";
    const hh = digits.length === 3 ? parseInt(digits.slice(0, 1), 10) : parseInt(digits.slice(0, 2), 10);
    const mm = digits.length === 3 ? parseInt(digits.slice(1), 10) : parseInt(digits.slice(2), 10);
    return normalizeTimeToken(`${hh}:${String(mm).padStart(2, "0")} ${ap2}`.trim());
  }
  const m = s.match(/^(\d{1,2})(?::?(\d{1,2}))?\s*(AM|PM)?$/i);
  if (!m) return null;
  let hh = parseInt(m[1], 10);
  let mm = m[2] ? parseInt(m[2].padStart(2, "0"), 10) : 0;
  const ap = m[3];
  if (ap) {
    const isPM = ap.toUpperCase() === "PM";
    if (hh === 12) hh = isPM ? 12 : 0; else if (isPM) hh += 12;
  } else {
    if (!(hh >= 0 && hh <= 23)) return null;
  }
  if (mm < 0 || mm > 59 || hh < 0 || hh > 23) return null;
  return toAmPm(hh, mm);
}

function parseICS(text: string): ParsedClass[] {
  const out: ParsedClass[] = [];
  const rawLines = text.replace(/\r/g, "").split(/\n/);
  // Unfold folded iCalendar lines (continuation lines start with space or tab)
  const lines: string[] = [];
  for (const ln of rawLines) {
    if (/^[\t\s]/.test(ln) && lines.length) {
      lines[lines.length - 1] += ln.replace(/^[\t\s]+/, "");
    } else {
      lines.push(ln);
    }
  }
  let cur: Record<string, string> = {};
  const flush = () => {
    if (!cur["SUMMARY"]) return;
    // Only consider weekly recurring events that specify BYDAY (typical for classes)
    const rrule = cur["RRULE"] || ""; // e.g., FREQ=WEEKLY;BYDAY=MO,WE,FR
    if (!/FREQ=WEEKLY/.test(rrule)) {
      // Skip one-off or non-weekly events to avoid importing travel/reservations, etc.
      return;
    }

    // Course code from SUMMARY: prefer patterns like ABC123 or ABC-123, or words with digits
    const sum = cur["SUMMARY"].trim();
    let code: string | undefined;
    const codeRe = /([A-Za-z]{3,6})\s*-?\s*(\d{2,4}[A-Za-z]?)/; // BIO101, CHE-302, ENG204A (>=3 letters)
    const m = sum.match(codeRe);
    if (m) {
      code = (m[1] + m[2]).toUpperCase();
    } else {
      const token = sum.split(/\s+/).find(t => /\d/.test(t) && /[A-Za-z]/.test(t));
      if (token) code = token.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    }
    if (!code || !isLikelyCourse(code)) return; // must resemble a course code

    // Times
    const dtstart = cur["DTSTART"] || Object.entries(cur).find(([k]) => k.startsWith("DTSTART"))?.[1];
    const dtend = cur["DTEND"] || Object.entries(cur).find(([k]) => k.startsWith("DTEND"))?.[1];
    if (!dtstart || !dtend) return; // require explicit times
    // DTSTART:20241105T130000Z or DTSTART;TZID=...:20241105T130000
    const ts = dtstart.replace(/^.*:/, "");
    const te = dtend.replace(/^.*:/, "");
    const tsm = ts.match(/T(\d{2})(\d{2})(\d{2})?/);
    const tem = te.match(/T(\d{2})(\d{2})(\d{2})?/);
    if (!tsm || !tem) return;
    const hs = parseInt(tsm[1], 10);
    const ms = parseInt(tsm[2], 10);
    const he = parseInt(tem[1], 10);
    const me = parseInt(tem[2], 10);
    const start = toAmPm(hs, ms);
    const end = toAmPm(he, me);

    // Days from RRULE BYDAY (preferred). If missing for WEEKLY rules, fallback to DTSTART weekday per RFC 5545.
    let days: DayName[] = [];
    const byday = rrule.match(/BYDAY=([^;]+)/);
    if (byday) {
      days = byday[1].split(",").map(k => ICAL_DAY_TO_DAY[k.trim()]).filter(Boolean) as DayName[];
    }
    if (days.length === 0) {
      // Fallback: use DTSTART's calendar day as the weekly repeat day
      const dtstartRaw = cur["DTSTART"] || Object.entries(cur).find(([k]) => k.startsWith("DTSTART"))?.[1];
      if (dtstartRaw) {
        const ts = dtstartRaw.replace(/^.*:/, "");
        if (ts.length >= 8) {
          const y = parseInt(ts.slice(0, 4), 10);
          const m = parseInt(ts.slice(4, 6), 10) - 1;
          const d = parseInt(ts.slice(6, 8), 10);
          // Use local-equivalent weekday from UTC date as an approximation (no TZ lib available)
          const wd = new Date(Date.UTC(y, m, d)).getUTCDay(); // 0=Sun..6=Sat
          const map: DayName[] = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
          days = [map[wd]];
        }
      }
    }
    if (days.length === 0) return; // still unknown

    if (days.length) out.push({ code, days, start, end });
  };

  let inEvent = false;
  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      inEvent = true; cur = {};
    } else if (line.startsWith("END:VEVENT")) {
      inEvent = false; flush(); cur = {};
    } else if (inEvent) {
      const idx = line.indexOf(":");
      if (idx > 0) {
        const key = line.slice(0, idx).split(";")[0];
        const val = line.slice(idx + 1).trim();
        cur[key] = val;
      }
    }
  }
  return out;
}

function normalizeDayTokens(text: string): DayName[] {
  const t = text.toLowerCase().trim();
  const days: DayName[] = [];
  // Try words first
  const wordMatches = t.match(/mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|\bth\b|fri|friday|sat|saturday|sun|sunday|\b[mwrfstu]\b/gi);
  if (wordMatches) {
    for (const w of wordMatches) {
      const d = DAY_WORD_TO_DAY[w.toLowerCase()];
      if (d && !days.includes(d)) days.push(d);
    }
    if (days.length) return days;
  }
  // Shorthand like MWF, TuTh
  let s = t.replace(/\s+/g, "");
  // Map various Thursday tokens to R, including a bare 'th'
  s = s.replace(/thu|thurs|thur|\bth\b/gi, "R");
  s = s.replace(/tue|tues/gi, "T");
  const map: Record<string, DayName> = { M: "monday", T: "tuesday", W: "wednesday", R: "thursday", F: "friday", S: "saturday", U: "sunday" };
  const out: DayName[] = [];
  for (const ch of s.toUpperCase()) {
    const d = map[ch]; if (d && !out.includes(d)) out.push(d);
  }
  return out;
}

function parseCSV(text: string): ParsedClass[] {
  const rows = text.replace(/\r/g, "").split(/\n/).filter(Boolean);
  if (!rows.length) return [];
  const header = rows[0].split(",").map(h => h.trim().toLowerCase());
  const findIdx = (...patterns: RegExp[]) => header.findIndex(h => patterns.some(p => p.test(h)));
  const idxName = findIdx(/course|class|name|title|section/);
  const idxSubject = findIdx(/subject|dept|department|prefix/);
  const idxCatalog = findIdx(/catalog|number|no\b|code|catalog number|catalog_number/);
  const idxDays = findIdx(/day|days|meeting day|dow|byday/);
  const idxStart = findIdx(/start|begin|from/);
  const idxEnd = findIdx(/end|finish|to|until/);
  const idxTime = findIdx(/time|hours|meeting time|when/);
  const out: ParsedClass[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split(",").map(c => c.trim());
    const name = idxName >= 0 ? cols[idxName] : `COURSE${i}`;
    const raw = name.replace(/\s+/g, "").toUpperCase();
    let code = raw;
    if (idxSubject >= 0 && idxCatalog >= 0) {
      const sub = (cols[idxSubject] || "").toUpperCase().replace(/[^A-Za-z]/g, "");
      const cat = (cols[idxCatalog] || "").toUpperCase().replace(/[^0-9A-Za-z]/g, "");
      if (sub && cat) code = `${sub}${cat}`;
    }
    const m = code.match(/[A-Za-z]{3,6}-?\d{2,4}[A-Za-z]?/);
    if (m) code = m[0].replace(/[^A-Za-z0-9]/g, "");
    // Detect components and suffix, e.g., LAB/LEC/DISC/REC
    const fullName = (idxName >= 0 ? cols[idxName] : name).toUpperCase();
    if (/\bLAB\b/.test(fullName)) code = `${code}-LAB`;
    else if (/\bLEC(TURE)?\b|\bLECT\b/.test(fullName)) code = `${code}-LEC`;
    else if (/\bDISC(USSION)?\b|\bRECIT(ATION)?\b|\bREC\b/.test(fullName)) code = `${code}-DISC`;
    if (!isLikelyCourse(code)) continue;

    let days: DayName[] = [];
    let start = "09:00 AM";
    let end = "10:00 AM";

    if (idxDays >= 0 && cols[idxDays]) {
      days = normalizeDayTokens(cols[idxDays]);
    }
    if (idxStart >= 0 && idxEnd >= 0 && cols[idxStart] && cols[idxEnd]) {
      start = normalizeTimeToken(cols[idxStart]) || start;
      end = normalizeTimeToken(cols[idxEnd]) || end;
    } else if (idxTime >= 0 && cols[idxTime]) {
      const pieces = cols[idxTime].split(/\s*-\s*|[^0-9A-Za-z: ]+/).map(t => t.trim()).filter(Boolean);
      if (pieces.length >= 2) {
        const a = normalizeTimeToken(pieces[0]);
        const b = normalizeTimeToken(pieces[1]);
        if (a && b) { start = a; end = b; }
      }
    }
    if (days.length) out.push({ code, days, start, end });
  }
  return out;
}

function upsertClasses(email: string, classes: ParsedClass[]) {
  const answers = readAnswers(email);
  // Start with existing list but drop items that don't look like real courses
  let list: string[] = Array.isArray(answers["school_classes"]) ? answers["school_classes"].slice() : [];
  list = list.filter(isLikelyCourse);
  for (const c of classes) {
    if (!isLikelyCourse(c.code)) continue;
    if (!list.includes(c.code)) list.push(c.code);
    const slug = c.code.toLowerCase();
    const id = `class_${slug}`;
    answers[`${id}_meeting_days`] = c.days;
    answers[`${id}_meeting_time`] = { start: c.start, end: c.end };
  }
  answers["school_classes"] = list;
  writeAnswers(email, answers);
}

export async function importScheduleFromFile(file: File): Promise<{ imported: number; parsed: ParsedClass[]; errors?: string[] }>{
  const currentUserRaw = localStorage.getItem("currentUser");
  if (!currentUserRaw) return { imported: 0, parsed: [], errors: ["No current user"] };
  const { email } = JSON.parse(currentUserRaw || "{}") as { email?: string };
  if (!email) return { imported: 0, parsed: [], errors: ["No email in current user"] };

  const text = await file.text();
  const name = (file.name || "").toLowerCase();
  let parsed: ParsedClass[] = [];
  const errors: string[] = [];
  try {
    if (name.endsWith(".ics")) parsed = parseICS(text);
    else if (name.endsWith(".csv")) parsed = parseCSV(text);
    else {
      // Heuristic sniff
      if (/BEGIN:VCALENDAR/.test(text)) parsed = parseICS(text); else parsed = parseCSV(text);
    }
  } catch (e: any) {
    errors.push(`Parse failed: ${e?.message || e}`);
  }

  if (parsed.length) {
    upsertClasses(email, parsed);
  }
  return { imported: parsed.length, parsed, errors: errors.length ? errors : undefined };
}
