import { describe, it, expect, beforeEach } from "vitest";
import { StorageManager } from "./StorageManager.js";
import { migrations } from "./migrations.js";

describe("Storage Migrations", () => {
  let storageManager;

  beforeEach(() => {
    localStorage.clear();
    storageManager = new StorageManager();
  });

  describe("Migration v1: Add timestamps", () => {
    it("should exist and be properly structured", () => {
      const migration = migrations.find((m) => m.version === 1);

      expect(migration).toBeDefined();
      expect(migration.version).toBe(1);
      expect(migration.name).toBeDefined();
      expect(typeof migration.up).toBe("function");
      expect(typeof migration.down).toBe("function");
    });

    it("should add lastAccess timestamp to objects without timestamps", () => {
      // Add data without timestamp
      storageManager.set("user", { name: "John", score: 100 });

      // Get migration
      const migration = migrations.find((m) => m.version === 1);

      // Run migration
      migration.up(storageManager);

      // Check that timestamp was added
      const user = storageManager.get("user");
      expect(user).toHaveProperty("lastAccess");
      expect(typeof user.lastAccess).toBe("number");
      expect(user.lastAccess).toBeGreaterThan(0);
    });

    it("should not override existing timestamps", () => {
      const existingTimestamp = 1234567890;

      // Add data with timestamp
      storageManager.set("item1", { value: "test", addedAt: existingTimestamp });
      storageManager.set("item2", { value: "test", timestamp: existingTimestamp });
      storageManager.set("item3", { value: "test", lastAccess: existingTimestamp });

      // Get migration
      const migration = migrations.find((m) => m.version === 1);

      // Run migration
      migration.up(storageManager);

      // Check timestamps were not changed
      expect(storageManager.get("item1").addedAt).toBe(existingTimestamp);
      expect(storageManager.get("item2").timestamp).toBe(existingTimestamp);
      expect(storageManager.get("item3").lastAccess).toBe(existingTimestamp);

      // And no new timestamp was added
      expect(storageManager.get("item1").lastAccess).toBeUndefined();
      expect(storageManager.get("item2").lastAccess).toBeUndefined();
    });

    it("should handle multiple items", () => {
      // Add multiple items without timestamps
      storageManager.set("item1", { value: "a" });
      storageManager.set("item2", { value: "b" });
      storageManager.set("item3", { value: "c" });

      // Run migration
      const migration = migrations.find((m) => m.version === 1);
      migration.up(storageManager);

      // All should have timestamps
      expect(storageManager.get("item1")).toHaveProperty("lastAccess");
      expect(storageManager.get("item2")).toHaveProperty("lastAccess");
      expect(storageManager.get("item3")).toHaveProperty("lastAccess");
    });

    it("should handle non-object values gracefully", () => {
      // Add non-object values
      storageManager.set("string", "text");
      storageManager.set("number", 42);
      storageManager.set("boolean", true);

      // Run migration (should not throw)
      const migration = migrations.find((m) => m.version === 1);
      expect(() => {
        migration.up(storageManager);
      }).not.toThrow();

      // Values should remain unchanged
      expect(storageManager.get("string")).toBe("text");
      expect(storageManager.get("number")).toBe(42);
      expect(storageManager.get("boolean")).toBe(true);
    });

    it("should rollback correctly", () => {
      // Add data
      storageManager.set("item", { value: "test" });

      // Run migration
      const migration = migrations.find((m) => m.version === 1);
      migration.up(storageManager);

      // Verify timestamp was added
      expect(storageManager.get("item")).toHaveProperty("lastAccess");

      // Rollback
      migration.down(storageManager);

      // Timestamp should be removed
      const item = storageManager.get("item");
      expect(item).not.toHaveProperty("lastAccess");
      expect(item.value).toBe("test");
    });

    it("should not affect items that already have other timestamps during rollback", () => {
      const timestamp = 1234567890;

      // Add item with addedAt
      storageManager.set("item", { value: "test", addedAt: timestamp });

      // Run migration (should not add lastAccess because addedAt exists)
      const migration = migrations.find((m) => m.version === 1);
      migration.up(storageManager);

      // Rollback
      migration.down(storageManager);

      // addedAt should still exist
      const item = storageManager.get("item");
      expect(item.addedAt).toBe(timestamp);
    });
  });

  describe("Migrations array", () => {
    it("should be an array", () => {
      expect(Array.isArray(migrations)).toBe(true);
    });

    it("should have at least one migration", () => {
      expect(migrations.length).toBeGreaterThan(0);
    });

    it("should have migrations in ascending order", () => {
      for (let i = 1; i < migrations.length; i++) {
        expect(migrations[i].version).toBeGreaterThan(migrations[i - 1].version);
      }
    });

    it("should have unique version numbers", () => {
      const versions = migrations.map((m) => m.version);
      const uniqueVersions = new Set(versions);
      expect(uniqueVersions.size).toBe(versions.length);
    });

    it("all migrations should have required fields", () => {
      for (const migration of migrations) {
        expect(migration).toHaveProperty("version");
        expect(migration).toHaveProperty("name");
        expect(migration).toHaveProperty("up");

        expect(typeof migration.version).toBe("number");
        expect(typeof migration.name).toBe("string");
        expect(typeof migration.up).toBe("function");
      }
    });
  });

  describe("Migration integration", () => {
    it("should run migrations automatically on version upgrade", () => {
      // Simulate old version data
      localStorage.clear();
      localStorage.setItem("ptm_storage_version", "0");
      localStorage.setItem("ptm_oldItem", JSON.stringify({ value: "test" }));

      // Create new storage manager (should trigger migration)
      const manager = new StorageManager();

      // Check that migration was run
      const item = manager.get("oldItem");
      expect(item).toHaveProperty("lastAccess");
    });

    it("should run multiple migrations in order", () => {
      // Start with version 0
      localStorage.clear();
      localStorage.setItem("ptm_storage_version", "0");
      localStorage.setItem("ptm_item", JSON.stringify({ value: "test" }));

      // Create manager (should run all migrations from v0 to current)
      const manager = new StorageManager();

      // Version should be updated
      const version = localStorage.getItem("ptm_storage_version");
      expect(parseInt(version, 10)).toBeGreaterThanOrEqual(1);
    });

    it("should not run migrations if already at current version", () => {
      // Set current version
      const currentVersion = 1;
      localStorage.clear();
      localStorage.setItem("ptm_storage_version", currentVersion.toString());
      localStorage.setItem("ptm_item", JSON.stringify({ value: "test" }));

      // Create manager
      const manager = new StorageManager();

      // Item should remain unchanged (no migration needed)
      const item = manager.get("item");
      expect(item).toEqual({ value: "test" });
    });

    it("should handle downgrade scenario gracefully", () => {
      // Set future version
      localStorage.clear();
      localStorage.setItem("ptm_storage_version", "999");

      // Create manager (should not crash)
      expect(() => {
        new StorageManager();
      }).not.toThrow();

      // Version should remain at 999 (no migrations run)
      const version = localStorage.getItem("ptm_storage_version");
      expect(version).toBe("999");
    });
  });

  describe("Migration error handling", () => {
    it("should handle corrupted data gracefully", () => {
      // Add corrupted JSON
      localStorage.setItem("ptm_corrupted", "{invalid json}");
      localStorage.setItem("ptm_storage_version", "0");

      // Should not throw when running migration
      expect(() => {
        new StorageManager();
      }).not.toThrow();
    });

    it("should continue with other items if one fails", () => {
      localStorage.setItem("ptm_storage_version", "0");
      localStorage.setItem("ptm_corrupted", "{invalid}");
      localStorage.setItem("ptm_valid", JSON.stringify({ value: "test" }));

      const manager = new StorageManager();

      // Valid item should have been migrated
      const valid = manager.get("valid");
      expect(valid).toHaveProperty("lastAccess");
    });
  });
});
