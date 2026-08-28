const { test, expect } = require('../helpers/nordlys-fixture.cjs');

test('dialog traps focus, closes on Escape, and restores its opener', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    const opener = document.createElement('button'); opener.id = 'test-opener'; opener.textContent = 'Open';
    const dialog = document.createElement('div'); dialog.id = 'test-dialog'; dialog.innerHTML = '<button id="first">First</button><button id="last">Last</button>';
    document.body.append(opener, dialog);
    window.testDialog = new window.NordlysUI.DialogController(dialog);
    opener.focus(); window.testDialog.open(opener);
  });
  await expect(page.locator('#test-dialog')).toHaveAttribute('role', 'dialog');
  await page.locator('#last').focus(); await page.keyboard.press('Tab');
  await expect(page.locator('#first')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#test-opener')).toBeFocused();
});

test('vertical roving tabs synchronize focus and selection', async ({ nordlysPage }) => {
  const { page } = nordlysPage;
  await page.evaluate(() => {
    const root = document.createElement('div'); root.id = 'test-tabs';
    root.innerHTML = '<button role="tab" aria-selected="true">One</button><button role="tab" aria-selected="false">Two</button><button role="tab" aria-selected="false">Three</button>';
    document.body.append(root);
    window.testTabs = new window.NordlysUI.RovingTabs(root, { orientation: 'vertical' });
    root.querySelector('[role="tab"]').focus();
  });
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('tab', { name: 'Two' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Two' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('tab', { name: 'One' })).toBeFocused();
});
