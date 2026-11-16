import { expect, test, type Page } from '@playwright/test';

// The test browser has no installed voices. Exercise real application audio events
// with a deterministic browser-engine stub, rather than bypassing app scoring.
async function soundEngine(page: Page, fail = false) {
  await page.addInitScript(({ fail }) => {
    const events = new EventTarget();
    const voice = { name: 'English Natural Test', voiceURI: 'test-en', lang: 'en-US', default: true, localService: true };
    class Utterance { text: string; onend?: () => void; onerror?: () => void; constructor(text: string) { this.text = text; } }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: Utterance });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [voice], cancel() {}, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
      speak(utterance: Utterance) { document.documentElement.dataset.spoken = utterance.text; setTimeout(() => fail ? utterance.onerror?.() : utterance.onend?.(), 30); },
    } });
  }, { fail });
}
async function listen(page: Page) {
  await page.getByRole('button', { name: 'Hear the word', exact: true }).click();
  await expect(page.locator('[data-testid^="word-choice-"]').first()).toBeEnabled();
  return (await page.locator('html').getAttribute('data-spoken'))!;
}
async function place(page: Page, advanced = false) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Start my level check/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Hear apple', exact: true }).click();
  await page.getByRole('button', { name: /Start my level check/ }).click();
  for (let i = 0; i < (advanced ? 12 : 3); i++) {
    const word = await listen(page);
    if (advanced) await page.getByTestId(`word-choice-${word}`).click();
    else await page.getByRole('button', { name: 'I don’t know yet' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Your starting trail' })).toBeVisible();
}

test('beginner: placement, error review, reload, reward once, collection and dress up', async ({ page }) => {
  await soundEngine(page); await place(page);
  await expect(page.locator('.word-result-level')).toContainText('Lv.1');
  await page.getByRole('button', { name: /Start my adventure/ }).click();
  const missed = await listen(page);
  const wrong = page.locator(`[data-testid^="word-choice-"]:not([data-testid="word-choice-${missed}"])`).first();
  await wrong.click();
  await expect(page.getByRole('status')).toContainText('will return soon');
  await page.reload();
  await expect(page.getByRole('status')).toContainText(missed);
  await page.getByRole('button', { name: /Next word/ }).click();
  const words: string[] = [];
  for (let i = 0; i < 5; i++) {
    const word = await listen(page); words.push(word);
    await page.getByTestId(`word-choice-${word}`).click();
    await page.getByRole('button', { name: /Next word/ }).click();
  }
  expect(words[2]).toBe(missed);
  await expect(page.getByRole('heading', { name: 'You cleared the trail!' })).toBeVisible();
  await expect(page.locator('.word-clear-stats')).toContainText('4 / 5');
  await page.getByRole('button', { name: /Collect my reward/ }).click();
  await expect(page.getByRole('button', { name: /Collect my reward/ })).toHaveCount(0);
  await expect(page.locator('.word-coins')).toContainText('45');
  await page.reload();
  await expect(page.locator('.word-coins')).toContainText('45');
  await page.getByRole('button', { name: /My learning/ }).click();
  await expect(page.locator('.word-memory-list li')).toHaveCount(5);
  await page.getByRole('button', { name: /Dress up · Coins/ }).click();
  await page.locator('.word-shop-grid').getByRole('button', { name: '✦ 30', exact: true }).click();
  await expect(page.locator('.word-coins')).toContainText('15');
  await expect(page.getByRole('button', { name: 'Wearing', exact: true })).toBeDisabled();
});

test('advanced: 12-word check leads to level 4 written choices', async ({ page }) => {
  await soundEngine(page); await place(page, true);
  await expect(page.locator('.word-result-level')).toContainText('Lv.4');
  await page.getByRole('button', { name: /Start my adventure/ }).click();
  await expect(page.locator('.word-choice-spelling')).toHaveCount(4);
  await expect(page.locator('[data-testid^="word-choice-"]').first()).toBeDisabled();
  await listen(page);
  await expect(page.locator('.word-choice-spelling').first()).not.toBeEmpty();
});

test('audio error cannot unlock a silent level check', async ({ page }) => {
  await soundEngine(page, true); await page.goto('/');
  await page.getByRole('button', { name: 'Hear apple', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('sound did not finish');
  await expect(page.getByRole('button', { name: /Start my level check/ })).toBeDisabled();
});

test('phone: English instructions, large choices and no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await soundEngine(page); await place(page);
  await page.getByRole('button', { name: /Start my adventure/ }).click();
  await listen(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const choice of await page.locator('.word-choice').all()) {
    const box = await choice.boundingBox(); expect(box!.width).toBeGreaterThan(100); expect(box!.height).toBeGreaterThan(70);
  }
  expect(await page.locator('body').innerText()).not.toMatch(/[가-힣]/);
  await page.screenshot({ path: 'work/word-quest-mobile.png', fullPage: true });
});
