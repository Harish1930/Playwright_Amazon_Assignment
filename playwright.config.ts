
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',

    timeout: 60000,

    expect: {
        timeout: 10000
    },

    reporter: [
        ['list'],
        ['html', { open: 'never' }]
    ],

    use: {
        browserName: 'chromium',
        headless: false,
        viewport: { width: 1366, height: 768 },
        trace: 'on-first-retry'
    }
});