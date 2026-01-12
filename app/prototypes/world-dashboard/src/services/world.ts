import type { FeatureCollection, Geometry } from "geojson";

export type WorldGeoJSON = FeatureCollection<Geometry, any>;

export async function loadWorldGeoJSON(): Promise<WorldGeoJSON> {
  const res = await fetch("/data/world.geojson");
  if (!res.ok) throw new Error(`Failed to load world.geojson: ${res.status}`);
  return (await res.json()) as WorldGeoJSON;
}