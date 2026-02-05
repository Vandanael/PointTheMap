import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MapSystem, getMapSystem, mapSystem } from './MapSystem.js';
import { eventBus } from '../core/EventBus.js';
import { logger } from '../utils/logger.js';
import * as leaflet from 'leaflet';

// Mock utils module (isIOS detection)
vi.mock('../utils.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isIOS: vi.fn(() => false), // Default to non-iOS
  };
});

// Mock Leaflet module
const mockTileLayer = {
  addTo: vi.fn().mockReturnThis(),
  on: vi.fn(),
};

const mockLeafletMap = {
  setView: vi.fn().mockReturnThis(),
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn((event, cb) => {
    if (event === 'moveend') cb();
    return mockLeafletMap;
  }),
  addLayer: vi.fn(),
  removeLayer: vi.fn(),
  flyTo: vi.fn(),
  flyToBounds: vi.fn(),
  getCenter: vi.fn(() => ({ lat: 0, lng: 0 })),
  getZoom: vi.fn(() => 2),
  getContainer: vi.fn(() => ({
    hasAttribute: vi.fn(() => false),
    setAttribute: vi.fn(),
  })),
  invalidateSize: vi.fn(),
  remove: vi.fn(),
  doubleClickZoom: {
    disable: vi.fn(),
  },
  wrapLatLng: vi.fn((latlng) => ({
    lat: latlng.lat ?? latlng[0],
    lng: (() => {
      const lng = latlng.lng ?? latlng[1];
      if (!Number.isFinite(lng)) return 0;
      let n = lng;
      while (n > 180) n -= 360;
      while (n < -180) n += 360;
      return n;
    })(),
  })),
};

vi.mock('leaflet', () => {
  const mockMarker = vi.fn((coords, options) => ({
    addTo: vi.fn().mockReturnThis(),
  }));

  const mockPolyline = vi.fn((coords, options) => ({
    setLatLngs: vi.fn(),
  }));

  const mockLayerGroup = vi.fn((layers) => ({
    addTo: vi.fn().mockReturnThis(),
    addLayer: vi.fn().mockReturnThis(),
    clearLayers: vi.fn(),
  }));

  const mockLatLngBounds = vi.fn((coords) => ({
    extend: vi.fn().mockReturnThis(),
  }));

  const mockGeoJSON = vi.fn((data, options) => ({
    addTo: vi.fn().mockReturnThis(),
  }));

  const mockLatLng = vi.fn((latlng) => {
    const lat = Array.isArray(latlng) ? latlng[0] : latlng.lat;
    const lng = Array.isArray(latlng) ? latlng[1] : latlng.lng;
    return { lat, lng };
  });

  const mock = {
    map: vi.fn(() => mockLeafletMap),
    tileLayer: vi.fn(() => mockTileLayer),
    marker: mockMarker,
    polyline: mockPolyline,
    layerGroup: mockLayerGroup,
    latLngBounds: mockLatLngBounds,
    latLng: mockLatLng,
    geoJSON: mockGeoJSON,
    divIcon: vi.fn((options) => options),
    Browser: {
      mobile: false, // Default to desktop
    },
  };
  return { default: mock, ...mock };
});

// Get mocked functions for use in tests
const mockMarker = vi.mocked(leaflet.marker);
const mockPolyline = vi.mocked(leaflet.polyline);
const mockLayerGroup = vi.mocked(leaflet.layerGroup);
const mockLatLngBounds = vi.mocked(leaflet.latLngBounds);

// Import mocked isIOS function for tests
import * as utils from '../utils.js';
const mockIsIOS = vi.mocked(utils.isIOS);

