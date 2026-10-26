
import { Page, Locator } from '@playwright/test';

export class SearchResultsPage {
    readonly page: Page;
    readonly productCards: Locator;

    constructor(page: Page) {
        this.page = page;

        this.productCards = page.locator(
            'div[data-component-type="s-search-result"]'
        );
    }

    async waitForSearchResults() {
        await this.productCards.first().waitFor({
            state: 'visible',
            timeout: 20000
        });
    }

    async getProductCount(): Promise<number> {
        return await this.productCards.count();
    }
}
