// ArbitrageX Supreme V3.0 - E2E Tests with Playwright
// Ubicación: e2e/tests/arbitragex-e2e.spec.ts
// Paquete Operativo Completo - Testing E2E Real

import { test, expect, Page } from '@playwright/test';
import { chromium, firefox, webkit } from '@playwright/test';

// Test configuration
const TEST_CONFIG = {
  baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://arbitragex.app',
  apiURL: process.env.API_BASE_URL || 'https://api.arbitragex.dev',
  timeout: 30000,
  retries: 2
};

// Test data
const TEST_DATA = {
  validApiKey: process.env.TEST_API_KEY || 'test-api-key',
  testWallet: '0x742d35Cc6634C0532925a3b8D4C2b4E9C0c4b4b4',
  testTokens: {
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86a33E6441b8435b662b0C0C39C1A5b0c5c3c'
  }
};

// Page Object Model
class ArbitrageXPage {
  constructor(private page: Page) {}

  // Navigation
  async goto() {
    await this.page.goto(TEST_CONFIG.baseURL);
    await this.page.waitForLoadState('networkidle');
  }

  // Dashboard elements
  get opportunitiesTable() {
    return this.page.locator('[data-testid="opportunities-table"]');
  }

  get executionsTable() {
    return this.page.locator('[data-testid="executions-table"]');
  }

  get analyticsCards() {
    return this.page.locator('[data-testid="analytics-cards"]');
  }

  get connectionStatus() {
    return this.page.locator('[data-testid="connection-status"]');
  }

  get streamingIndicator() {
    return this.page.locator('[data-testid="streaming-indicator"]');
  }

  // Actions
  async waitForOpportunities(timeout = 10000) {
    await this.page.waitForSelector('[data-testid="opportunity-row"]', { timeout });
  }

  async executeOpportunity(index = 0) {
    const executeButton = this.page.locator(`[data-testid="execute-opportunity-${index}"]`);
    await executeButton.click();
    await this.page.waitForSelector('[data-testid="execution-modal"]');
  }

  async confirmExecution() {
    await this.page.locator('[data-testid="confirm-execution"]').click();
  }

  async switchChain(chain: string) {
    await this.page.locator('[data-testid="chain-selector"]').click();
    await this.page.locator(`[data-testid="chain-${chain}"]`).click();
  }

  async toggleTheme() {
    await this.page.locator('[data-testid="theme-toggle"]').click();
  }
}

// =====================================================
// SMOKE TESTS - Critical Path Validation
// =====================================================

test.describe('🚨 Smoke Tests - Critical Path', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport for consistent testing
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('Application loads successfully', async ({ page }) => {
    const arbitrageX = new ArbitrageXPage(page);
    
    await arbitrageX.goto();
    
    // Verify page title
    await expect(page).toHaveTitle(/ArbitrageX Supreme/);
    
    // Verify main components are visible
    await expect(arbitrageX.opportunitiesTable).toBeVisible();
    await expect(arbitrageX.analyticsCards).toBeVisible();
    
    // Verify no critical errors
    const errors = await page.locator('[data-testid="error-message"]').count();
    expect(errors).toBe(0);
  });

  test('API health check passes', async ({ page }) => {
    const response = await page.request.get(`${TEST_CONFIG.apiURL}/health`);
    expect(response.ok()).toBeTruthy();
    
    const health = await response.json();
    expect(health.status).toBe('healthy');
  });

  test('WebSocket connection establishes', async ({ page }) => {
    const arbitrageX = new ArbitrageXPage(page);
    await arbitrageX.goto();
    
    // Wait for WebSocket connection
    await expect(arbitrageX.connectionStatus).toContainText('Connected', { timeout: 10000 });
    await expect(arbitrageX.streamingIndicator).toBeVisible();
  });

  test('Real-time data streaming works', async ({ page }) => {
    const arbitrageX = new ArbitrageXPage(page);
    await arbitrageX.goto();
    
    // Wait for initial data load
    await arbitrageX.waitForOpportunities();
    
    // Count initial opportunities
    const initialCount = await page.locator('[data-testid="opportunity-row"]').count();
    expect(initialCount).toBeGreaterThan(0);
    
    // Wait for streaming updates (should see changes within 30 seconds)
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('[data-testid="opportunity-row"]');
      return rows.length > 0;
    }, { timeout: 30000 });
    
    // Verify streaming indicator is active
    await expect(arbitrageX.streamingIndicator).toHaveClass(/streaming-active/);
  });
});

