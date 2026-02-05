/**
 * PointTheMap - Civilizations Database
 * ======================================================
 * Used for Civilizations game mode: zone-based find-the-region.
 * Only civilizations with matching GeoJSON polygons in
 * public/data/civilizations.geojson are included – the selection
 * pool must match the available map boundaries.
 *
 * Structure:
 * - id: stable slug matching GeoJSON feature property
 * - name: display name
 * - popular: true = easy (2 per game), false = obscure (3 per game)
 *
 * @typedef {{ id: string, name: string, popular: boolean }} CivilizationEntry
 */

export const civilizations = [
  // Popular – household names, well-known geography
  { id: "roman_empire", name: "Roman Empire", popular: true },
  { id: "ancient_egypt", name: "Ancient Egypt", popular: true },
  { id: "ancient_greece", name: "Ancient Greece", popular: true },
  { id: "maya", name: "Maya", popular: true },
  { id: "aztec", name: "Aztec Empire", popular: true },
  // Obscure – famous but geography is trickier to pinpoint
  { id: "inca", name: "Inca Empire", popular: false },
  { id: "persian_empire", name: "Persian Empire", popular: false },
  { id: "ottoman_empire", name: "Ottoman Empire", popular: false },
  { id: "mongol_empire", name: "Mongol Empire", popular: false },
  { id: "byzantine_empire", name: "Byzantine Empire", popular: false },
];
