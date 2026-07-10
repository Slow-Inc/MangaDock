import { test } from '@playwright/test';

test('inspect SVG attributes', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:4000/docs');
  await page.waitForTimeout(3000);

  const docLink = page.locator('button:has-text("agentic-workflow-presentation")');
  await docLink.first().click();
  await page.waitForTimeout(5000);

  // Wait for SVG to appear
  await page.waitForSelector('[data-mermaid-chart] svg', { timeout: 20000 });

  // Get SVG dimensions
  const svgInfo = await page.evaluate(() => {
    const svg = document.querySelector('[data-mermaid-chart] svg');
    if (!svg) return 'SVG not found';
    const rect = svg.getBoundingClientRect();
    return {
      width: svg.getAttribute('width'),
      height: svg.getAttribute('height'),
      viewBox: svg.getAttribute('viewBox'),
      style: svg.getAttribute('style'),
      boundingRect: { width: rect.width, height: rect.height },
      containerWidth: svg.parentElement?.getBoundingClientRect().width,
    };
  });
  console.log('SVG info:', JSON.stringify(svgInfo, null, 2));

  // Also get the container dimensions
  const containerInfo = await page.evaluate(() => {
    const container = document.querySelector('.mermaid-wrapper');
    if (!container) return 'Container not found';
    const rect = container.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  console.log('Container info:', JSON.stringify(containerInfo, null, 2));
});
