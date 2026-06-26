import { expect, test } from '@playwright/test';

test('creates, edits, previews, saves, and reloads a note', async ({ page }, testInfo) => {
  const title = `E2E ${testInfo.project.name} ${Date.now()} ${Math.random().toString(36).slice(2, 7)}`;

  await page.goto('/');

  await expect(page.getByTestId('workspace-shell')).toBeVisible();
  await page.getByLabel('Note title').fill(title);
  await page.getByRole('button', { name: 'Create note' }).click();

  await expect(page.getByText(title).first()).toBeVisible();
  await expect(page.getByText(`Editing ${title}`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save note' })).toBeEnabled();

  const editor = page.getByLabel('HTML source');
  await expect(editor).toHaveValue(new RegExp(title));
  await editor.fill('<article><h1>E2E Saved</h1><p>Visible preview text</p></article>');

  const preview = page.frameLocator('iframe[title="HTML preview"]');
  await expect(preview.getByText('Visible preview text')).toBeVisible();

  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByText(`Editing ${title}`)).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: new RegExp(title) }).click();
  await expect(page.getByLabel('HTML source')).toHaveValue(/Visible preview text/);
});
