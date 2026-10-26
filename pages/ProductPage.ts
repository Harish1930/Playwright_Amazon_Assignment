import { Page, Locator, expect } from '@playwright/test';

export class ProductPage {
    readonly page: Page;
    readonly productCards: Locator;

    constructor(page: Page) {
        this.page = page;

        this.productCards = page.locator(
            'div[data-component-type="s-search-result"]'
        );
    }

    async waitForSearchResults(): Promise<void> {
        await this.productCards.first().waitFor({
            state: 'visible',
            timeout: 20000
        });
    }

    async printProductNames() {
        console.log('--- T-shirt search results ---');

        const products = await this.productCards.evaluateAll((cards) => {
            return cards.map((card) => {
                const titleHeading = Array.from(
                    card.querySelectorAll('h2')
                ).find((heading) =>
                    /\bt(?:[\s\p{Pd}])?shirts?\b/iu.test(
                        heading.textContent?.replace(/\s+/g, ' ').trim() || ''
                    )
                );
                const link =
                    titleHeading?.closest('a') ??
                    card.querySelector('a:has(h2)') ??
                    card.querySelector('h2 a');
                const title = titleHeading?.textContent
                    ?.replace(/\s+/g, ' ')
                    .trim() || '';
                const href = link?.getAttribute('href') || '';

                return { title, href };
            }).filter((product) => product.title && product.href);
        });

        const seen = new Set<string>();
        let printed = 0;

        for (const product of products) {
            if (seen.has(product.href)) continue;
            if (!/\bt(?:[\s\p{Pd}])?shirts?\b/iu.test(product.title)) continue;

            seen.add(product.href);

            console.log(`${printed + 1}. ${product.title}`);
            console.log(
                `   URL: ${new URL(product.href, this.page.url()).href}`
            );

            printed++;

            if (printed === 10) break;
        }

        console.log('Products printed:', printed);
    }

    async addProductsToCart(target = 3): Promise<void> {
        console.log(`--- Adding ${target} T-shirts to cart ---`);

        const searchUrl = this.page.url();
        const products = await this.productCards.evaluateAll((cards) =>
            cards.map((card) => {
                const heading = Array.from(card.querySelectorAll('h2')).find(
                    (candidate) =>
                        /\bt(?:[\s\p{Pd}])?shirts?\b/iu.test(
                            candidate.textContent?.replace(/\s+/g, ' ').trim() || ''
                        )
                );
                const link =
                    heading?.closest('a') ??
                    card.querySelector('a:has(h2)') ??
                    card.querySelector('h2 a');
                return {
                    title: heading?.textContent
                        ?.replace(/\s+/g, ' ')
                        .trim() || '',
                    href: link?.getAttribute('href') || ''
                };
            })
        );

        const seen = new Set<string>();
        let added = 0;
        let attempted = 0;
        const maxProductsToAttempt = 10;
        const badge = this.page.locator('#nav-cart-count');
        const readCartCount = async () => {
            const text = (await badge.innerText().catch(() => '0')).trim();
            return Number.parseInt(text, 10) || 0;
        };

        for (const product of products) {
            if (added >= target || attempted >= maxProductsToAttempt) break;
            if (
                !product.href ||
                !/\bt(?:[\s\p{Pd}])?shirts?\b/iu.test(product.title)
            ) {
                continue;
            }

            const productUrl = new URL(product.href, searchUrl);
            const nestedProductUrl = productUrl.searchParams.get('url');
            const destination = nestedProductUrl
                ? new URL(nestedProductUrl, searchUrl)
                : productUrl;
            if (destination.origin !== new URL(searchUrl).origin) {
                continue;
            }

            const productKey = destination.pathname;
            if (seen.has(productKey)) continue;
            seen.add(productKey);
            attempted++;

            console.log(`Checking product: ${product.title}`);
            const beforeCount = await readCartCount();
            const addedProduct = await this.addProductFromDetails(
                destination.href,
                beforeCount
            );

            if (addedProduct) {
                added++;
                console.log(`Added product ${added}/${target}: ${product.title}`);
            }

            await this.page.goto(searchUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 15000
            });
            await this.waitForSearchResults();
        }