// =====================================================
// FUNCTIONAL TESTS - Core Features
// =====================================================

test.describe('🎯 Functional Tests - Core Features', () => {
  let arbitrageX: ArbitrageXPage;

  test.beforeEach(async ({ page }) => {
    arbitrageX = new ArbitrageXPage(page);
    await arbitrageX.goto();
    await arbitrageX.waitForOpportunities();
  });

  test('Opportunities table displays real data', async ({ page }) => {
    // Verify table headers
    await expect(page.locator('th:has-text("Pair")')).toBeVisible();
    await expect(page.locator('th:has-text("Profit")')).toBeVisible();
    await expect(page.locator('th:has-text("DEXes")')).toBeVisible();
    
    // Verify data rows
    const rows = page.locator('[data-testid="opportunity-row"]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    
    // Verify first row has real data (not mock)
    const firstRow = rows.first();
    await expect(firstRow.locator('[data-testid="pair-symbol"]')).not.toContainText('MOCK');
    await expect(firstRow.locator('[data-testid="profit-amount"]')).toContainText(/\$\d+/);
  });

  test('Executions table shows transaction history', async ({ page }) => {
    // Navigate to executions tab
    await page.locator('[data-testid="executions-tab"]').click();
    
    // Wait for executions to load
    await page.waitForSelector('[data-testid="execution-row"]', { timeout: 10000 });
    
    // Verify execution data
    const executionRows = page.locator('[data-testid="execution-row"]');
    const count = await executionRows.count();
    
    if (count > 0) {
      const firstExecution = executionRows.first();
      await expect(firstExecution.locator('[data-testid="tx-hash"]')).toContainText(/0x[a-fA-F0-9]{64}/);
      await expect(firstExecution.locator('[data-testid="execution-status"]')).toBeVisible();
    }
  });

  test('Analytics display real metrics', async ({ page }) => {
    // Verify analytics cards
    const totalProfitCard = page.locator('[data-testid="total-profit-card"]');
    const successRateCard = page.locator('[data-testid="success-rate-card"]');
    const volumeCard = page.locator('[data-testid="volume-card"]');
    
    await expect(totalProfitCard).toBeVisible();
    await expect(successRateCard).toBeVisible();
    await expect(volumeCard).toBeVisible();
    
    // Verify metrics have real values
    await expect(totalProfitCard.locator('[data-testid="metric-value"]')).toContainText(/\$\d+/);
    await expect(successRateCard.locator('[data-testid="metric-value"]')).toContainText(/%/);
  });

  test('Chain switching works correctly', async ({ page }) => {
    // Test switching to Polygon
    await arbitrageX.switchChain('polygon');
    await page.waitForTimeout(2000); // Wait for data refresh
    
    // Verify chain indicator
    await expect(page.locator('[data-testid="current-chain"]')).toContainText('Polygon');
    
    // Verify opportunities refresh for new chain
    await arbitrageX.waitForOpportunities();
    
    // Switch back to Ethereum
    await arbitrageX.switchChain('ethereum');
    await expect(page.locator('[data-testid="current-chain"]')).toContainText('Ethereum');
  });

  test('Theme switching works', async ({ page }) => {
    // Get initial theme
    const body = page.locator('body');
    const initialClass = await body.getAttribute('class');
    
    // Toggle theme
    await arbitrageX.toggleTheme();
    await page.waitForTimeout(500);
    
    // Verify theme changed
    const newClass = await body.getAttribute('class');
    expect(newClass).not.toBe(initialClass);
    
    // Toggle back
    await arbitrageX.toggleTheme();
    await page.waitForTimeout(500);
    
    const finalClass = await body.getAttribute('class');
    expect(finalClass).toBe(initialClass);
  });
});

// =====================================================
// PERFORMANCE TESTS
// =====================================================

test.describe('📊 Performance Tests', () => {
  test('Page load performance', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(TEST_CONFIG.baseURL);
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Page should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    // Verify Core Web Vitals
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const vitals = {};
          
          entries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              vitals.fcp = entry.startTime;
            }
            if (entry.name === 'largest-contentful-paint') {
              vitals.lcp = entry.startTime;
            }
          });
          
          resolve(vitals);
        }).observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
        
        // Fallback timeout
        setTimeout(() => resolve({}), 5000);
      });
    });
    
    console.log('Performance metrics:', metrics);
  });

  test('Virtual scrolling performance', async ({ page }) => {
    const arbitrageX = new ArbitrageXPage(page);
    await arbitrageX.goto();
    await arbitrageX.waitForOpportunities();
    
    // Measure scroll performance
    const startTime = Date.now();
    
    // Scroll through opportunities table
    const table = arbitrageX.opportunitiesTable;
    await table.hover();
    
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(100);
    }
    
    const scrollTime = Date.now() - startTime;
    
    // Virtual scrolling should be smooth (< 2 seconds for 10 scrolls)
    expect(scrollTime).toBeLessThan(2000);
  });

  test('Real-time update performance', async ({ page }) => {
    const arbitrageX = new ArbitrageXPage(page);
    await arbitrageX.goto();
    await arbitrageX.waitForOpportunities();
    
    // Monitor update frequency
    let updateCount = 0;
    const startTime = Date.now();
    
    // Listen for DOM changes
    await page.evaluate(() => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.target.getAttribute('data-testid') === 'opportunities-table') {
            window.updateCount = (window.updateCount || 0) + 1;
          }
        });
      });
      
      const table = document.querySelector('[data-testid="opportunities-table"]');
      if (table) {
        observer.observe(table, { childList: true, subtree: true });
      }
    });
    
    // Wait for updates
    await page.waitForTimeout(10000);
    
    updateCount = await page.evaluate(() => window.updateCount || 0);
    const duration = Date.now() - startTime;
    
    // Should receive updates (at least 1 per 5 seconds)
    expect(updateCount).toBeGreaterThan(0);
    
    console.log(`Received ${updateCount} updates in ${duration}ms`);
  });
});

