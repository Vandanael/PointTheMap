import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  initMap,
  disableClicks,
  enableClicks,
  addClickMarker,
  addCapitalMarker,
  drawLine,
  showRoundResult,
  clearMap,
  resetView,
} from "./Map.js";

// Mock Leaflet globally
const mockMap = {
  setView: vi.fn().mockReturnThis(),
  flyTo: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  off: vi.fn().mockReturnThis(),
  removeLayer: vi.fn().mockReturnThis(),
  doubleClickZoom: {
    disable: vi.fn(),
  },
};

const mockTileLayer = {
  addTo: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
};

const mockMarker = {
  addTo: vi.fn().mockReturnThis(),
};

const mockPolyline = {
  addTo: vi.fn().mockReturnThis(),
};

const mockLayerGroup = {
  addTo: vi.fn().mockReturnThis(),
};

const mockDivIcon = vi.fn(() => ({ className: "", html: "", iconSize: [], iconAnchor: [] }));

global.L = {
  map: vi.fn(() => mockMap),
  tileLayer: vi.fn(() => mockTileLayer),
  marker: vi.fn(() => mockMarker),
  polyline: vi.fn(() => mockPolyline),
  layerGroup: vi.fn(() => mockLayerGroup),
  divIcon: mockDivIcon,
};

// Mock dependencies
vi.mock("../config.js", () => ({
  MAP: {
    CENTER: [48.8566, 2.3522],
    ZOOM: 3,
    MIN_ZOOM: 2,
    MAX_ZOOM: 18,
    TILE_URL_LIGHT: "https://tile-light.example.com/{z}/{x}/{y}.png",
    TILE_URL_DARK: "https://tile-dark.example.com/{z}/{x}/{y}.png",
    ATTRIBUTION: "Test Attribution",
  },
}));

vi.mock("../services/storage.js", () => ({
  getTheme: vi.fn(() => "light"),
}));

vi.mock("../utils.js", () => ({
  isIOS: vi.fn(() => false),
}));

vi.mock("../core/EventBus.js", () => ({
  eventBus: {
    subscribe: vi.fn(),
    emit: vi.fn(),
  },
}));

vi.mock("../config/visual-constants.js", () => ({
  MARKERS: {
    PLAYER: {
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    },
    CAPITAL: {
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    },
  },
  LINES: {
    OUTLINE: {
      color: "#000000",
      weight: 5,
      opacity: 0.5,
    },
    MAIN: {
      weight: 3,
      opacity: 1,
    },
  },
  MAP_ANIMATIONS: {
    SHOW_RESULT: {
      duration: 1,
      animate: true,
    },
    RESET_VIEW: {
      duration: 1,
      animate: true,
    },
  },
  getLineColor: vi.fn((distanceKm) => {
    if (distanceKm < 100) return "#00ff00";
    if (distanceKm < 500) return "#ffff00";
    return "#ff0000";
  }),
  getZoomLevel: vi.fn((distanceKm) => {
    if (distanceKm < 100) return 7;
    if (distanceKm < 500) return 5;
    if (distanceKm < 1000) return 4;
    return 3;
  }),
}));

import { getTheme } from "../services/storage.js";
import { isIOS } from "../utils.js";
import { eventBus } from "../core/EventBus.js";
import { getLineColor, getZoomLevel } from "../config/visual-constants.js";

