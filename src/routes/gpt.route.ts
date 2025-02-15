import express from "express";
import { cleanup, scrape } from "../utils/puppeteer.util";
import fs from "fs/promises";
import { CONSTANTS } from "../utils/constants";

const SELECTORS = {
  LOGIN_BUTTON: '[data-testid="login-button"]',
  SOCIAL_BUTTON: ".social-btn",
  EMAIL_INPUT: '[aria-label="Email or phone"]',
  PASSWORD_INPUT: '[aria-label="Enter your password"]',
  PROMPT_TEXTAREA: "#prompt-textarea",
  STOP_STREAMING: '[aria-label="Stop streaming"]',
  VOICE_MODE: '[aria-label="Start voice mode"]',
  MESSAGE_OUTPUT: ".markdown.prose.w-full.break-words",
} as const;

const CREDENTIALS = {
  EMAIL: process.env.USER_GMAIL || "your@gmail.com",
  PASSWORD: process.env.USER_PASSWORD || "123456....",
} as const;
let currentUrl: string | null = null;
const handleLogin = async (page: any) => {
  await page.waitForSelector(SELECTORS.LOGIN_BUTTON);
  await page.click(SELECTORS.LOGIN_BUTTON);

  await page.waitForSelector(SELECTORS.SOCIAL_BUTTON, { visible: true });
  const buttons = await page.$$(SELECTORS.SOCIAL_BUTTON);

  for (const button of buttons) {
    const text = await button.evaluate(
      (el: HTMLButtonElement) => el.textContent
    );
    if (text?.includes("Google")) {
      await button.click();
      await page.waitForNavigation();
      break;
    }
  }

  await page.waitForSelector(SELECTORS.EMAIL_INPUT, { visible: true });
  await page.type(SELECTORS.EMAIL_INPUT, CREDENTIALS.EMAIL);
  await page.keyboard.press("Enter");
  await page.waitForNavigation();

  await page.waitForSelector(SELECTORS.PASSWORD_INPUT, { visible: true });
  await page.type(SELECTORS.PASSWORD_INPUT, CREDENTIALS.PASSWORD);
  await page.keyboard.press("Enter");
  await page.waitForNavigation();

  await new Promise((resolve) => setTimeout(resolve, CONSTANTS.LOGIN_DELAY));
  const cookies = await page.cookies();
  await fs.writeFile(CONSTANTS.COOKIES_PATH, JSON.stringify(cookies, null, 2));

  return "Successfully logged in";
};

const handleStream = async (page: any, prompt: string) => {
  await page.waitForSelector(SELECTORS.PROMPT_TEXTAREA, { visible: true });

  // Pass the selector and prompt as parameters to evaluate
  await page.evaluate(
    ({ selector, promptText }: { selector: string; promptText: string }) => {
      const div = document.querySelector(selector);
      if (div && div instanceof HTMLElement) {
        div.innerHTML = `${promptText} "AND DON'T GIVE ANY OUTPUT IN CANVAS"`;
        div.dispatchEvent(new Event("input", { bubbles: true }));
      }
    },
    {
      selector: SELECTORS.PROMPT_TEXTAREA,
      promptText: prompt,
    }
  );

  await page.keyboard.press("Enter");
  await page.waitForSelector(SELECTORS.STOP_STREAMING, { visible: true });
  await page.waitForSelector(SELECTORS.VOICE_MODE, { visible: true , timeout: 30000});
  await page.waitForSelector(SELECTORS.MESSAGE_OUTPUT, { visible: true });
  const response = await page.evaluate((selector: string) => {
    const elements = document.querySelectorAll(selector);
    const lastElement = elements[elements.length - 1];
    return lastElement ? lastElement.innerHTML : null;
  }, SELECTORS.MESSAGE_OUTPUT);
  const currentPageUrl = await page.url();
  const chatIdMatch = currentPageUrl.match(/\/c\/([^/]+)/);
  const chatId = chatIdMatch ? chatIdMatch[1] : null;
  currentUrl = chatId ? `#${chatId}` : null;
  return response;
};

const gptRouter = express.Router();

gptRouter.post("/generate", async (req: any, res: any) => {
  const { prompt, chatIdValue } = req.body;

  try {
    if (!prompt) {
      throw new Error("Prompt is required");
    }
    const data = await scrape({
      url: `${CONSTANTS.GPT_URL}c/${chatIdValue}` || CONSTANTS.GPT_URL,
      scrapeFunction: async (page) => {
        const hasLoginBtn = await page.$(SELECTORS.LOGIN_BUTTON);
        return hasLoginBtn
          ? await handleLogin(page)
          : await handleStream(page, prompt);
      },
    });
    return res.json({
      data,
      url: currentUrl,
      error: null,
    });
  } catch (error) {
    return res.status(500).json({
      data: null,
      error: error instanceof Error ? error.stack : null,
    });
  } finally {
    cleanup();
  }
});

export default gptRouter;
