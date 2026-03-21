import { test, expect } from '@playwright/test';

test.describe('Demo Reader', () => {
  test('loads demo reader for new users', async ({ page }) => {
    await page.goto('/');
    // Wait for the demo reader content to appear
    await expect(page.locator('body')).toContainText('小猫找朋友', { timeout: 10000 });
  });

  test('shows "(sample)" label for demo reader', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toContainText('(sample)', { timeout: 10000 });
  });

  test('story content is visible', async ({ page }) => {
    await page.goto('/');
    // Wait for story to render
    await expect(page.locator('body')).toContainText('小猫', { timeout: 10000 });
  });

  test('vocab words are clickable in story', async ({ page }) => {
    await page.goto('/');
    // Wait for the app to load
    await page.waitForSelector('.app-sidebar');

    // Find a vocab button in the story (class is reader-view__vocab-btn)
    const vocabBtn = page.locator('.reader-view__vocab-btn').first();
    await expect(vocabBtn).toBeVisible({ timeout: 10000 });
    await vocabBtn.click();
    // Should show a popover with definition
    await expect(page.locator('.reader-view__popover').first()).toBeVisible({ timeout: 3000 });
  });

  test('English demo reader visible in sidebar with "(sample)" label', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.app-sidebar');
    // Both demo readers should show (sample) labels in the sidebar
    const sampleLabels = page.locator('.app-sidebar >> text=(sample)');
    await expect(sampleLabels).toHaveCount(2, { timeout: 10000 });
  });

  test('navigating to English demo shows English story content', async ({ page, isMobile }) => {
    await page.goto('/');
    // On mobile, open sidebar first
    if (isMobile) {
      const hamburger = page.locator('button[aria-label*="menu"], .mobile-header__hamburger').first();
      await hamburger.click();
    }
    await page.waitForSelector('.app-sidebar');
    // Click on the English demo reader in the sidebar
    const enDemo = page.locator('.app-sidebar >> text=A New School');
    await enDemo.click();
    // Verify English story content appears
    await expect(page.locator('body')).toContainText('Li Wei', { timeout: 10000 });
  });
});
