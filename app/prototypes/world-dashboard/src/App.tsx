import { useMemo, useState, useEffect } from "react";
import WorldMap from "./components/WorldMap";
import { items as sparkItems } from "./data/itemsFromSpark";

export default function App() {
  const [selectedIso3, setSelectedIso3] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState(sparkItems[0]?.id ?? "");

  const selectedItem = useMemo(() => sparkItems.find((i) => i.id === selectedItemId) ?? null, [
    selectedItemId,
  ]);

  const highlightedIso3 = useMemo(() => new Set(selectedItem?.countries ?? []), [selectedItem]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHighlighted, setSearchHighlighted] = useState<Set<string>>(new Set());
  const [nameToIso, setNameToIso] = useState<Record<string, string>>({});


  const fasForCountry = useMemo(() => {
    if (!selectedIso3) return [] as typeof sparkItems;
    return sparkItems.filter((it) =>
      it.countries.length === 0 || it.countries.includes(selectedIso3)
    );
  }, [selectedIso3]);

  const combinedHighlighted = useMemo(() => {
    const s = new Set<string>(highlightedIso3);
    for (const iso of searchHighlighted) s.add(iso);
    return s;
  }, [highlightedIso3, searchHighlighted]);

  const [countriesByIso, setCountriesByIso] = useState<Record<string, string>>({});
  useEffect(() => {
    let mounted = true;
    fetch("/data/countries.json")
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        const results = data?.results ?? data ?? [];
        const map: Record<string, string> = {};
        for (const c of results) {
          if (c.iso3 && c.name) map[c.iso3] = c.name;
        }
        setCountriesByIso(map);
        const nameMap: Record<string, string> = {};
        for (const k of Object.keys(map)) {
          const n = map[k];
          nameMap[n.trim().toLowerCase()] = k;
        }
        setNameToIso(nameMap);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 1, maxWidth: 1000 }}>
          <div style={{ marginBottom: 8, color: "#555" }}>Items: {sparkItems.length}</div>

          <div style={{ margin: "12px 0" }}>
            <div style={{ marginBottom: 10 }}>
              <input
                placeholder="Search Countries"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const q = searchQuery.trim();
                    if (!q) return;
                    let iso: string | undefined;
                    if (/^[A-Za-z]{3}$/.test(q)) {
                      const up = q.toUpperCase();
                      if (countriesByIso[up]) iso = up;
                    }
                    if (!iso) iso = nameToIso[q.trim().toLowerCase()];
                    if (!iso) {
                      const ql = q.toLowerCase();
                      for (const [k, v] of Object.entries(countriesByIso)) {
                        if (v.toLowerCase().includes(ql)) {
                          iso = k;
                          break;
                        }
                      }
                    }
                    if (iso) {
                      setSelectedIso3(iso);
                      setSearchHighlighted(new Set([iso]));
                    }
                  }
                }}
                style={{ width: 420, padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
              />
            </div>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Item</label>

            <select
              value={selectedItemId}
              onChange={(e) => {
                setSelectedItemId(e.target.value);
                setSearchHighlighted(new Set());
              }}
              style={{ width: 420, padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
            >
              {sparkItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

            <div style={{ fontSize: 12, marginTop: 6, color: "#555" }}>
              Highlighting {highlightedIso3.size} countries
            </div>
          </div>

          <WorldMap
            highlightedIso3={combinedHighlighted}
            onCountryClick={(iso3) => {
              setSelectedIso3(iso3);
              setSearchHighlighted(new Set());
            }}
          />
        </div>

        <div
          style={{
            width: 320,
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            position: "sticky",
            top: 16,
            background: "white",
            color: "#111",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Country</div>

          {selectedIso3 ? (
            <>
              <div style={{ fontWeight: 700 }}>{countriesByIso[selectedIso3!] ?? selectedIso3} ({selectedIso3})</div>
              

              <div style={{ marginTop: 12, fontWeight: 700 }}>Framework agreements here ({fasForCountry.length})</div>
              <div style={{ marginTop: 8, maxHeight: 300, overflow: "auto" }}>
                {fasForCountry.length > 0 ? (
                  <ul style={{ paddingLeft: 16, margin: 0 }}>
                    {fasForCountry.map((f) => (
                      <li key={f.id} style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 700 }}>{f.id}</div>
                        <div style={{ fontSize: 13 }}>{f.name}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ color: "#555" }}>No framework agreements found for this country.</div>
                )}
              </div>
            </>
          ) : (
            <div style={{ color: "#555" }}>Click a country to see details.</div>
          )}
        </div>
      </div>
    </div>
  );
}