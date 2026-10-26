
import { Page, Locator } from '@playwright/test';

export class HomePage {
    readonly page: Page;
    readonly searchBox: Locator;
    readonly searchButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.searchBox = page.locator('#twotabsearchtextbox');
        this.searchButton = page.locator('#nav-search-submit-button');
    }

    async navigateToAmazon() {
        await this.page.goto('https://www.amazon.in');
    }

    async loginManually() {
        console.log('Please log in to Amazon manually in the opened browser.');
        console.log('Complete any OTP or verification prompts if required.');

        // Wait for you to finish logging in.
        // Continue when the Amazon home page is available again.
        await this.page.waitForURL('https://www.amazon.in/**', {
            timeout: 180000
        });

        await this.page.pause();
    }

    async searchProducts(product: string) {
        await this.searchBox.waitFor({ state: 'visible' });
        await this.searchBox.fill(product);
        await this.searchButton.click();
    }
}