
import { ProductPage } from '../pages/ProductPage';
import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { HomePage } from '../pages/HomePage';

test('Amazon shopping workflow', async () => {
    test.setTimeout(180000);
    const userDataDir = path.join(
        process.cwd(),
        '.amazon-user-data'
    );

    const context = await chromium.launchPersistentContext(
        userDataDir,
        {
            headless: false,
            viewport: { width: 1366, height: 768 }
        }
    );

    try {
        const page = context.pages()[0] || await context.newPage();
        const homePage = new HomePage(page);
        const productPage = new ProductPage(page);

        await homePage.navigateToAmazon();

        const accountLabel = page.locator(
            '#nav-link-accountList-nav-line-1'
        );

        await accountLabel.waitFor({
            state: 'visible',
            timeout: 30000
        });

        if (/sign in/i.test(await accountLabel.innerText())) {
            console.log('Please sign in manually.');
            await page.pause();

            await page.waitForFunction(() => {
                const text = document.querySelector(
                    '#nav-link-accountList-nav-line-1'
                )?.textContent?.trim() || '';

                return text.length > 0 && !/sign in/i.test(text);
            }, { timeout: 180000 });
        } else {
            console.log('Existing Amazon session detected.');
        }

        await homePage.searchProducts('T Shirts for men');

        await expect(page).toHaveURL(/s\?/);

        await productPage.waitForSearchResults();
        await productPage.printProductNames();
        await productPage.addProductsToCart(3);
        await productPage.openCart();
        
    } finally {
        await context.close();
    }
});