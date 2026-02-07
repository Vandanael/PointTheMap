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
  { id: 'roman_empire', name: 'Roman Empire', popular: true },
  { id: 'ancient_egypt', name: 'Ancient Egypt', popular: true },
  { id: 'ancient_greece', name: 'Ancient Greece', popular: true },
  { id: 'maya', name: 'Maya', popular: true },
  { id: 'aztec', name: 'Aztec Empire', popular: true },
  { id: 'tang_dynasty', name: 'Tang Dynasty', popular: true },
  { id: 'mughal_empire', name: 'Mughal Empire', popular: true },
  { id: 'holy_roman_empire', name: 'Holy Roman Empire', popular: true },
  { id: 'franks', name: 'Franks (Carolingian)', popular: true },
  { id: 'viking_age', name: 'Viking Age', popular: true },
  { id: 'khmer_empire', name: 'Khmer Empire', popular: true },
  { id: 'mali_empire', name: 'Mali Empire', popular: true },
  { id: 'ghana_empire', name: 'Ghana Empire', popular: true },
  { id: 'abbasid_caliphate', name: 'Abbasid Caliphate', popular: true },
  { id: 'umayyad_caliphate', name: 'Umayyad Caliphate', popular: true },
  { id: 'macedonia', name: 'Macedonia (Alexander)', popular: true },
  { id: 'carthage', name: 'Carthage', popular: true },
  { id: 'assyria', name: 'Assyria', popular: true },
  { id: 'maurya_empire', name: 'Maurya Empire', popular: true },
  { id: 'gupta_empire', name: 'Gupta Empire', popular: true },
  { id: 'ancient_rome', name: 'Ancient Rome', popular: true },
  { id: 'ancient_india', name: 'Ancient India', popular: true },
  { id: 'venetian_republic', name: 'Venetian Republic', popular: true },
  // Obscure – famous but geography is trickier to pinpoint
  { id: 'inca', name: 'Inca Empire', popular: false },
  { id: 'persian_empire', name: 'Persian Empire', popular: false },
  { id: 'ottoman_empire', name: 'Ottoman Empire', popular: false },
  { id: 'mongol_empire', name: 'Mongol Empire', popular: false },
  { id: 'byzantine_empire', name: 'Byzantine Empire', popular: false },
  { id: 'mesopotamia', name: 'Mesopotamia', popular: false },
  { id: 'indus_valley', name: 'Indus Valley', popular: false },
  { id: 'ptolemaic_egypt', name: 'Ptolemaic Egypt', popular: false },
  { id: 'seljuk_empire', name: 'Seljuk Empire', popular: false },
  { id: 'safavid_empire', name: 'Safavid Empire', popular: false },
  { id: 'teotihuacan', name: 'Teotihuacan', popular: false },
  { id: 'nubia', name: 'Nubia', popular: false },
  { id: 'axum', name: 'Kingdom of Axum', popular: false },
  { id: 'songhai_empire', name: 'Songhai Empire', popular: false },
  { id: 'great_zimbabwe', name: 'Great Zimbabwe', popular: false },
  { id: 'benin_empire', name: 'Benin Empire', popular: false },
  { id: 'olmec', name: 'Olmec', popular: false },
  { id: 'qin_dynasty', name: 'Qin Dynasty', popular: false },
  { id: 'hittites', name: 'Hittites', popular: false },
  { id: 'tiwanaku', name: 'Tiwanaku', popular: false },
  { id: 'toltec', name: 'Toltec Empire', popular: false },
  { id: 'srivijaya', name: 'Srivijaya', popular: false },
  { id: 'tibetan_empire', name: 'Tibetan Empire', popular: false },
  { id: 'chimu', name: 'Chimú Empire', popular: false },
  { id: 'moche', name: 'Moche', popular: false },
  { id: 'wari', name: 'Wari Empire', popular: false },
  { id: 'chavin', name: 'Chavin', popular: false },
  { id: 'nazca', name: 'Nazca', popular: false },
  { id: 'silla', name: 'Silla', popular: false },
  { id: 'goryeo', name: 'Goryeo', popular: false },
  { id: 'song_dynasty', name: 'Song Dynasty', popular: false },
  { id: 'yuan_dynasty', name: 'Yuan Dynasty', popular: false },
  { id: 'timurid_empire', name: 'Timurid Empire', popular: false },
  { id: 'kievan_rus', name: 'Kievan Rus', popular: false },
  { id: 'mamluk_sultanate', name: 'Mamluk Sultanate', popular: false },
  { id: 'fatimid_caliphate', name: 'Fatimid Caliphate', popular: false },
  { id: 'chola_dynasty', name: 'Chola Dynasty', popular: false },
];
