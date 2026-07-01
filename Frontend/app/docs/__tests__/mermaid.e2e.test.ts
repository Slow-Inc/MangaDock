import { test, expect } from '@playwright/test';

test('verify mermaid rendering on docs page', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  // Go to the docs page via cloudflared tunnel
  await page.goto('http://localhost:4000/docs');
  await page.waitForTimeout(3000); 

  // Locate the sidebar link to 'agentic-workflow-presentation'
  const docLink = page.locator('button:has-text("agentic-workflow-presentation")');
  if (await docLink.count() > 0) {
    console.log('Found docLink by button');
    await docLink.first().click();
  } else {
    const docSpan = page.locator('span:has-text("agentic-workflow-presentation")');
    if (await docSpan.count() > 0) {
      console.log('Found docLink by span');
      await docSpan.first().click();
    } else {
      const fallbackLink = page.locator('text=agentic-workflow-presentation');
      console.log('Using fallbackLink');
      await fallbackLink.first().click();
    }
  }

  // Wait for the document content to load
  await page.waitForTimeout(3000);

  // Check if the container with data-mermaid-chart is rendered
  const mermaidContainer = page.locator('[data-mermaid-chart]');
  await expect(mermaidContainer.first()).toBeVisible({ timeout: 15000 });

  // Wait for Mermaid to draw the SVG (it replaces rendering text with svg)
  await page.waitForSelector('[data-mermaid-chart] svg', { timeout: 20000 });

  // Scroll to the mermaid chart
  await mermaidContainer.first().scrollIntoViewIfNeeded();

  // Wait a moment for rendering to settle
  await page.waitForTimeout(2000);

  // Take a screenshot of the rendered diagram
  await page.screenshot({ path: 'C:/Users/xenod/.gemini/antigravity/brain/10f528cf-9ea0-4f1a-93b3-b3c02935c3f7/mermaid_rendering_e2e.png' });
  console.log('E2E Screenshot captured successfully!');
});