        console.log(`Products added: ${added}/${target}`);
        expect(
            added,
            `Could not add ${target} products; only ${added} cart-count increases were confirmed after ${attempted} offers.`
        ).toBe(target);
    }

    private async addProductFromDetails(
        productUrl: string,
        beforeCount: number
    ): Promise<boolean> {
        const badge = this.page.locator('#nav-cart-count');
        const readCartCount = async () => {
            const text = (await badge.innerText().catch(() => '0')).trim();
            return Number.parseInt(text, 10) || 0;
        };

        try {
            await this.page.goto(productUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 15000
            });

            const sizeSelect = this.page.locator(
                '#native_dropdown_selected_size_name'
            );
            if (await sizeSelect.isVisible().catch(() => false)) {
                const availableOptions = await sizeSelect.locator('option')
                    .evaluateAll((options) =>
                        options
                            .filter((option) => {
                                const item = option as HTMLOptionElement;
                                return item.value !== '' && !item.disabled;
                            })
                            .map((option) => ({
                                label: option.textContent?.trim() || '',
                                value: (option as HTMLOptionElement).value
                            }))
                    );
                const selectedValue = await sizeSelect.inputValue();
                const selectedOption = availableOptions.find(
                    (option) => option.value === selectedValue
                );
                const optionToSelect = selectedOption || availableOptions[0];
                if (!optionToSelect) {
                    console.log('No selectable size is available on this offer.');
                    return false;
                }
                if (!selectedOption) {
                    await sizeSelect.selectOption(optionToSelect.value);
                }
            }

            const sizeOptions = this.page.locator('#variation_size_name');
            if (await sizeOptions.isVisible().catch(() => false)) {
                const options = sizeOptions.locator(
                    'li:not(.unavailable) button, li:not(.unavailable) a, button:not([disabled]), a'
                );
                for (let i = 0; i < await options.count(); i++) {
                    const option = options.nth(i);
                    if (await option.isVisible() && await option.isEnabled()) {
                        await option.click({ timeout: 5000 });
                        break;
                    }
                }
            }

            const addButton = this.page.locator('#add-to-cart-button');
            await addButton.waitFor({ state: 'visible', timeout: 10000 });
            await addButton.click({ timeout: 10000, noWaitAfter: true });

            try {
                await expect.poll(readCartCount, { timeout: 8000 })
                    .toBeGreaterThan(beforeCount);
                return true;
            } catch {
                const unavailableMessage = this.page.getByText(
                    /sorry, there was a problem|not available|unavailable|requested (more|quantity)|than available/i
                ).first();
                const errorText = await unavailableMessage.innerText().catch(() => '');
                if (errorText) {
                    console.log(`Amazon rejected this offer: ${errorText}`);
                } else {
                    console.log('Cart count did not increase after the product-page click.');
                }
                return false;
            }
        } catch (error) {
            console.log(
                'Could not add product from its detail page:',
                error instanceof Error ? error.message : String(error)
            );
            return false;
        }
    }

    async openCart() {
        await this.page.getByRole('link', {
            name: /cart/i
        }).first().click();

        await this.page.waitForLoadState('domcontentloaded');

        await expect(this.page).toHaveURL(/cart/i);

        console.log('Opened cart:', this.page.url());
    }

    async inspectAddToCartButtons() {
        console.log('--- Inspecting Add to cart buttons ---');

        const count = await this.productCards.count();

        for (let i = 0; i < Math.min(count, 10); i++) {
            const card = this.productCards.nth(i);

            const title = (
                await card.locator('h2').allTextContents()
            ).join(' ').trim();

            const buttons = card.getByRole('button', {
                name: /add to cart/i
            });

            console.log(`\nProduct ${i + 1}: ${title}`);
            console.log('Add to cart buttons:', await buttons.count());

            if (await buttons.count() > 0) {
                console.log(
                    'Button visible:',
                    await buttons.first().isVisible()
                );
            }
        }
    }
}