describe('MapSystem', () => {
  let system;

  beforeEach(() => {
    // Mock DOM container
    if (typeof document === 'undefined') {
      global.document = {
        getElementById: vi.fn(() => ({})),
      };
    }

    // Reset mocks
    mockLeafletMap.on.mockClear();
    mockLeafletMap.off.mockClear();
    mockTileLayer.addTo.mockClear();
    mockTileLayer.on.mockClear();

    system = new MapSystem();
  });

  afterEach(async () => {
    if (system && system.isInitialized()) {
      system.destroy();
    }
  });

  describe('Initialization', () => {
    it('should initialize without errors', async () => {
      await expect(system.init('map')).resolves.not.toThrow();
    });

    it('should emit map:ready event on successful init', async () => {
      const handler = vi.fn();
      eventBus.subscribe('map:ready', handler);

      await system.init('map');

      expect(handler).toHaveBeenCalledWith({ containerId: 'map' });
    });

    it('should emit map:error event on init failure', async () => {
      const handler = vi.fn();
      eventBus.subscribe('map:error', handler);

      // Make Leaflet map fail
      vi.mocked(leaflet.map).mockImplementationOnce(() => {
        throw new Error('Init failed');
      });

      await expect(system.init('map')).rejects.toThrow();
      expect(handler).toHaveBeenCalled();
    });

    it('should warn if initialized multiple times', async () => {
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      await system.init('map');
      await system.init('map');

      expect(warnSpy).toHaveBeenCalledWith('MapSystem already initialized');

      warnSpy.mockRestore();
    });

    it('should disable double click zoom', async () => {
      await system.init('map');

      expect(mockLeafletMap.doubleClickZoom.disable).toHaveBeenCalled();
    });

    it('should set isInitialized to true', async () => {
      await system.init('map');

      expect(system.isInitialized()).toBe(true);
    });
  });

  describe('Click Handling', () => {
    beforeEach(async () => {
      await system.init('map');
      // Reset isIOS mock to default (false)
      mockIsIOS.mockReturnValue(false);
      // Reset L.Browser.mobile to default (false)
      leaflet.Browser.mobile = false;
    });

    it('should enable clicks with callback', () => {
      const callback = vi.fn();

      system.enableClicks(callback);

      expect(mockLeafletMap.on).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should enable clicks and tap events on mobile', () => {
      leaflet.Browser.mobile = true;
      const callback = vi.fn();

      system.enableClicks(callback);

      expect(mockLeafletMap.on).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockLeafletMap.on).toHaveBeenCalledWith('tap', expect.any(Function));
    });

    it('should enable clicks and tap events on iOS', () => {
      mockIsIOS.mockReturnValue(true);
      const callback = vi.fn();

      system.enableClicks(callback);

      expect(mockLeafletMap.on).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockLeafletMap.on).toHaveBeenCalledWith('tap', expect.any(Function));
    });

    it('should disable clicks', () => {
      const callback = vi.fn();

      system.enableClicks(callback);
      system.disableClicks();

      expect(mockLeafletMap.off).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should disable clicks and tap events on mobile', () => {
      leaflet.Browser.mobile = true;
      const callback = vi.fn();

      system.enableClicks(callback);
      mockLeafletMap.off.mockClear(); // Clear previous calls
      system.disableClicks();

      expect(mockLeafletMap.off).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockLeafletMap.off).toHaveBeenCalledWith('tap', expect.any(Function));
    });

    it('should disable clicks and tap events on iOS', () => {
      mockIsIOS.mockReturnValue(true);
      const callback = vi.fn();

      system.enableClicks(callback);
      mockLeafletMap.off.mockClear(); // Clear previous calls
      system.disableClicks();

      expect(mockLeafletMap.off).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockLeafletMap.off).toHaveBeenCalledWith('tap', expect.any(Function));
    });

    it('should emit map:click event on click', () => {
      const handler = vi.fn();
      eventBus.subscribe('map:click', handler);

      system.enableClicks(() => {});

      // Simulate click event
      const clickHandler = mockLeafletMap.on.mock.calls.find(
        (call) => call[0] === 'click'
      )?.[1];

      if (clickHandler) {
        clickHandler({ latlng: { lat: 48.8566, lng: 2.3522 } });
      }

      expect(handler).toHaveBeenCalledWith({ lat: 48.8566, lng: 2.3522 });
    });

    it('should call callback with coordinates', () => {
      const callback = vi.fn();

      system.enableClicks(callback);

      // Simulate click event
      const clickHandler = mockLeafletMap.on.mock.calls.find(
        (call) => call[0] === 'click'
      )?.[1];

      if (clickHandler) {
        clickHandler({ latlng: { lat: 48.8566, lng: 2.3522 } });
      }

      expect(callback).toHaveBeenCalledWith([48.8566, 2.3522]);
    });

    it('should remove old handler when enabling new clicks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      system.enableClicks(callback1);
      system.enableClicks(callback2);

      // Should have called off to remove old handler
      expect(mockLeafletMap.off).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should remove old tap handler on mobile when enabling new clicks', () => {
      leaflet.Browser.mobile = true;
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      system.enableClicks(callback1);
      mockLeafletMap.off.mockClear();
      system.enableClicks(callback2);

      // Should have called off to remove both old handlers
      expect(mockLeafletMap.off).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockLeafletMap.off).toHaveBeenCalledWith('tap', expect.any(Function));
    });

    it('should throw error if enabling clicks before init', () => {
      const uninitializedSystem = new MapSystem();

      expect(() => uninitializedSystem.enableClicks(() => {})).toThrow('not initialized');
    });
  });

  describe('Markers', () => {
    beforeEach(async () => {
      await system.init('map');
    });

    it('should add click marker', () => {
      system.addClickMarker([48.8566, 2.3522]);

      expect(mockMarker).toHaveBeenCalledWith(
        [48.8566, 2.3522],
        expect.any(Object)
      );
      expect(system.getMarkerCount()).toBe(1);
    });

    it('should add capital marker', () => {
      system.addCapitalMarker([48.8566, 2.3522]);

      expect(mockMarker).toHaveBeenCalledWith(
        [48.8566, 2.3522],
        expect.any(Object)
      );
      expect(system.getMarkerCount()).toBe(1);
    });

    it('should track multiple markers', () => {
      system.addClickMarker([48.8566, 2.3522]);
      system.addCapitalMarker([51.5074, -0.1278]);

      expect(system.getMarkerCount()).toBe(2);
    });

    it('should use different icons for click and capital markers', () => {
      system.addClickMarker([48.8566, 2.3522]);
      system.addCapitalMarker([51.5074, -0.1278]);

      const calls = mockMarker.mock.calls;
      const icon1 = calls[0][1].icon.html;
      const icon2 = calls[1][1].icon.html;

      expect(icon1).toContain('marker-player');
      expect(icon2).toContain('marker-target');
    });

    it('should add capital markers to capitals layer', async () => {
      await system.init('map');
      
      // Verify that layerGroup was called to create the capitals layer
      expect(mockLayerGroup).toHaveBeenCalled();
      
      // Track calls to marker.addTo
      const addToCalls = [];
      const originalAddTo = vi.fn().mockImplementation(function(layer) {
        addToCalls.push({ marker: this, layer });
        return this;
      });
      
      // Mock marker to track addTo calls
      mockMarker.mockImplementation((coords, options) => ({
        addTo: originalAddTo,
      }));
      
      system.addCapitalMarker([48.8566, 2.3522]);
      
      // Verify marker was created and added to a layerGroup
      expect(mockMarker).toHaveBeenCalled();
      expect(addToCalls.length).toBe(1);
      // Verify that addTo was called with a layerGroup instance (has clearLayers method)
      expect(addToCalls[0].layer).toHaveProperty('clearLayers');
      expect(typeof addToCalls[0].layer.clearLayers).toBe('function');
    });
  });

  describe('Lines', () => {
    beforeEach(async () => {
      await system.init('map');
    });

    it('should draw line between two points', () => {
      const from = [48.8566, 2.3522];
      const to = [51.5074, -0.1278];

      system.drawLine(from, to, 344);

      expect(mockPolyline).toHaveBeenCalled();
      expect(mockLayerGroup).toHaveBeenCalled();
      expect(system.getPolylineCount()).toBe(1);
    });

    it('should track multiple lines', () => {
      system.drawLine([48, 2], [51, 0], 344);
      system.drawLine([40, -3], [41, 2], 567);

      expect(system.getPolylineCount()).toBe(2);
    });

    it('should use normalized segment for antimeridian (shortest arc)', () => {
      const from = [0, 170];
      const to = [0, -170];
      system.drawLine(from, to, 222);
      expect(mockPolyline).toHaveBeenCalled();
      const coords = mockPolyline.mock.calls[mockPolyline.mock.calls.length - 1][0];
      expect(coords).toHaveLength(2);
      expect(coords[0]).toEqual(from);
      expect(coords[1][0]).toBe(0);
      expect(coords[1][1]).toBe(190);
    });
  });

  describe('Round Result', () => {
    beforeEach(async () => {
      await system.init('map');
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should show round result with markers and line', async () => {
      const clickCoords = [48.8566, 2.3522];
      const capitalCoords = [51.5074, -0.1278];

      const resultPromise = system.showRoundResult(clickCoords, capitalCoords, 344);
      await vi.advanceTimersByTimeAsync(2500);
      await resultPromise;

      expect(system.getMarkerCount()).toBe(2);
      expect(system.getPolylineCount()).toBe(1);
      expect(mockLeafletMap.flyToBounds).toHaveBeenCalled();
    });

    it('should emit map:result-shown event', async () => {
      const handler = vi.fn();
      eventBus.subscribe('map:result-shown', handler);

      const clickCoords = [48.8566, 2.3522];
      const capitalCoords = [51.5074, -0.1278];

      const resultPromise = system.showRoundResult(clickCoords, capitalCoords, 344);
      await vi.advanceTimersByTimeAsync(2500);
      await resultPromise;

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          clickCoords,
          capitalCoords,
          distanceKm: 344,
        })
      );
    });

    it('should use flyToBounds to show both markers', async () => {
      const clickCoords = [40, 10];
      const capitalCoords = [50, 20];

      const resultPromise = system.showRoundResult(clickCoords, capitalCoords, 100);
      await vi.advanceTimersByTimeAsync(2500);
      await resultPromise;

      // Should create bounds with both coordinates
      expect(mockLatLngBounds).toHaveBeenCalledWith([clickCoords, capitalCoords]);

      // Should use flyToBounds with options from visual-constants (MAP_ANIMATIONS.SHOW_RESULT + padding/maxZoom)
      expect(mockLeafletMap.flyToBounds).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          padding: [60, 60],
          maxZoom: 14,
          duration: 2.0,
          easeLinearity: 0.15,
          animate: true,
        })
      );
    });

    it('should skip dashed line and resolve immediately when skipResultLine is true', async () => {
      const handler = vi.fn();
      eventBus.subscribe('map:result-shown', handler);

      const clickCoords = [48.8566, 2.3522];
      const capitalCoords = [51.5074, -0.1278];

      const resultPromise = system.showRoundResult(clickCoords, capitalCoords, 344, { skipResultLine: true });
      await resultPromise;

      expect(system.getMarkerCount()).toBe(2);
      expect(system.getPolylineCount()).toBe(0);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          clickCoords,
          capitalCoords,
          distanceKm: 344,
        })
      );
    });

    it('should remove result line and cancel animation on clearMap', async () => {
      const resultPromise = system.showRoundResult([48, 2], [51, 0], 344);
      await vi.advanceTimersByTimeAsync(2500);
      await resultPromise;
      expect(system.getPolylineCount()).toBe(1);

      system.clearMap();

      expect(system.getPolylineCount()).toBe(0);
      expect(system.getMarkerCount()).toBe(0);
    });

    it('should clear result-continue listener when clearMap is called', async () => {
      const cb = vi.fn();
      system.setOnResultContinue(cb);
      system.clearMap();
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('Map Operations', () => {
    beforeEach(async () => {
      await system.init('map');
    });

    it('should clear all markers and polylines', () => {
      system.addClickMarker([48, 2]);
      system.addCapitalMarker([51, 0]);
      system.drawLine([48, 2], [51, 0], 344);

      system.clearMap();

      expect(system.getMarkerCount()).toBe(0);
      expect(system.getPolylineCount()).toBe(0);
    });

    it('should emit map:cleared event', () => {
      const handler = vi.fn();
      eventBus.subscribe('map:cleared', handler);

      system.clearMap();

      expect(handler).toHaveBeenCalled();
    });

    it('should clear only capital markers', async () => {
      const clickMarker = system.addClickMarker([48, 2]);
      const capitalMarker1 = system.addCapitalMarker([51, 0]);
      const capitalMarker2 = system.addCapitalMarker([52, 1]);

      expect(system.getMarkerCount()).toBe(3);

      // Get all layerGroup instances created (first one should be the capitals layer)
      const allLayerGroups = mockLayerGroup.mock.results.map(r => r.value);
      const capitalsLayerInstance = allLayerGroups[0]; // First call is for capitals layer
      
      // Reset clearLayers mock to track this specific call
      capitalsLayerInstance.clearLayers.mockClear();

      system.clearCapitals();

      // Verify clearLayers was called on the capitals layer
      // Check that clearLayers was called on at least one layerGroup instance
      const clearLayersCalled = allLayerGroups.some(layer => 
        layer.clearLayers.mock.calls.length > 0
      );
      expect(clearLayersCalled).toBe(true);

      // Capital markers should be removed from the markers array
      expect(system.getMarkerCount()).toBe(1); // Only click marker remains
    });

    it('should emit map:capitals-cleared event', () => {
      const handler = vi.fn();
      eventBus.subscribe('map:capitals-cleared', handler);

      system.addCapitalMarker([51, 0]);
      system.clearCapitals();

      expect(handler).toHaveBeenCalled();
    });

    it('should handle clearCapitals when no capitals are present', () => {
      expect(() => system.clearCapitals()).not.toThrow();
    });

    it('should reset view to default', () => {
      system.resetView();

      expect(mockLeafletMap.flyTo).toHaveBeenCalled();
    });

    it('should emit map:view-reset event', () => {
      const handler = vi.fn();
      eventBus.subscribe('map:view-reset', handler);

      system.resetView();

      expect(handler).toHaveBeenCalled();
    });

    it('should fly to specific coordinates', () => {
      system.flyTo([48.8566, 2.3522], 10);

      expect(mockLeafletMap.flyTo).toHaveBeenCalledWith(
        [48.8566, 2.3522],
        10,
        expect.any(Object)
      );
    });

    it('should get center coordinates', () => {
      const center = system.getCenter();

      expect(center).toEqual([0, 0]);
      expect(mockLeafletMap.getCenter).toHaveBeenCalled();
    });

    it('should get zoom level', () => {
      const zoom = system.getZoom();

      expect(zoom).toBe(2);
      expect(mockLeafletMap.getZoom).toHaveBeenCalled();
    });
  });

  describe('Theme Changes', () => {
    it('should update tiles on theme change', async () => {
      await system.init('map');

      // Clear previous calls
      vi.mocked(leaflet.tileLayer).mockClear();

      // Emit theme change event
      eventBus.emit('theme:changed');

      // Should have created new tile layer
      expect(leaflet.tileLayer).toHaveBeenCalled();
    });
  });

  describe('Destroy', () => {
    it('should clean up all resources', async () => {
      await system.init('map');
      system.addClickMarker([48, 2]);
      system.enableClicks(() => {});

      system.destroy();

      expect(system.isInitialized()).toBe(false);
      expect(system.getMarkerCount()).toBe(0);
      expect(mockLeafletMap.remove).toHaveBeenCalled();
    });

    it('should emit map:destroyed event', async () => {
      const handler = vi.fn();
      eventBus.subscribe('map:destroyed', handler);

      await system.init('map');
      system.destroy();

      expect(handler).toHaveBeenCalled();
    });

    it('should be safe to call destroy multiple times', async () => {
      await system.init('map');
      system.destroy();
      expect(() => system.destroy()).not.toThrow();
    });

    it('should unsubscribe from events', async () => {
      await system.init('map');

      // Get initial subscription count
      const initialCount = vi.mocked(leaflet.tileLayer).mock.calls.length;

      system.destroy();

      // Emit theme change - should not create new tile layer
      eventBus.emit('theme:changed');

      const finalCount = vi.mocked(leaflet.tileLayer).mock.calls.length;
      expect(finalCount).toBe(initialCount);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance with getMapSystem', () => {
      const instance1 = getMapSystem();
      const instance2 = getMapSystem();

      expect(instance1).toBe(instance2);
    });

    it('should export pre-initialized singleton', () => {
      expect(mapSystem).toBeInstanceOf(MapSystem);
    });
  });

  describe('Edge Cases', () => {
    it('should handle clearMap when no markers', async () => {
      await system.init('map');
      expect(() => system.clearMap()).not.toThrow();
    });

    it('should handle resetView when not initialized', () => {
      expect(() => system.resetView()).not.toThrow();
    });

    it('should handle disableClicks when no handler', async () => {
      await system.init('map');
      expect(() => system.disableClicks()).not.toThrow();
    });

    it('should return null for center when not initialized', () => {
      const uninitializedSystem = new MapSystem();
      expect(uninitializedSystem.getCenter()).toBeNull();
    });

    it('should return null for zoom when not initialized', () => {
      const uninitializedSystem = new MapSystem();
      expect(uninitializedSystem.getZoom()).toBeNull();
    });

    it('should handle clearCapitals when not initialized', () => {
      const uninitializedSystem = new MapSystem();
      expect(() => uninitializedSystem.clearCapitals()).not.toThrow();
    });
  });
});
