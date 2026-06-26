import { expect, test } from '@playwright/test';

test('preview strips script execution and inline event handlers', async ({ page }, testInfo) => {
  const title = `Unsafe ${testInfo.project.name} ${Date.now()} ${Math.random().toString(36).slice(2, 7)}`;

  await page.goto('/');
  await page.getByLabel('Note title').fill(title);
  await page.getByRole('button', { name: 'Create note' }).click();
  await expect(page.getByText(`Editing ${title}`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save note' })).toBeEnabled();

  await page
    .getByLabel('HTML source')
    .fill('<h1 onclick="window.evil=true">Safe title</h1><script>window.evil = true</script><p>Still visible</p>');

  const previewFrame = page.frameLocator('iframe[title="HTML preview"]');
  await expect(previewFrame.getByText('Safe title')).toBeVisible();
  await expect(previewFrame.getByText('Still visible')).toBeVisible();

  const preview = page.locator('iframe[title="HTML preview"]');
  await expect(preview).not.toHaveAttribute('srcdoc', /script/);
  await expect(preview).not.toHaveAttribute('srcdoc', /onclick/);
});
