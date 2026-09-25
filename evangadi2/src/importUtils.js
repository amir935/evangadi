// importUtils.js — shared JSON/CSV parsing for the app's bulk-import boxes
// (Tutor Roster, New Students to Watch). The boss sometimes sends a JSON
// array, sometimes a CSV export — both funnel through parseImportText into
// the same array-of-objects shape.

// Minimal RFC4180-ish CSV parser: handles quoted fields containing commas,
// newlines, and escaped quotes ("").
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      pushField();
      pushRow();
    } else if (c === "\r") {
      // skip — \r\n handled via the following \n
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    pushField();
    pushRow();
  }

  const filtered = rows.filter((r) => r.some((v) => v.trim() !== ""));
  if (filtered.length === 0) return [];
  const headers = filtered[0].map((h) => h.trim());
  return filtered.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}

// Parses pasted/uploaded text as JSON if it looks like JSON, otherwise as CSV.
// Always returns an array of plain objects (or strings, for JSON arrays of
// bare names).
export function parseImportText(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const data = JSON.parse(trimmed);
    return Array.isArray(data) ? data : [data];
  }
  return parseCsv(trimmed);
}

// Loose boolean parse for CSV cells like "true"/"yes"/"1" as well as real
// JSON booleans.
export function truthy(v) {
  if (typeof v === "boolean") return v;
  if (v == null) return false;
  return ["true", "yes", "y", "1"].includes(String(v).trim().toLowerCase());
}
