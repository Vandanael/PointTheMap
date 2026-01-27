import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MapSystem, getMapSystem, mapSystem } from './MapSystem.js';
import { eventBus } from '../core/EventBus.js';

describe('MapSystem', () => {
  let system;
  let mockLeafletMap;
  let mockTileLayer;

  beforeEach(() => {
    // Mock Leaflet
    mockTileLayer = {
      addTo: vi.fn().mockReturnThis(),
      on: vi.fn(),
    };

    mockLeafletMap = {
      setView: vi.fn().mockReturnThis(),
      on: vi.fn(),
      off: vi.fn(),
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      flyTo: vi.fn(),
      flyToBounds: vi.fn(),
      getCenter: vi.fn(() => ({ lat: 0, lng: 0 })),
      getZoom: vi.fn(() => 2),
      remove: vi.fn(),
      doubleClickZoom: {
        disable: vi.fn(),
      },
    };

    global.L = {
      map: vi.fn(() => mockLeafletMap),
      tileLayer: vi.fn(() => mockTileLayer),
      marker: vi.fn((coords, options) => ({
        addTo: vi.fn().mockReturnThis(),
      })),
      polyline: vi.fn((coords, options) => ({})),
      layerGroup: vi.fn((layers) => ({
        addTo: vi.fn().mockReturnThis(),
      })),
      latLngBounds: vi.fn((coords) => ({
        extend: vi.fn().mockReturnThis(),
      })),
      divIcon: vi.fn((options) => options),
    };

    // Mock DOM container
    if (typeof document === 'undefined') {
      global.document = {
        getElementById: vi.fn(() => ({})),
      };
    }

    system = new MapSystem();
  });

  afterEach(() => {
    if (system && system.isInitialized()) {
      system.destroy();
    }
    delete global.L;
  });

  describe('Initialization', () => {
    it('should initialize without errors', () => {
      expect(() => system.init('map')).not.toThrow();
    });

    it('should throw error if Leaflet is not loaded', () => {
      delete global.L;
      expect(() => system.init('map')).toThrow('Leaflet');
    });

    it('should emit map:ready event on successful init', () => {
      const handler = vi.fn();
      eventBus.subscribe('map:ready', handler);

      system.init('map');

      expect(handler).toHaveBeenCalledWith({ containerId: 'map' });
    });

    it('should emit map:error event on init failure', () => {
      const handler = vi.fn();
      eventBus.subscribe('map:error', handler);

      // Make Leaflet fail
      global.L.map = vi.fn(() => {
        throw new Error('Init failed');
      });

      expect(() => system.init('map')).toThrow();
      expect(handler).toHaveBeenCalled();
    });

    it('should warn if initialized multiple times', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      system.init('map');
      system.init('map');

      expect(warnSpy).toHaveBeenCalledWith('MapSystem already initialized');

      warnSpy.mockRestore();
    });

    it('should disable double click zoom', () => {
      system.init('map');

      expect(mockLeafletMap.doubleClickZoom.disable).toHaveBeenCalled();
    });

    it('should set isInitialized to true', () => {
      system.init('map');

      expect(system.isInitialized()).toBe(true);
    });
  });

  describe('Click Handling', () => {
    beforeEach(() => {
      system.init('map');
    });

    it('should enable clicks with callback', () => {
      const callback = vi.fn();

      system.enableClicks(callback);

      expect(mockLeafletMap.on).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should disable clicks', () => {
      const callback = vi.fn();

      system.enableClicks(callback);
      system.disableClicks();

      expect(mockLeafletMap.off).toHaveBeenCalledWith('click', expect.any(Function));
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
      expect(mockLeafletMap.off).toHaveBeenCalled();
    });

    it('should throw error if enabling clicks before init', () => {
      const uninitializedSystem = new MapSystem();

      expect(() => uninitializedSystem.enableClicks(() => {})).toThrow('not initialized');
    });
  });

  describe('Markers', () => {
    beforeEach(() => {
      system.init('map');
    });

    it('should add click marker', () => {
      system.addClickMarker([48.8566, 2.3522]);

      expect(global.L.marker).toHaveBeenCalledWith(
        [48.8566, 2.3522],
        expect.any(Object)
      );
      expect(system.getMarkerCount()).toBe(1);
    });

    it('should add capital marker', () => {
      system.addCapitalMarker([48.8566, 2.3522]);

      expect(global.L.marker).toHaveBeenCalledWith(
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

      const calls = global.L.marker.mock.calls;
      const icon1 = calls[0][1].icon.html;
      const icon2 = calls[1][1].icon.html;

      expect(icon1).toContain('marker-player');
      expect(icon2).toContain('marker-target');
    });
  });

  describe('Lines', () => {
    beforeEach(() => {
      system.init('map');
    });

    it('should draw line between two points', () => {
      const from = [48.8566, 2.3522];
      const to = [51.5074, -0.1278];

      system.drawLine(from, to, 344);

      expect(global.L.polyline).toHaveBeenCalled();
      expect(global.L.layerGroup).toHaveBeenCalled();
      expect(system.getPolylineCount()).toBe(1);
    });

    it('should track multiple lines', () => {
      system.drawLine([48, 2], [51, 0], 344);
      system.drawLine([40, -3], [41, 2], 567);

      expect(system.getPolylineCount()).toBe(2);
    });
  });

  describe('Round Result', () => {
    beforeEach(() => {
      system.init('map');
    });

    it('should show round result with markers and line', () => {
      const clickCoords = [48.8566, 2.3522];
      const capitalCoords = [51.5074, -0.1278];

      system.showRoundResult(clickCoords, capitalCoords, 344);

      expect(system.getMarkerCount()).toBe(2);
      expect(system.getPolylineCount()).toBe(1);
      expect(mockLeafletMap.flyToBounds).toHaveBeenCalled();
    });

    it('should emit map:result-shown event', () => {
      const handler = vi.fn();
      eventBus.subscribe('map:result-shown', handler);

      const clickCoords = [48.8566, 2.3522];
      const capitalCoords = [51.5074, -0.1278];

      system.showRoundResult(clickCoords, capitalCoords, 344);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          clickCoords,
          capitalCoords,
          distanceKm: 344,
        })
      );
    });

    it('should use flyToBounds to show both markers', () => {
      const clickCoords = [40, 10];
      const capitalCoords = [50, 20];

      system.showRoundResult(clickCoords, capitalCoords, 100);

      // Should create bounds with both coordinates
      expect(global.L.latLngBounds).toHaveBeenCalledWith([clickCoords, capitalCoords]);

      // Should use flyToBounds instead of flyTo
      expect(mockLeafletMap.flyToBounds).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          padding: [80, 80],
          maxZoom: 10,
        })
      );
    });
  });

  describe('Map Operations', () => {
    beforeEach(() => {
      system.init('map');
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
    it('should update tiles on theme change', () => {
      system.init('map');

      // Clear previous calls
      global.L.tileLayer.mockClear();

      // Emit theme change event
      eventBus.emit('theme:changed');

      // Should have created new tile layer
      expect(global.L.tileLayer).toHaveBeenCalled();
    });
  });

  describe('Destroy', () => {
    it('should clean up all resources', () => {
      system.init('map');
      system.addClickMarker([48, 2]);
      system.enableClicks(() => {});

      system.destroy();

      expect(system.isInitialized()).toBe(false);
      expect(system.getMarkerCount()).toBe(0);
      expect(mockLeafletMap.remove).toHaveBeenCalled();
    });

    it('should emit map:destroyed event', () => {
      const handler = vi.fn();
      eventBus.subscribe('map:destroyed', handler);

      system.init('map');
      system.destroy();

      expect(handler).toHaveBeenCalled();
    });

    it('should be safe to call destroy multiple times', () => {
      system.init('map');
      system.destroy();
      expect(() => system.destroy()).not.toThrow();
    });

    it('should unsubscribe from events', () => {
      system.init('map');

      // Get initial subscription count
      const initialCount = global.L.tileLayer.mock.calls.length;

      system.destroy();

      // Emit theme change - should not create new tile layer
      eventBus.emit('theme:changed');

      const finalCount = global.L.tileLayer.mock.calls.length;
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
    it('should handle clearMap when no markers', () => {
      system.init('map');
      expect(() => system.clearMap()).not.toThrow();
    });

    it('should handle resetView when not initialized', () => {
      expect(() => system.resetView()).not.toThrow();
    });

    it('should handle disableClicks when no handler', () => {
      system.init('map');
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
  });
});
