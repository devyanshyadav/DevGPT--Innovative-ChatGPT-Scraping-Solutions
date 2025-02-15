import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Browser, Page, Viewport } from "puppeteer";
import fs from "fs/promises";
import { CONSTANTS } from "./constants";

// Interfaces
interface ScrapeConfig {
  viewport?: Viewport;
  [key: string]: any;
}

interface ScrapeParams {
  url: string;
  scrapeFunction: (page: Page) => Promise<any>;
  config?: ScrapeConfig;
}

interface ScrapeResult {
  message: string;
  result: any | null;
  error?: any | null;
  timeTaken: number;
}

interface PageSetupResult {
  page: Page;
  hasCookieFile: boolean;
}

// Configure stealth plugin - only enable essential evasions
const stealth = StealthPlugin(); //THis will almost bypass scrap detection
const enabledEvasions = new Set([
  "chrome.runtime",
  "navigator.plugins",
  "navigator.webdriver",
]);

Array.from(stealth.enabledEvasions.keys()).forEach((key) => {
  if (!enabledEvasions.has(key)) {
    stealth.enabledEvasions.delete(key);
  }
});

puppeteer.use(stealth);

// Reusable browser instance
let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: !CONSTANTS.BROWSER_OPEN,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
      ],
      defaultViewport: { width: 1280, height: 720 },
    });
  }
  return browserInstance;
}

async function setupPage(browser: Browser, viewport?: Viewport): Promise<PageSetupResult> {
  const page = await browser.newPage();
  let hasCookieFile=false;

  // Load cookies if available
  try {
    const cookiesString = await fs.readFile("cookies.json", "utf8");
    const cookies = cookiesString && JSON.parse(cookiesString);
    await page.setCookie(...cookies);
    hasCookieFile=true;
  } catch (error) {
    console.log(error);
    hasCookieFile=false;
  }

  // Optimize page settings
  await Promise.all([
    page.setRequestInterception(true),
    viewport && page.setViewport(viewport),
    page.setJavaScriptEnabled(true),
    page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    ),
  ]);

  // Efficient request interception
  page.on("request", (request) => {
    const resourceType = request.resourceType();
    if (
      ["image", "font", "media"].includes(resourceType) &&
      CONSTANTS.BROWSER_WITHOUT_RESOURCES
    ) {
      request.abort(); //if it is BROWSER_WITHOUT_RESOURCES false then it might take more time to load the page
    } else {
      request.continue();
    }
  });

  return {
    page,
    hasCookieFile
  };
}

export async function scrape({
  url,
  scrapeFunction,
  config = {},
}: ScrapeParams): Promise<ScrapeResult> {
  const startTime = Date.now();
  let currentPage: Page | null = null;

  try {
    const browser = await getBrowser();
    const { page, hasCookieFile } = await setupPage(browser, config.viewport);
    currentPage = page;

    await currentPage.goto(hasCookieFile ? url : CONSTANTS.GPT_URL, {
      waitUntil: "load",
      timeout: 30000,
    });

    const result = await scrapeFunction(currentPage);

    return {
      message: "Success",
      result,
      error: null,
      timeTaken: Date.now() - startTime,
    };
  } catch (error) {
    const err = error as Error;
    console.error("Scraping Error:", err?.message);
    return {
      message: "Error",
      result: null,
      error: err.message,
      timeTaken: Date.now() - startTime,
    };
  } finally {
    if (currentPage) {
      await currentPage.close();
    }
  }
}

// Cleanup function to be called when scraping is completely done
export async function cleanup() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
