import countryToIso from "./country_to_iso3.json";
import sparkRaw from "./SPARK_cleaned.csv?raw";

export type Item = { id: string; name: string; countries: string[] };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  const len = text.length;
  let cur: string = "";
  let row: string[] = [];
  let inQuotes = false;

  while (i < len) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (ch === ',' && !inQuotes) {
      row.push(cur);
      cur = "";
      i++;
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      i++;
      continue;
    }

    cur += ch;
    i++;
  }

  // push last
  if (cur !== "" || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }

  return rows;
}

const rows = parseCsv(sparkRaw || "");
const header = rows[0] || [];

function findIndex(name: string) {
  for (let i = 0; i < header.length; i++) if ((header[i] || "").trim() === name) return i;
  return -1;
}

const idxId = findIndex("FA Number");
const idxRegion = findIndex("Region / Countries Covered");
const idxName = findIndex("Item / Service Short Description");

type PartialItem = { id: string; name: string; countries: Set<string>; isGlobal: boolean };

const map = new Map<string, PartialItem>();

if (idxId >= 0 && idxRegion >= 0 && idxName >= 0) {
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const id = (row[idxId] || "").trim();
    const regionRaw = (row[idxRegion] || "").trim();
    const name = (row[idxName] || "").trim();
    if (!id) continue;

    let entry = map.get(id);
    if (!entry) {
      entry = { id, name, countries: new Set<string>(), isGlobal: false };
      map.set(id, entry);
    }

    if (regionRaw && regionRaw.toLowerCase() === "global") {
      entry.isGlobal = true;
      continue;
    }

    if (regionRaw) {
      const parts = regionRaw.split(",").map((s) => s.trim()).filter(Boolean);
      for (const p of parts) {
        if (/^[A-Z]{3}$/.test(p)) {
          entry.countries.add(p);
          continue;
        }
        const mapped = (countryToIso as Record<string, string>)[p];
        if (mapped) entry.countries.add(mapped);
      }
    }
  }
}

export const items: Item[] = Array.from(map.values()).map((e) => ({
  id: e.id,
  name: e.name,
  countries: e.isGlobal ? [] : Array.from(e.countries),
}));

export default items;
