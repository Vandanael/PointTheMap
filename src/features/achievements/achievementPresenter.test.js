import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAchievementPresenter } from './achievementPresenter.js';

describe('achievementPresenter', () => {
  let mockUI;
  let mockI18n;
  let mockShare;
  let presenter;

  beforeEach(() => {
    // Clear any existing modals
    document.body.innerHTML = '';

    mockUI = {
      showToast: vi.fn(),
    };

    mockI18n = {
      t: vi.fn((key) => key),
    };

    mockShare = {
      shareGameResults: vi.fn().mockResolvedValue(true),
    };

    presenter = createAchievementPresenter({
      ui: mockUI,
      i18n: mockI18n,
      share: mockShare,
    });
  });

  afterEach(() => {
    presenter.cleanup();
    document.body.innerHTML = '';
  });

  const waitForAchievementModal = async (id) => {
    await vi.waitFor(
      () => {
        const modal = document.getElementById('achievement-modal');
        expect(modal).toBeTruthy();
        expect(modal?.textContent).toContain(id);
      },
      { timeout: 3000 }
    );
  };

  describe('Achievement queue', () => {
    it('should show achievements sequentially without stacking', async () => {
      const achievement1 = {
        id: 'ach1',
        achievement: {
          id: 'ach1',
          icon: '🎯',
          labelKey: 'achievement.ach1.label',
          descKey: 'achievement.ach1.desc',
        },
      };

      const achievement2 = {
        id: 'ach2',
        achievement: {
          id: 'ach2',
          icon: '🏆',
          labelKey: 'achievement.ach2.label',
          descKey: 'achievement.ach2.desc',
        },
      };

      // Enqueue two achievements
      presenter.enqueue(achievement1);
      presenter.enqueue(achievement2);

      await waitForAchievementModal('ach1');

      // Close first modal
      const closeBtn = document.getElementById('btn-close-achievement');
      closeBtn?.click();

      await waitForAchievementModal('ach2');
    });

    it('should cleanup handlers between modals', async () => {
      const achievement1 = {
        id: 'ach1',
        achievement: {
          id: 'ach1',
          icon: '🎯',
          labelKey: 'achievement.ach1.label',
          descKey: 'achievement.ach1.desc',
        },
      };

      presenter.enqueue(achievement1);

      await waitForAchievementModal('ach1');

      const closeBtn = document.getElementById('btn-close-achievement');
      expect(closeBtn).toBeTruthy();

      // Close and wait for next
      closeBtn?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Enqueue another achievement
      const achievement2 = {
        id: 'ach2',
        achievement: {
          id: 'ach2',
          icon: '🏆',
          labelKey: 'achievement.ach2.label',
          descKey: 'achievement.ach2.desc',
        },
      };

      presenter.enqueue(achievement2);
      await waitForAchievementModal('ach2');
    });

    it('should handle share button click', async () => {
      const achievement = {
        id: 'ach1',
        achievement: {
          id: 'ach1',
          icon: '🎯',
          labelKey: 'achievement.ach1.label',
          descKey: 'achievement.ach1.desc',
        },
      };

      presenter.enqueue(achievement);
      await waitForAchievementModal('ach1');

      const shareBtn = document.getElementById('btn-share-achievement-ach1');
      expect(shareBtn).toBeTruthy();

      // Click share button
      shareBtn?.click();

      await vi.waitFor(() => {
        expect(mockShare.shareGameResults).toHaveBeenCalled();
        expect(mockUI.showToast).toHaveBeenCalledWith('shareCopied', 'success', 3000, {
          compact: true,
        });
      });
    });

    it('should cleanup on cleanup() call', async () => {
      const achievement = {
        id: 'ach1',
        achievement: {
          id: 'ach1',
          icon: '🎯',
          labelKey: 'achievement.ach1.label',
          descKey: 'achievement.ach1.desc',
        },
      };

      presenter.enqueue(achievement);
      await waitForAchievementModal('ach1');

      presenter.cleanup();

      expect(document.getElementById('achievement-modal')).toBeNull();
    });
  });
});