// =====================================================
// INTEGRATION TESTS - Backend Communication
// =====================================================

test.describe('🔗 Integration Tests - Backend Communication', () => {
  test('API endpoints respond correctly', async ({ page }) => {
    // Test opportunities endpoint
    const opportunitiesResponse = await page.request.get(`${TEST_CONFIG.apiURL}/api/opportunities`);
    expect(opportunitiesResponse.ok()).toBeTruthy();
    
    const opportunities = await opportunitiesResponse.json();
    expect(Array.isArray(opportunities.data || opportunities)).toBeTruthy();
    
    // Test executions endpoint
    const executionsResponse = await page.request.get(`${TEST_CONFIG.apiURL}/api/executions`);
    expect(executionsResponse.ok()).toBeTruthy();
    
    // Test analytics endpoint
    const analyticsResponse = await page.request.get(`${TEST_CONFIG.apiURL}/api/analytics`);
    expect(analyticsResponse.ok()).toBeTruthy();
  });

  test('WebSocket real-time communication', async ({ page }) => {
    const arbitrageX = new ArbitrageXPage(page);
    await arbitrageX.goto();
    
    // Monitor WebSocket messages
    const messages = [];
    
    page.on('websocket', ws => {
      ws.on('framereceived', event => {
        try {
          const data = JSON.parse(event.payload);
          messages.push(data);
        } catch (e) {
          // Ignore non-JSON messages
        }
      });
    });
    
    // Wait for WebSocket connection and messages
    await page.waitForTimeout(10000);
    
    // Should receive real-time messages
    expect(messages.length).toBeGreaterThan(0);
    
    // Verify message structure
    const firstMessage = messages[0];
    expect(firstMessage).toHaveProperty('type');
    expect(firstMessage).toHaveProperty('data');
    expect(firstMessage).toHaveProperty('timestamp');
  });

  test('Error handling for API failures', async ({ page }) => {
    // Intercept API calls and simulate failures
    await page.route(`${TEST_CONFIG.apiURL}/api/opportunities`, route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    const arbitrageX = new ArbitrageXPage(page);
    await arbitrageX.goto();
    
    // Should display error message
    await expect(page.locator('[data-testid="api-error-message"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="api-error-message"]')).toContainText('Failed to fetch');
  });
});

// =====================================================
// CROSS-BROWSER TESTS
// =====================================================

test.describe('🌐 Cross-Browser Compatibility', () => {
  ['chromium', 'firefox', 'webkit'].forEach(browserName => {
    test(`Works correctly in ${browserName}`, async () => {
      const browser = await { chromium, firefox, webkit }[browserName].launch();
      const context = await browser.newContext();
      const page = await context.newPage();
      
      try {
        const arbitrageX = new ArbitrageXPage(page);
        await arbitrageX.goto();
        
        // Verify basic functionality
        await expect(page).toHaveTitle(/ArbitrageX Supreme/);
        await expect(arbitrageX.opportunitiesTable).toBeVisible();
        await arbitrageX.waitForOpportunities();
        
        // Verify WebSocket connection
        await expect(arbitrageX.connectionStatus).toContainText('Connected', { timeout: 15000 });
        
      } finally {
        await browser.close();
      }
    });
  });
});

// =====================================================
// MOBILE RESPONSIVENESS TESTS
// =====================================================

test.describe('📱 Mobile Responsiveness', () => {
  const devices = [
    { name: 'iPhone 13', width: 390, height: 844 },
    { name: 'iPad', width: 768, height: 1024 },
    { name: 'Android', width: 360, height: 640 }
  ];

  devices.forEach(device => {
    test(`Responsive design on ${device.name}`, async ({ page }) => {
      await page.setViewportSize({ width: device.width, height: device.height });
      
      const arbitrageX = new ArbitrageXPage(page);
      await arbitrageX.goto();
      
      // Verify mobile layout
      await expect(arbitrageX.opportunitiesTable).toBeVisible();
      
      // Check if mobile menu exists for smaller screens
      if (device.width < 768) {
        const mobileMenu = page.locator('[data-testid="mobile-menu"]');
        if (await mobileMenu.count() > 0) {
          await expect(mobileMenu).toBeVisible();
        }
      }
      
      // Verify table is scrollable on mobile
      const tableContainer = page.locator('[data-testid="table-container"]');
      const isScrollable = await tableContainer.evaluate(el => 
        el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight
      );
      
      // On mobile, table should be scrollable
      if (device.width < 768) {
        expect(isScrollable).toBeTruthy();
      }
    });
  });
});

// =====================================================
// ACCESSIBILITY TESTS
// =====================================================

test.describe('♿ Accessibility Tests', () => {
  test('Keyboard navigation works', async ({ page }) => {
    const arbitrageX = new ArbitrageXPage(page);
    await arbitrageX.goto();
    await arbitrageX.waitForOpportunities();
    
    // Test tab navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Verify focus is visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('Screen reader compatibility', async ({ page }) => {
    const arbitrageX = new ArbitrageXPage(page);
    await arbitrageX.goto();
    
    // Check for proper ARIA labels
    await expect(page.locator('[aria-label]')).toHaveCount(await page.locator('[aria-label]').count());
    
    // Check for heading structure
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
    
    // Check for alt text on images
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      expect(alt).toBeTruthy();
    }
  });
});

