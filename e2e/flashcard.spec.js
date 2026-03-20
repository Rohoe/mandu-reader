import { test, expect } from '@playwright/test';

test.describe('Flashcard Review', () => {
  test('opens flashcard modal from sidebar', async ({ page, isMobile }) => {
    // Pre-seed some vocabulary for flashcards
    await page.addInitScript(() => {
      const vocab = {
        '猫': { pinyin: 'māo', english: 'cat', langId: 'zh', dateAdded: new Date().toISOString(), interval: 0, ease: 2.5, nextReview: null, reviewCount: 0, lapses: 0 },
        '狗': { pinyin: 'gǒu', english: 'dog', langId: 'zh', dateAdded: new Date().toISOString(), interval: 0, ease: 2.5, nextReview: null, reviewCount: 0, lapses: 0 },
      };
      localStorage.setItem('gradedReader_learnedVocabulary', JSON.stringify(vocab));
    });

    await page.goto('/');
    await page.waitForSelector('.app-sidebar');

    // On mobile, open sidebar first
    if (isMobile) {
      const hamburger = page.locator('button[class*="hamburger"], button[aria-label*="menu"], .mobile-header button').first();
      if (await hamburger.isVisible()) await hamburger.click();
      await page.waitForSelector('.app-sidebar--open');
    }

    // Click Cards button in sidebar
    const cardsBtn = page.locator('button:has-text("Cards")').first();
    if (await cardsBtn.isVisible()) {
      await cardsBtn.click();
      // Flashcard modal should show with mode picker
      await expect(page.locator('[class*="flashcard"], [class*="modal"]').first()).toBeVisible({ timeout: 3000 });
      // Mode picker should be visible
      await expect(page.locator('.flashcard-mode-picker')).toBeVisible({ timeout: 3000 });
    }
  });

  test('shows front of flashcard with target word', async ({ page, isMobile }) => {
    await page.addInitScript(() => {
      const vocab = {
        '猫': { pinyin: 'māo', english: 'cat', langId: 'zh', dateAdded: new Date().toISOString(), interval: 0, ease: 2.5, nextReview: null, reviewCount: 0, lapses: 0 },
      };
      localStorage.setItem('gradedReader_learnedVocabulary', JSON.stringify(vocab));
    });

    await page.goto('/');
    await page.waitForSelector('.app-sidebar');

    // On mobile, open sidebar first
    if (isMobile) {
      const hamburger = page.locator('button[class*="hamburger"], button[aria-label*="menu"], .mobile-header button').first();
      if (await hamburger.isVisible()) await hamburger.click();
      await page.waitForSelector('.app-sidebar--open');
    }

    const cardsBtn = page.locator('button:has-text("Cards")').first();
    if (!await cardsBtn.isVisible()) return;

    await cardsBtn.click();
    await page.waitForSelector('[class*="flashcard"], [class*="modal"]');

    // Select SRS Review mode from the mode picker
    const srsBtn = page.locator('.flashcard-mode-card').first();
    await srsBtn.click();

    // Should show a word in large script
    await expect(page.locator('body')).toContainText('猫', { timeout: 3000 });
  });
});
