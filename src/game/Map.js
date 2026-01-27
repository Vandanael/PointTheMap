// Point The Map - Map Wrapper

import { MAP } from "../config.js";
import { getTheme } from "../services/storage.js";
import { isIOS } from "../utils.js";
import { eventBus } from "../core/EventBus.js";
import {
  MARKERS,
  LINES,
  MAP_ANIMATIONS,
  getLineColor,
  getZoomLevel,
} from "../config/visual-constants.js";

let map = null;
let tileLayer = null;
let markers = [];
let polylines = [];
let clickHandler = null;

// Mettre à jour les tuiles selon le thème
const updateMapTiles = () => {
  if (!map) return;
  
  // Supprimer l'ancien layer si existant
  if (tileLayer) {
    map.removeLayer(tileLayer);
  }

  // Choisir les tuiles selon le thème
  const theme = getTheme();
  const tileUrl = theme === 'light'
    ? MAP.TILE_URL_LIGHT
    : MAP.TILE_URL_DARK;

  tileLayer = L.tileLayer(tileUrl, {
    maxZoom: MAP.MAX_ZOOM,
    attribution: MAP.ATTRIBUTION,
    keepBuffer: 4,
    updateWhenZooming: true,
    updateWhenIdle: true,
    crossOrigin: false,
    minZoom: MAP.MIN_ZOOM
  }).addTo(map);

  tileLayer.on("tileerror", () => {});
};

export const initMap = (containerId) => {
  if (typeof L === "undefined") {
    throw new Error(
      "Leaflet (L) n'est pas chargé. Vérifiez que le script Leaflet est inclus dans index.html"
    );
  }

  map = L.map(containerId, {
    center: MAP.CENTER,
    zoom: MAP.ZOOM,
    minZoom: MAP.MIN_ZOOM,
    maxZoom: MAP.MAX_ZOOM,
    zoomControl: false,
    attributionControl: false,
    keepBuffer: 4,
    zoomAnimation: true,
    preferCanvas: false,
    fadeAnimation: true,
    markerZoomAnimation: true,
  });

  map.setView(MAP.CENTER, MAP.ZOOM, { animate: false });
  updateMapTiles();
  map.doubleClickZoom.disable();

  return map;
};

// Subscribe to theme changes
eventBus.subscribe('theme:changed', () => {
  updateMapTiles();
});

const onMapClick = (callback) => {
  if (clickHandler) {
    map.off("click", clickHandler);
    // iOS: Nettoyer aussi les événements tap
    if (isIOS()) {
      map.off("tap", clickHandler);
    }
  }
  clickHandler = (e) => callback([e.latlng.lat, e.latlng.lng]);
  map.on("click", clickHandler);

  // iOS: Ajouter le support des événements tap pour une meilleure réactivité
  if (isIOS()) {
    map.on("tap", clickHandler);
  }
};

// Désactiver les clics
export const disableClicks = () => {
  if (clickHandler) {
    map.off("click", clickHandler);
    // iOS: Désactiver aussi les événements tap
    if (isIOS()) {
      map.off("tap", clickHandler);
    }
    clickHandler = null;
  }
};

// Activer les clics
export const enableClicks = (callback) => {
  onMapClick(callback);
};

export const addClickMarker = (coords) => {
  const marker = L.marker(coords, {
    icon: L.divIcon({
      className: "",
      html: `<div class="marker-player"></div>`,
      iconSize: MARKERS.PLAYER.iconSize,
      iconAnchor: MARKERS.PLAYER.iconAnchor,
    }),
  }).addTo(map);

  markers.push(marker);
  return marker;
};

export const addCapitalMarker = (coords) => {
  const marker = L.marker(coords, {
    icon: L.divIcon({
      className: "",
      html: `<div class="marker-target"></div>`,
      iconSize: MARKERS.CAPITAL.iconSize,
      iconAnchor: MARKERS.CAPITAL.iconAnchor,
    }),
  }).addTo(map);

  markers.push(marker);
  return marker;
};

export const drawLine = (from, to, distanceKm) => {
  const lineColor = getLineColor(distanceKm);
  const coords = [from, to];

  const outlineLine = L.polyline(coords, {
    ...LINES.OUTLINE,
  });

  const mainLine = L.polyline(coords, {
    ...LINES.MAIN,
    color: lineColor,
  });

  const lineGroup = L.layerGroup([outlineLine, mainLine]).addTo(map);
  polylines.push(lineGroup);
  return lineGroup;
};

export const showRoundResult = (clickCoords, capitalCoords, distanceKm) => {
  addClickMarker(clickCoords);
  addCapitalMarker(capitalCoords);
  drawLine(clickCoords, capitalCoords, distanceKm);

  const midLat = (clickCoords[0] + capitalCoords[0]) / 2;
  const midLng = (clickCoords[1] + capitalCoords[1]) / 2;
  const zoomLevel = getZoomLevel(distanceKm);

  map.flyTo([midLat, midLng], zoomLevel, MAP_ANIMATIONS.SHOW_RESULT);
};

export const clearMap = () => {
  markers.forEach((m) => map.removeLayer(m));
  polylines.forEach((p) => map.removeLayer(p));
  markers = [];
  polylines = [];
};

export const resetView = () => {
  map.flyTo(MAP.CENTER, MAP.ZOOM, MAP_ANIMATIONS.RESET_VIEW);
};