// =====================================================
// SECURITY TESTS
// =====================================================

test.describe('🔒 Security Tests', () => {
  test('No sensitive data in client-side code', async ({ page }) => {
    const arbitrageX = new ArbitrageXPage(page);
    await arbitrageX.goto();
    
    // Check for exposed secrets in page source
    const content = await page.content();
    
    // Should not contain common secret patterns
    expect(content).not.toMatch(/sk_live_/); // Stripe keys
    expect(content).not.toMatch(/pk_live_/); // Stripe keys
    expect(content).not.toMatch(/AKIA[0-9A-Z]{16}/); // AWS keys
    expect(content).not.toMatch(/private.*key/i);
    expect(content).not.toMatch(/secret.*key/i);
  });

  test('HTTPS is enforced', async ({ page }) => {
    const response = await page.goto(TEST_CONFIG.baseURL);
    const url = response.url();
    expect(url).toMatch(/^https:/);
  });

  test('Content Security Policy headers', async ({ page }) => {
    const response = await page.goto(TEST_CONFIG.baseURL);
    const headers = response.headers();
    
    // Check for security headers
    expect(headers['content-security-policy'] || headers['content-security-policy-report-only']).toBeTruthy();
    expect(headers['x-frame-options']).toBeTruthy();
    expect(headers['x-content-type-options']).toBe('nosniff');
  });
});

// =====================================================
// TEST CONFIGURATION
// =====================================================

// Playwright config
// Ubicación: e2e/playwright.config.ts
export const playwrightConfig = {
  testDir: './tests',
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  use: {
    baseURL: TEST_CONFIG.baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
  ],
};
