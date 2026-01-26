export type GeoPoint = { type: "Point"; coordinates: [number, number] };
export type GeoPolygon = { type: "Polygon"; coordinates: Array<Array<[number, number]>> };

export type Country = {
  id: number;
  name: string;
  iso: string | null;
  iso3: string | null;
  record_type: number;
  independent: boolean;
  is_deprecated: boolean;
  centroid: GeoPoint | null;
  bbox: GeoPolygon | null;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export async function loadCountries(): Promise<Country[]> {
  const res = await fetch("/data/countries.json");
  if (!res.ok) throw new Error(`Failed to load countries: ${res.status}`);
  const data = (await res.json()) as Paginated<Country>;

  return data.results.filter(
    (c) =>
      c.record_type === 1 &&
      c.independent &&
      !c.is_deprecated &&
      !!c.iso3 &&
      !!c.centroid
  );
}