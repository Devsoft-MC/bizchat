import { chromium } from 'playwright-core';

const password = process.env.BIZCHAT_ADMIN_PASSWORD;
const companySlug = process.env.BIZCHAT_COMPANY_SLUG || 'finance';
const mobileNumber = process.env.BIZCHAT_ADMIN_MOBILE || '9995764088';
const webUrl = process.env.BIZCHAT_WEB_URL || 'http://127.0.0.1:8081';

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const browserErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });

  await page.goto(webUrl, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Company slug').waitFor();
  await page.screenshot({ path: '/tmp/bizchat-mobile-login.png', fullPage: true });

  if (password) {
    await page.getByLabel('Company slug').fill(companySlug);
    await page.getByLabel('Mobile number').fill(mobileNumber);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByText('Users', { exact: true }).waitFor();

    if (companySlug === 'icon') {
      await page.getByText('Mrudul Chendran', { exact: true }).waitFor();
    }
    await page.screenshot({ path: '/tmp/bizchat-mobile-users.png', fullPage: true });

    await page.getByRole('button', { name: 'Add user' }).click();
    await page.getByLabel('First name').waitFor();

    if (companySlug === 'finance') {
      for (const department of ['Administration', 'Accounts', 'Management', 'Collection']) {
        await page.getByText(department, { exact: true }).waitFor();
      }
    }

    await page.screenshot({ path: '/tmp/bizchat-mobile-create-user.png', fullPage: true });
  }
  console.log(JSON.stringify({
    loginScreen: '/tmp/bizchat-mobile-login.png',
    ...(password && { userListScreen: '/tmp/bizchat-mobile-users.png' }),
    ...(password && { createUserScreen: '/tmp/bizchat-mobile-create-user.png' }),
    ...(password && companySlug === 'finance' && { departmentsVerified: 4 }),
    browserErrors,
  }));
} finally {
  await browser.close();
}
