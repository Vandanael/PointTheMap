import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { IndexedDBQueue } from "./IndexedDBQueue.js";
import "fake-indexeddb/auto";

describe("IndexedDBQueue", () => {
  let queue;

  beforeEach(async () => {
    // Create new queue instance
    queue = new IndexedDBQueue();

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    // Clean up
    if (queue) {
      await queue.clear();
      queue.close();
    }
  });

  describe("Initialization", () => {
    it("should initialize successfully", async () => {
      expect(queue).toBeDefined();
    });

    it("should handle multiple instances", async () => {
      const queue2 = new IndexedDBQueue();
      expect(queue2).toBeDefined();
      queue2.close();
    });
  });

  describe("Add operations", () => {
    it("should add entry to queue", async () => {
      const id = await queue.add("token123", [{ round: 1 }], "player1", "classic");

      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
    });

    it("should add multiple entries", async () => {
      const id1 = await queue.add("token1", [{ round: 1 }], "player1", "classic");
      const id2 = await queue.add("token2", [{ round: 2 }], "player2", "daily");

      expect(id1).not.toBe(id2);

      const entries = await queue.getAll();
      expect(entries).toHaveLength(2);
    });

    it("should generate unique IDs", async () => {
      const ids = new Set();

      for (let i = 0; i < 10; i++) {
        const id = await queue.add(`token${i}`, [{ round: i }], `player${i}`, "classic");
        ids.add(id);
      }

      expect(ids.size).toBe(10);
    });

    it("should store all entry fields", async () => {
      const token = "mytoken";
      const rounds = [{ round: 1, score: 100 }];
      const pseudo = "testplayer";
      const gameType = "daily";

      const id = await queue.add(token, rounds, pseudo, gameType);
      const entry = await queue.get(id);

      expect(entry.token).toBe(token);
      expect(entry.rounds).toEqual(rounds);
      expect(entry.pseudo).toBe(pseudo);
      expect(entry.gameType).toBe(gameType);
      expect(entry.attempts).toBe(0);
      expect(entry.addedAt).toBeGreaterThan(0);
    });
  });

  describe("Get operations", () => {
    it("should get entry by ID", async () => {
      const id = await queue.add("token123", [{ round: 1 }], "player1", "classic");
      const entry = await queue.get(id);

      expect(entry).toBeDefined();
      expect(entry.id).toBe(id);
      expect(entry.token).toBe("token123");
    });

    it("should return null for non-existent ID", async () => {
      const entry = await queue.get("nonexistent");
      expect(entry).toBeNull();
    });

    it("should get all entries", async () => {
      await queue.add("token1", [{ round: 1 }], "player1", "classic");
      await queue.add("token2", [{ round: 2 }], "player2", "classic");
      await queue.add("token3", [{ round: 3 }], "player3", "daily");

      const entries = await queue.getAll();

      expect(entries).toHaveLength(3);

      // Check that all tokens are present (order not guaranteed)
      const tokens = entries.map((e) => e.token);
      expect(tokens).toContain("token1");
      expect(tokens).toContain("token2");
      expect(tokens).toContain("token3");
    });

    it("should return empty array when queue is empty", async () => {
      const entries = await queue.getAll();
      expect(entries).toEqual([]);
    });
  });

  describe("Update operations", () => {
    it("should update entry", async () => {
      const id = await queue.add("token123", [{ round: 1 }], "player1", "classic");

      const success = await queue.update(id, {
        attempts: 5,
        pseudo: "updatedplayer",
      });

      expect(success).toBe(true);

      const entry = await queue.get(id);
      expect(entry.attempts).toBe(5);
      expect(entry.pseudo).toBe("updatedplayer");
      expect(entry.token).toBe("token123"); // Unchanged field
    });

    it("should return false for non-existent entry", async () => {
      const success = await queue.update("nonexistent", { attempts: 5 });
      expect(success).toBe(false);
    });

    it("should increment attempts", async () => {
      const id = await queue.add("token123", [{ round: 1 }], "player1", "classic");

      const newAttempts = await queue.incrementAttempts(id);
      expect(newAttempts).toBe(1);

      const entry = await queue.get(id);
      expect(entry.attempts).toBe(1);
    });

    it("should increment attempts multiple times", async () => {
      const id = await queue.add("token123", [{ round: 1 }], "player1", "classic");

      await queue.incrementAttempts(id);
      await queue.incrementAttempts(id);
      const newAttempts = await queue.incrementAttempts(id);

      expect(newAttempts).toBe(3);
    });
  });

  describe("Remove operations", () => {
    it("should remove entry by ID", async () => {
      const id = await queue.add("token123", [{ round: 1 }], "player1", "classic");

      const success = await queue.remove(id);
      expect(success).toBe(true);

      const entry = await queue.get(id);
      expect(entry).toBeNull();
    });

    it("should handle removing non-existent entry", async () => {
      const success = await queue.remove("nonexistent");
      expect(success).toBe(true); // IndexedDB delete succeeds even if key doesn't exist
    });

    it("should remove specific entry without affecting others", async () => {
      const id1 = await queue.add("token1", [{ round: 1 }], "player1", "classic");
      const id2 = await queue.add("token2", [{ round: 2 }], "player2", "classic");
      const id3 = await queue.add("token3", [{ round: 3 }], "player3", "classic");

      await queue.remove(id2);

      const entries = await queue.getAll();
      expect(entries).toHaveLength(2);
      expect(entries.find((e) => e.id === id1)).toBeDefined();
      expect(entries.find((e) => e.id === id2)).toBeUndefined();
      expect(entries.find((e) => e.id === id3)).toBeDefined();
    });

    it("should clear all entries", async () => {
      await queue.add("token1", [{ round: 1 }], "player1", "classic");
      await queue.add("token2", [{ round: 2 }], "player2", "classic");
      await queue.add("token3", [{ round: 3 }], "player3", "classic");

      const success = await queue.clear();
      expect(success).toBe(true);

      const entries = await queue.getAll();
      expect(entries).toEqual([]);
    });
  });

  describe("Count operations", () => {
    it("should count entries", async () => {
      await queue.add("token1", [{ round: 1 }], "player1", "classic");
      await queue.add("token2", [{ round: 2 }], "player2", "classic");

      const count = await queue.count();
      expect(count).toBe(2);
    });

    it("should return 0 for empty queue", async () => {
      const count = await queue.count();
      expect(count).toBe(0);
    });

    it("should update count after operations", async () => {
      const id = await queue.add("token1", [{ round: 1 }], "player1", "classic");
      expect(await queue.count()).toBe(1);

      await queue.remove(id);
      expect(await queue.count()).toBe(0);
    });
  });

  describe("Get oldest entries", () => {
    it("should get oldest entries first", async () => {
      // Add entries with small delays to ensure different timestamps
      const id1 = await queue.add("token1", [{ round: 1 }], "player1", "classic");
      await new Promise((resolve) => setTimeout(resolve, 10));

      const id2 = await queue.add("token2", [{ round: 2 }], "player2", "classic");
      await new Promise((resolve) => setTimeout(resolve, 10));

      const id3 = await queue.add("token3", [{ round: 3 }], "player3", "classic");

      const oldest = await queue.getOldest(2);

      expect(oldest).toHaveLength(2);
      expect(oldest[0].id).toBe(id1);
      expect(oldest[1].id).toBe(id2);
    });

    it("should respect limit parameter", async () => {
      await queue.add("token1", [{ round: 1 }], "player1", "classic");
      await queue.add("token2", [{ round: 2 }], "player2", "classic");
      await queue.add("token3", [{ round: 3 }], "player3", "classic");
      await queue.add("token4", [{ round: 4 }], "player4", "classic");

      const oldest = await queue.getOldest(2);
      expect(oldest).toHaveLength(2);
    });

    it("should return all entries if limit is larger than queue size", async () => {
      await queue.add("token1", [{ round: 1 }], "player1", "classic");
      await queue.add("token2", [{ round: 2 }], "player2", "classic");

      const oldest = await queue.getOldest(10);
      expect(oldest).toHaveLength(2);
    });
  });

  describe("Large volume support", () => {
    it("should handle 100+ entries", async () => {
      const count = 100;

      for (let i = 0; i < count; i++) {
        await queue.add(`token${i}`, [{ round: i }], `player${i}`, "classic");
      }

      const total = await queue.count();
      expect(total).toBe(count);

      const entries = await queue.getAll();
      expect(entries).toHaveLength(count);
    }, 10000); // Increase timeout for large volume test

    it("should handle complex data structures", async () => {
      const complexRounds = [
        { round: 1, score: 100, distance: 50.5, time: 5000, accuracy: 0.95 },
        { round: 2, score: 200, distance: 25.2, time: 4000, accuracy: 0.98 },
        { round: 3, score: 150, distance: 75.8, time: 6000, accuracy: 0.85 },
      ];

      const id = await queue.add("token123", complexRounds, "player1", "classic");
      const entry = await queue.get(id);

      expect(entry.rounds).toEqual(complexRounds);
    });
  });

  describe("Error handling", () => {
    it("should handle concurrent operations", async () => {
      // Add multiple entries concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(queue.add(`token${i}`, [{ round: i }], `player${i}`, "classic"));
      }

      const ids = await Promise.all(promises);
      expect(ids).toHaveLength(10);

      const count = await queue.count();
      expect(count).toBe(10);
    });

    it("should handle add/remove race conditions", async () => {
      const id = await queue.add("token1", [{ round: 1 }], "player1", "classic");

      // Try to update and remove concurrently
      const updatePromise = queue.update(id, { attempts: 5 });
      const removePromise = queue.remove(id);

      await Promise.all([updatePromise, removePromise]);

      // Entry should be removed
      const entry = await queue.get(id);
      expect(entry).toBeNull();
    });
  });

  describe("Close operations", () => {
    it("should close database connection", () => {
      expect(() => {
        queue.close();
      }).not.toThrow();
    });

    it("should handle multiple close calls", () => {
      queue.close();
      expect(() => {
        queue.close();
      }).not.toThrow();
    });
  });
});
