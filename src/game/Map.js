// Point The Map - Map Wrapper
// Gestion de Leaflet (style original)

import { MAP } from "../config.js";
import { getTheme } from "../services/storage.js";

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

  // Créer et ajouter le nouveau layer avec options optimisées
  tileLayer = L.tileLayer(tileUrl, {
    maxZoom: MAP.MAX_ZOOM,
    attribution: MAP.ATTRIBUTION,
    // Buffer augmenté pour smooth animations (4 écrans)
    keepBuffer: 4,
    // Précharger les tuiles pendant le zoom pour animations fluides
    updateWhenZooming: true,
    // Précharger aussi en idle pour garantir que tout est en cache
    updateWhenIdle: true,
    // Réduire la latence
    crossOrigin: false,
    // Pas de limite de zoom pour éviter les problèmes
    minZoom: MAP.MIN_ZOOM
  }).addTo(map);

  tileLayer.on("tileerror", () => {
    // Ignore tile loading errors (graceful degradation)
  });
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

// Exporter la fonction pour mettre à jour les tuiles quand le thème change
export const refreshMapTiles = updateMapTiles;

// Exposer globalement pour le toggle de thème
if (typeof window !== 'undefined') {
  window.refreshMapTiles = updateMapTiles;
}

// Définir le handler de clic (privé)
const onMapClick = (callback) => {
  if (clickHandler) {
    map.off("click", clickHandler);
  }
  clickHandler = (e) => callback([e.latlng.lat, e.latlng.lng]);
  map.on("click", clickHandler);
};

// Désactiver les clics
export const disableClicks = () => {
  if (clickHandler) {
    map.off("click", clickHandler);
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
      iconSize: [16, 16],
      iconAnchor: [10, 10],
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
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    }),
  }).addTo(map);

  markers.push(marker);
  return marker;
};

const getLineColor = (distanceKm) => {
  if (distanceKm < 100) return "#22c55e";
  if (distanceKm < 500) return "#facc15";
  return "#94a3b8";
};

const getZoomLevel = (distanceKm) => {
  if (distanceKm < 50) return 10;
  if (distanceKm < 200) return 8;
  if (distanceKm < 500) return 6;
  if (distanceKm < 1000) return 5;
  return 4;
};

export const drawLine = (from, to, distanceKm) => {
  const lineColor = getLineColor(distanceKm);
  const coords = [from, to];

  const outlineLine = L.polyline(coords, {
    color: "#000000",
    weight: 6,
    dashArray: "10, 14",
    opacity: 1,
    lineCap: "butt",
  });

  const mainLine = L.polyline(coords, {
    color: lineColor,
    weight: 4,
    dashArray: "10, 14",
    opacity: 1,
    lineCap: "butt",
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

  map.flyTo([midLat, midLng], zoomLevel, {
    duration: 1.5,
    easeLinearity: 0.25,
    animate: true,
  });
};

export const clearMap = () => {
  markers.forEach((m) => map.removeLayer(m));
  polylines.forEach((p) => map.removeLayer(p));
  markers = [];
  polylines = [];
};

export const resetView = () => {
  map.flyTo(MAP.CENTER, MAP.ZOOM, {
    duration: 0.5,
    easeLinearity: 0.25,
  });
};