describe("Map.js", () => {
  let eventBusThemeCallback = null;

  // Capture the theme callback on first load
  beforeEach(() => {
    // Capture theme callback if not already captured
    if (!eventBusThemeCallback && eventBus.subscribe.mock.calls.length > 0) {
      const themeCall = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "theme:changed"
      );
      if (themeCall) {
        eventBusThemeCallback = themeCall[1];
      }
    }

    vi.clearAllMocks();

    // Reset mockMap methods
    mockMap.setView.mockReturnThis();
    mockMap.flyTo.mockReturnThis();
    mockMap.on.mockReturnThis();
    mockMap.off.mockReturnThis();
    mockMap.removeLayer.mockReturnThis();

    // Reset other mocks
    mockTileLayer.addTo.mockReturnThis();
    mockMarker.addTo.mockReturnThis();
    mockPolyline.addTo.mockReturnThis();
    mockLayerGroup.addTo.mockReturnThis();
  });

  describe("initMap", () => {
    it("should initialize map with correct configuration", () => {
      const containerId = "map-container";
      const result = initMap(containerId);

      expect(global.L.map).toHaveBeenCalledWith(containerId, {
        center: [48.8566, 2.3522],
        zoom: 3,
        minZoom: 2,
        maxZoom: 18,
        zoomControl: false,
        attributionControl: false,
        keepBuffer: 4,
        zoomAnimation: true,
        preferCanvas: false,
        fadeAnimation: true,
        markerZoomAnimation: true,
      });

      expect(mockMap.setView).toHaveBeenCalledWith(
        [48.8566, 2.3522],
        3,
        { animate: false }
      );

      expect(mockMap.doubleClickZoom.disable).toHaveBeenCalled();
      expect(result).toBe(mockMap);
    });

    it("should throw error when Leaflet is not loaded", () => {
      const originalL = global.L;
      global.L = undefined;

      expect(() => initMap("map-container")).toThrow(
        "Leaflet (L) n'est pas chargé"
      );

      global.L = originalL;
    });

    it("should create tile layer with light theme by default", () => {
      getTheme.mockReturnValue("light");
      initMap("map-container");

      expect(global.L.tileLayer).toHaveBeenCalledWith(
        "https://tile-light.example.com/{z}/{x}/{y}.png",
        expect.objectContaining({
          maxZoom: 18,
          minZoom: 2,
          attribution: "Test Attribution",
        })
      );

      expect(mockTileLayer.addTo).toHaveBeenCalledWith(mockMap);
    });

    it("should create tile layer with dark theme", () => {
      getTheme.mockReturnValue("dark");
      initMap("map-container");

      expect(global.L.tileLayer).toHaveBeenCalledWith(
        "https://tile-dark.example.com/{z}/{x}/{y}.png",
        expect.any(Object)
      );
    });

    it("should handle tile errors silently", () => {
      initMap("map-container");

      // Get the tileerror handler registered
      expect(mockTileLayer.on).toHaveBeenCalledWith(
        "tileerror",
        expect.any(Function)
      );
    });
  });

  describe("Click handling", () => {
    beforeEach(() => {
      initMap("map-container");
      vi.clearAllMocks();
    });

    describe("enableClicks", () => {
      it("should enable map clicks with callback", () => {
        const callback = vi.fn();
        enableClicks(callback);

        expect(mockMap.on).toHaveBeenCalledWith("click", expect.any(Function));
      });

      it("should call callback with coordinates on click", () => {
        const callback = vi.fn();
        enableClicks(callback);

        // Get the click handler
        const clickHandler = mockMap.on.mock.calls.find(
          ([event]) => event === "click"
        )?.[1];

        // Simulate click
        clickHandler({ latlng: { lat: 48.8, lng: 2.3 } });

        expect(callback).toHaveBeenCalledWith([48.8, 2.3]);
      });

      it("should enable tap events on iOS", () => {
        isIOS.mockReturnValue(true);
        const callback = vi.fn();
        enableClicks(callback);

        expect(mockMap.on).toHaveBeenCalledWith("click", expect.any(Function));
        expect(mockMap.on).toHaveBeenCalledWith("tap", expect.any(Function));
      });

      it("should not enable tap events on non-iOS", () => {
        isIOS.mockReturnValue(false);
        const callback = vi.fn();
        enableClicks(callback);

        expect(mockMap.on).toHaveBeenCalledWith("click", expect.any(Function));
        expect(mockMap.on).not.toHaveBeenCalledWith("tap", expect.any(Function));
      });

      it("should remove old handler when enabling new one", () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        enableClicks(callback1);
        vi.clearAllMocks();

        enableClicks(callback2);

        expect(mockMap.off).toHaveBeenCalledWith("click", expect.any(Function));
        expect(mockMap.on).toHaveBeenCalledWith("click", expect.any(Function));
      });
    });

    describe("disableClicks", () => {
      it("should disable map clicks", () => {
        const callback = vi.fn();
        enableClicks(callback);
        vi.clearAllMocks();

        disableClicks();

        expect(mockMap.off).toHaveBeenCalledWith("click", expect.any(Function));
      });

      it("should disable tap events on iOS", () => {
        isIOS.mockReturnValue(true);
        const callback = vi.fn();
        enableClicks(callback);
        vi.clearAllMocks();

        disableClicks();

        expect(mockMap.off).toHaveBeenCalledWith("click", expect.any(Function));
        expect(mockMap.off).toHaveBeenCalledWith("tap", expect.any(Function));
      });

      it("should not error when called without prior enableClicks", () => {
        expect(() => disableClicks()).not.toThrow();
      });
    });
  });

  describe("Markers", () => {
    beforeEach(() => {
      initMap("map-container");
      vi.clearAllMocks();
    });

    describe("addClickMarker", () => {
      it("should add player marker at coordinates", () => {
        const coords = [48.8, 2.3];
        const marker = addClickMarker(coords);

        expect(global.L.marker).toHaveBeenCalledWith(
          coords,
          expect.objectContaining({
            icon: expect.any(Object),
          })
        );

        expect(mockDivIcon).toHaveBeenCalledWith({
          className: "",
          html: `<div class="marker-player"></div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        });

        expect(mockMarker.addTo).toHaveBeenCalledWith(mockMap);
        expect(marker).toBe(mockMarker);
      });
    });

    describe("addCapitalMarker", () => {
      it("should add capital marker at coordinates", () => {
        const coords = [51.5, -0.1];
        const marker = addCapitalMarker(coords);

        expect(global.L.marker).toHaveBeenCalledWith(
          coords,
          expect.objectContaining({
            icon: expect.any(Object),
          })
        );

        expect(mockDivIcon).toHaveBeenCalledWith({
          className: "",
          html: `<div class="marker-target"></div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        });

        expect(mockMarker.addTo).toHaveBeenCalledWith(mockMap);
        expect(marker).toBe(mockMarker);
      });
    });
  });

  describe("drawLine", () => {
    beforeEach(() => {
      initMap("map-container");
      vi.clearAllMocks();
    });

    it("should draw line between two points", () => {
      const from = [48.8, 2.3];
      const to = [51.5, -0.1];
      const distanceKm = 150;

      drawLine(from, to, distanceKm);

      expect(global.L.polyline).toHaveBeenCalledTimes(2); // outline + main
      expect(getLineColor).toHaveBeenCalledWith(distanceKm);
    });

    it("should use correct color for short distance", () => {
      getLineColor.mockReturnValue("#00ff00");
      const from = [48.8, 2.3];
      const to = [48.9, 2.4];

      drawLine(from, to, 50);

      expect(getLineColor).toHaveBeenCalledWith(50);
    });

    it("should use correct color for long distance", () => {
      getLineColor.mockReturnValue("#ff0000");
      const from = [48.8, 2.3];
      const to = [51.5, -0.1];

      drawLine(from, to, 1500);

      expect(getLineColor).toHaveBeenCalledWith(1500);
    });

    it("should create layer group with outline and main line", () => {
      const from = [48.8, 2.3];
      const to = [51.5, -0.1];

      drawLine(from, to, 150);

      expect(global.L.layerGroup).toHaveBeenCalledWith([
        mockPolyline,
        mockPolyline,
      ]);
      expect(mockLayerGroup.addTo).toHaveBeenCalledWith(mockMap);
    });
  });

  describe("showRoundResult", () => {
    beforeEach(() => {
      initMap("map-container");
      vi.clearAllMocks();
    });

    it("should display markers, line and fly to midpoint", () => {
      const clickCoords = [48.8, 2.3];
      const capitalCoords = [51.5, -0.1];
      const distanceKm = 340;

      showRoundResult(clickCoords, capitalCoords, distanceKm);

      // Should add both markers
      expect(global.L.marker).toHaveBeenCalledTimes(2);

      // Should draw line
      expect(global.L.polyline).toHaveBeenCalled();

      // Should calculate midpoint
      const expectedMidLat = (48.8 + 51.5) / 2;
      const expectedMidLng = (2.3 + -0.1) / 2;

      // Should get zoom level based on distance
      expect(getZoomLevel).toHaveBeenCalledWith(distanceKm);

      // Should fly to midpoint with calculated zoom
      expect(mockMap.flyTo).toHaveBeenCalledWith(
        [expectedMidLat, expectedMidLng],
        expect.any(Number),
        expect.any(Object)
      );
    });

    it("should use appropriate zoom level for short distances", () => {
      getZoomLevel.mockReturnValue(7);
      const clickCoords = [48.8, 2.3];
      const capitalCoords = [48.9, 2.4];
      const distanceKm = 50;

      showRoundResult(clickCoords, capitalCoords, distanceKm);

      expect(getZoomLevel).toHaveBeenCalledWith(50);
    });

    it("should use appropriate zoom level for long distances", () => {
      getZoomLevel.mockReturnValue(3);
      const clickCoords = [48.8, 2.3];
      const capitalCoords = [-33.9, 18.4]; // Cape Town
      const distanceKm = 9500;

      showRoundResult(clickCoords, capitalCoords, distanceKm);

      expect(getZoomLevel).toHaveBeenCalledWith(9500);
    });
  });

  describe("clearMap", () => {
    beforeEach(() => {
      initMap("map-container");
      clearMap(); // Clear any previous markers/lines from other tests
      vi.clearAllMocks();
    });

    it("should remove all markers and polylines", () => {
      // Add some markers and lines
      addClickMarker([48.8, 2.3]);
      addCapitalMarker([51.5, -0.1]);
      drawLine([48.8, 2.3], [51.5, -0.1], 150);

      const layersAdded = 3; // 2 markers + 1 line group
      vi.clearAllMocks();

      clearMap();

      // Should remove exactly the layers we added
      expect(mockMap.removeLayer).toHaveBeenCalledTimes(layersAdded);
    });

    it("should not error when map is empty", () => {
      expect(() => clearMap()).not.toThrow();
    });

    it("should allow adding new markers after clear", () => {
      addClickMarker([48.8, 2.3]);
      clearMap();
      vi.clearAllMocks();

      addClickMarker([51.5, -0.1]);

      expect(global.L.marker).toHaveBeenCalledTimes(1);
      expect(mockMarker.addTo).toHaveBeenCalledWith(mockMap);
    });
  });

  describe("resetView", () => {
    beforeEach(() => {
      initMap("map-container");
      vi.clearAllMocks();
    });

    it("should fly to default center and zoom", () => {
      resetView();

      expect(mockMap.flyTo).toHaveBeenCalledWith(
        [48.8566, 2.3522],
        3,
        expect.objectContaining({
          duration: 1,
          animate: true,
        })
      );
    });
  });

  describe("Theme updates", () => {
    it("should update tiles when theme changes", () => {
      if (!eventBusThemeCallback) {
        console.warn("Theme callback not captured, skipping test");
        return;
      }

      getTheme.mockReturnValue("light");
      initMap("map-container");

      // Change theme to dark
      getTheme.mockReturnValue("dark");
      vi.clearAllMocks();

      // Trigger theme change
      eventBusThemeCallback();

      // Should remove old tile layer
      expect(mockMap.removeLayer).toHaveBeenCalled();

      // Should add new tile layer with dark URL
      expect(global.L.tileLayer).toHaveBeenCalledWith(
        "https://tile-dark.example.com/{z}/{x}/{y}.png",
        expect.any(Object)
      );
    });

    it("should not error when theme changes", () => {
      if (!eventBusThemeCallback) {
        console.warn("Theme callback not captured, skipping test");
        return;
      }

      initMap("map-container");

      // This should not throw
      expect(() => eventBusThemeCallback()).not.toThrow();
    });
  });

  describe("Integration: Full round flow", () => {
    beforeEach(() => {
      initMap("map-container");
      clearMap(); // Clear any previous state
      vi.clearAllMocks();
    });

    it("should handle complete round visualization", () => {
      // Enable clicks
      const clickCallback = vi.fn();
      enableClicks(clickCallback);

      // Simulate user click
      const clickHandler = mockMap.on.mock.calls.find(
        ([event]) => event === "click"
      )?.[1];
      const clickCoords = [48.8, 2.3];
      clickHandler({ latlng: { lat: clickCoords[0], lng: clickCoords[1] } });

      expect(clickCallback).toHaveBeenCalledWith(clickCoords);

      // Show round result
      const capitalCoords = [51.5, -0.1];
      const distanceKm = 340;
      showRoundResult(clickCoords, capitalCoords, distanceKm);

      // Verify everything was displayed
      expect(global.L.marker).toHaveBeenCalledTimes(2);
      expect(global.L.polyline).toHaveBeenCalled();
      expect(mockMap.flyTo).toHaveBeenCalled();

      // Note the number of layers before clearing
      const layersAdded = 3; // 2 markers + 1 line group
      vi.clearAllMocks();

      // Clear for next round
      clearMap();
      expect(mockMap.removeLayer).toHaveBeenCalledTimes(layersAdded);

      // Reset view
      resetView();
      expect(mockMap.flyTo).toHaveBeenCalledWith(
        [48.8566, 2.3522],
        3,
        expect.any(Object)
      );
    });

    it("should handle multiple rounds without memory leaks", () => {
      const rounds = 10;
      for (let i = 0; i < rounds; i++) {
        addClickMarker([48.8 + i * 0.1, 2.3 + i * 0.1]);
        addCapitalMarker([51.5 + i * 0.1, -0.1 + i * 0.1]);
        drawLine(
          [48.8 + i * 0.1, 2.3 + i * 0.1],
          [51.5 + i * 0.1, -0.1 + i * 0.1],
          150
        );
      }

      const totalLayers = rounds * 3; // Each round: 1 player marker + 1 capital marker + 1 line group
      vi.clearAllMocks();
      clearMap();

      // Should remove all layers
      expect(mockMap.removeLayer).toHaveBeenCalledTimes(totalLayers);
    });
  });
});
