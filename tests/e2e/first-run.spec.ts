import { expect, test } from '@playwright/test';

// 핵심 흐름: 첫 실행 → 캐릭터 생성 → 첫 이야기 ①~③ → Bedtime 재생 시작
test('first run: create a hero, do story steps 1-3, start Bedtime Listening', async ({ page }) => {
  test.setTimeout(150_000);
  // 소리를 기다리지 않게 한다(기기 음성은 헤드리스 브라우저에 없다).
  await page.addInitScript(() => localStorage.setItem('asq-e2e', '1'));
  await page.goto('/');

  // 보호자 안내(한국어) → 캐릭터 만들기
  await page.getByRole('button', { name: /아이에게 넘겨주기/ }).click();
  await page.getByLabel(/Nickname/).fill('Star');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('radio', { name: 'Hair color 3' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /I don't know/ }).click();
  for (const pick of ['Read in a quiet place', 'A real day at school', 'Give a big hug', 'Make a plan']) {
    await page.getByRole('button', { name: new RegExp(pick) }).click();
  }
  await expect(page.getByRole('radio', { name: 'ISFJ' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: /Start!/ }).click();

  // 프롤로그: 빠른 말을 못 알아듣는 장면이 있다
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByLabel(/Very fast talking/)).toBeVisible();
  await page.getByRole('button', { name: /Skip/ }).click();

  // 월드 → 퀘스트 로그 → 첫 이야기
  await expect(page.getByLabel(/Input hours/)).toBeVisible();
  await page.getByRole('button', { name: 'Quest log' }).click();
  await page.getByRole('button', { name: /The New School/ }).click();

  // ① Look & Listen
  await page.getByRole('button', { name: /Step 1/ }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next scene' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  // ② Read Along
  await page.getByRole('button', { name: /Step 2/ }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next page' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  // ③ My Picture Dictionary: 그리기 1개 + 그림 카드 1개 + 쉬운 영어 1개 (한글은 거절)
  await page.getByRole('button', { name: /Step 3/ }).click();
  await page.getByRole('button', { name: /bright/ }).click();
  const canvas = page.getByLabel('Drawing area');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('no canvas');
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 140, { steps: 6 });
  await page.mouse.up();
  await page.getByRole('button', { name: /Save my drawing/ }).click();
  await expect(page.getByAltText('My drawing')).toBeVisible();

  await page.getByRole('button', { name: /desk/ }).click();
  await page.getByRole('tab', { name: /Pick/ }).click();
  await page.getByRole('button', { name: 'Picture 🪑' }).click();

  await page.getByRole('button', { name: /pencil/ }).click();
  await page.getByRole('tab', { name: /Write/ }).click();
  await page.getByLabel(/Easy English/).fill('연필');
  await page.getByRole('button', { name: /Save/ }).click();
  await expect(page.getByRole('alert')).toContainText('use English words');
  await page.getByLabel(/Easy English/).fill('you write with it');
  await page.getByRole('button', { name: /Save/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  // ⑤는 아직 잠겨 있다
  await expect(page.getByRole('button', { name: /Step 5: Use It! \(locked\)/ })).toBeDisabled();

  // ④ Bedtime Listening 재생 시작
  await page.getByRole('button', { name: /Step 4/ }).click();
  const bedtime = page.getByRole('dialog', { name: 'Bedtime Listening' });
  await expect(bedtime).toBeVisible();
  await expect(bedtime.getByText("Relax. Don't translate. Just see the pictures.")).toBeVisible();
  await bedtime.getByRole('button', { name: 'Play' }).click();
  await expect(bedtime.getByRole('button', { name: 'Pause' })).toBeVisible();
});
