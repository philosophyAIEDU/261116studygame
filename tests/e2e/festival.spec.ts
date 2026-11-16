import { expect, test } from '@playwright/test';
import { defaultSave } from '../../src/save/schema';
import { emptyStoryProgress } from '../../src/features/story/unlock';

function readySave() {
  const save = defaultSave();
  save.guardianIntroSeen = true; save.prologueSeen = true;
  save.profile = { nickname: 'Luna', gender: 'girl', mbti: 'INFP', hair: 1, hairColor: 1, outfitColor: 3 };
  save.settings.quality = 'low'; save.settings.autoNight = false;
  return save;
}
test('a clear first mission leads to listening parcels, friends, and a real outfit reward', async ({ page }) => {
  const save = readySave();
  await page.addInitScript((data) => { if (!localStorage.getItem('asq-save')) localStorage.setItem('asq-save', JSON.stringify({ state: { save: data }, version: 3 })); localStorage.setItem('asq-e2e', '1'); }, save);
  await page.goto('/');
  await page.getByRole('button', { name: /Meet Leo/ }).click();
  const dialog = page.getByRole('dialog', { name: 'The Maple Festival' });
  await expect(dialog.getByText('The missing star stickers', { exact: true }).first()).toBeVisible();
  await dialog.getByRole('button', { name: /Find the glowing stars/ }).click();
  for (const [answer, word] of [['☀️', 'sun'], ['📖', 'book'], ['⚽', 'ball']]) {
    await page.getByRole('button', { name: /Follow the stars/ }).click();
    if (await page.getByRole('dialog', { name: 'School Map' }).isVisible()) {
      await page.getByRole('button', { name: `Visit ${word} star parcel`, exact: true }).click();
    } else {
      const open = page.getByRole('button', { name: /Open star parcel/ });
      await expect(open).toBeVisible({ timeout: 30000 });
      await open.click();
    }
    await expect(page.getByRole('button', { name: `Choose ${answer}`, exact: true })).toBeDisabled();
    await page.getByRole('button', { name: /Hear the clue/ }).click();
    await page.getByRole('button', { name: `Choose ${answer}`, exact: true }).click();
    await expect(page.getByText('Star sticker found!', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
  }
  await page.getByRole('button', { name: /Meet Leo|Get my reward/ }).click();
  await page.getByRole('button', { name: /Claim 30 stars/ }).click();
  await expect(page.getByText("Ava's secret invitation", { exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: /Dress up/ }).click();
  const star = page.getByText('Starlight pin', { exact: true }).locator('..');
  await star.getByRole('button', { name: '✦ 25', exact: true }).click();
  await expect(star.getByRole('button', { name: 'Wearing', exact: true })).toBeDisabled();
  await page.reload();
  await page.getByRole('button', { name: 'Festival adventure', exact: true }).click();
  await page.getByRole('tab', { name: /Dress up/ }).click();
  await expect(page.getByText('Starlight pin', { exact: true }).locator('..').getByRole('button', { name: 'Wearing', exact: true })).toBeDisabled();
});

test('speaking and writing are playable missions, preserve input gates, and complete the festival', async ({ page }) => {
  const save = readySave();
  const story = emptyStoryProgress();
  story.steps = { look: true, read: true, dict: true, bedtime: true, useIt: false }; story.listenCount = 3;
  save.stories['elem-g1-01-new-school'] = story;
  save.adventure.started = true;
  save.adventure.claimed = ['lost-stars', 'secret-letter', 'story-lantern'];
  // 마이크를 쓸 수 없는 기기의 자기 평가 흐름도 테스트한다. 실제 음성 원문은 저장하지 않는다.
  await page.addInitScript((data) => {
    localStorage.setItem('asq-save', JSON.stringify({ state: { save: data }, version: 3 }));
    localStorage.setItem('asq-e2e', '1');
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined });
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined });
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined });
  }, save);
  await page.goto('/');
  await page.getByRole('button', { name: /Meet Ms. Harper/ }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: /Say it!/ }).click();
    await expect(page.getByText('Self-check · No automatic score')).toBeVisible();
    await page.getByRole('button', { name: /I said it!/ }).click();
  }
  await page.getByRole('button', { name: /Claim 35 stars/ }).click();
  const invitation = page.getByLabel('Write an invitation for your friends.');
  await invitation.fill('안녕 친구들');
  await page.getByRole('button', { name: /Send my invitation/ }).click();
  await expect(page.getByRole('status')).toContainText('English words');
  await invitation.fill('Come and play with us at the school festival!');
  await page.getByRole('button', { name: /Send my invitation/ }).click();
  await page.getByRole('button', { name: /Meet Ava/ }).click();
  await page.getByRole('button', { name: /Get my reward/ }).click();
  await page.getByRole('button', { name: /Claim 50 stars/ }).click();
  await expect(page.getByText('You made it happen!', { exact: true })).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem('asq-save'));
  expect(stored).not.toContain('Come and play with us at the school festival!');
});
