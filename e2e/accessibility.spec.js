import { test, expect } from '@playwright/test';
import { seedWithReader, seedLocalStorage, mockLLMApis } from './helpers/appHelpers.js';
import { readerResponse, wrapAnthropicResponse } from './fixtures/mockApiResponses.js';

test.describe('Accessibility — keyboard navigation & ARIA', () => {
  // These tests rely on keyboard navigation; skip on mobile
  test.skip(({ isMobile }) => isMobile, 'Keyboard tests — desktop only');

  test('vocab popover traps focus and closes on Escape', async ({ page }) => {
    await seedWithReader(page);
    await page.goto('/');

    // Wait for reader content to render
    await expect(page.locator('.reader-view__sentence')).toHaveCount(2, { timeout: 10000 }).catch(() => {});
    await expect(page.locator('body')).toContainText('小吃', { timeout: 10000 });

    // Click a vocab button to open popover
    const vocabBtn = page.locator('button[class*="vocab"]').first();
    await vocabBtn.click();

    const popover = page.locator('.reader-view__popover[role="dialog"]').first();
    await expect(popover).toBeVisible({ timeout: 3000 });

    // Tab a few times — focus should stay inside popover
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }
    const focusInsidePopover = await page.evaluate(() => {
      const popoverEl = document.querySelector('.reader-view__popover[role="dialog"]');
      return popoverEl?.contains(document.activeElement) ?? false;
    });
    expect(focusInsidePopover).toBe(true);

    // Escape closes popover
    await page.keyboard.press('Escape');
    await expect(popover).not.toBeVisible({ timeout: 2000 });
  });

  test('sentence spans activate via Enter and Space keys', async ({ page }) => {
    await seedWithReader(page);
    await page.goto('/');
    await expect(page.locator('body')).toContainText('小吃', { timeout: 10000 });

    const sentence = page.locator('.reader-view__sentence[role="button"]').first();
    await expect(sentence).toBeVisible({ timeout: 5000 });
    await sentence.focus();

    // Enter key opens sentence popover
    await page.keyboard.press('Enter');
    const popover = page.locator('.reader-view__popover[role="dialog"]').first();
    await expect(popover).toBeVisible({ timeout: 3000 });

    // Escape closes it
    await page.keyboard.press('Escape');
    await expect(popover).not.toBeVisible({ timeout: 2000 });

    // Space key also opens popover
    await sentence.focus();
    await page.keyboard.press('Space');
    await expect(popover).toBeVisible({ timeout: 3000 });
  });

  test('settings tab arrow key navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-sidebar');

    // Open settings — button text includes icon
    const settingsBtn = page.locator('button:has-text("Settings")').first();
    await settingsBtn.click();

    const firstTab = page.locator('[role="tab"]').first();
    await expect(firstTab).toBeVisible({ timeout: 3000 });

    // Click first tab to ensure it has focus
    await firstTab.click();
    const firstTabName = await firstTab.textContent();

    // ArrowRight moves to next tab
    await page.keyboard.press('ArrowRight');
    const selectedAfterRight = page.locator('[role="tab"][aria-selected="true"]');
    const secondTabName = await selectedAfterRight.textContent();
    expect(secondTabName).not.toBe(firstTabName);

    // ArrowLeft moves back
    await page.keyboard.press('ArrowLeft');
    const selectedAfterLeft = page.locator('[role="tab"][aria-selected="true"]');
    await expect(selectedAfterLeft).toHaveText(firstTabName);
  });

  test('TopicForm level pills arrow key navigation', async ({ page }) => {
    await seedLocalStorage(page);
    await page.goto('/');
    await page.waitForSelector('.app-sidebar');

    // Show the new reader form
    const newBtn = page.locator('button:has-text("New")').first();
    await newBtn.click();
    await page.waitForSelector('.modal-overlay');

    // Find the proficiency level radiogroup (has "Level" in aria-label)
    const levelGroup = page.locator('[role="radiogroup"][aria-label*="Level"]');
    await expect(levelGroup).toBeVisible({ timeout: 3000 });

    // Click the currently checked pill to give it focus
    const activePill = levelGroup.locator('[role="radio"][aria-checked="true"]');
    await activePill.click();
    const originalLabel = await activePill.textContent();

    // ArrowRight moves to next pill
    await page.keyboard.press('ArrowRight');
    const newActive = levelGroup.locator('[role="radio"][aria-checked="true"]');
    const newLabel = await newActive.textContent();
    expect(newLabel).not.toBe(originalLabel);
  });

  test('GenerationProgress has progressbar role', async ({ page }) => {
    await seedLocalStorage(page);
    // Use a delayed mock so the progressbar stays visible long enough to assert
    const delayedResponse = JSON.stringify(wrapAnthropicResponse(readerResponse));
    await page.route('**/api.anthropic.com/**', async (route) => {
      await new Promise(r => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: delayedResponse,
      });
    });
    await page.goto('/');
    await page.waitForSelector('.app-sidebar');

    // Show form
    const newBtn = page.locator('button:has-text("New")').first();
    await newBtn.click();
    await page.waitForSelector('.modal-overlay');

    // Switch to Single Reader mode
    const singleReaderBtn = page.locator('button:has-text("Single Reader")');
    await singleReaderBtn.click();

    // Fill topic using the form input (not the search box)
    const topicInput = page.locator('#topic-input');
    await expect(topicInput).toBeVisible({ timeout: 3000 });
    await topicInput.fill('Test topic');

    const generateBtn = page.locator('button.topic-form__submit').first();
    await generateBtn.click();

    // Progress bar should appear during generation
    const progressbar = page.locator('[role="progressbar"]');
    await expect(progressbar).toBeVisible({ timeout: 5000 });
    await expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    await expect(progressbar).toHaveAttribute('aria-valuemax', '100');

    // aria-valuenow should be a numeric string
    const valueNow = await progressbar.getAttribute('aria-valuenow');
    expect(Number(valueNow)).toBeGreaterThanOrEqual(0);
  });
});
