/**
 * Elements in a real browser: the specimens page (examples/serve.ts), driven
 * the way a person does, with a mouse and with a finger.
 *
 * "Any serious version of this would have to reach the real browser. I want
 * serious." The test DOMs have no layout, no motion and no pointer; every bug
 * found by hand in the button form lived in one of those.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: '.',
    testMatch: '*.browser.ts',
    outputDir: './test-results',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: './playwright-report' }]] : 'list',
    use: {
        baseURL: 'http://localhost:5180',
        // What the browser saw, kept when a test fails.
        trace: 'retain-on-failure',
        // Motion is what is under test; a reduced-motion default would skip it.
        contextOptions: { reducedMotion: 'no-preference' },
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: '*-finger.browser.ts' },
        { name: 'phone', use: { ...devices['Pixel 7'] }, testIgnore: '*-mouse.browser.ts' },
        // A finger on an iPhone: WebKit, the engine whose taps Chromium's
        // emulated finger does not number the same way.
        { name: 'iphone', use: { ...devices['iPhone 15'] }, testIgnore: '*-mouse.browser.ts' },
    ],
    webServer: {
        command: 'bun examples/serve.ts',
        cwd: '..',
        url: 'http://localhost:5180',
        reuseExistingServer: !process.env.CI,
    },
});
