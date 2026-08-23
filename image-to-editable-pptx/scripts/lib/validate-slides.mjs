import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
import { findChrome } from "./runtime.mjs";

const REMOTE_REFERENCE =
  /(?:src|href)\s*=\s*["']\s*(?:https?:\/\/|\/\/|data:|file:|\/)/i;

export async function validateSlides(input, options = {}) {
  const html = await readFile(input, "utf8");
  const errors = [];
  const warnings = [];

  if (REMOTE_REFERENCE.test(html)) {
    errors.push(
      "Remote src/href references are not allowed; use local assets.",
    );
  }

  const chrome = await findChrome(options.chrome);
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--allow-file-access-from-files", "--disable-gpu", "--no-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    const failedResources = [];
    page.on("requestfailed", (request) => {
      failedResources.push(request.url());
    });
    await page.goto(pathToFileURL(input).href, {
      waitUntil: "networkidle0",
      timeout: 30_000,
    });
    await page.evaluate(() => document.fonts.ready);

    const slides = await page.$$eval(options.selector ?? ".slide", (nodes) =>
      nodes.map((slide, index) => {
        const root = slide.getBoundingClientRect();
        const visible = [...slide.querySelectorAll("*")].filter((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) !== 0 &&
            rect.width > 0 &&
            rect.height > 0
          );
        });
        const textElements = visible.filter(
          (element) =>
            element.children.length === 0 &&
            (element.textContent ?? "").trim().length > 0,
        );
        const images = visible
          .filter((element) => element.tagName === "IMG")
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              source: element.getAttribute("src"),
              widthRatio: rect.width / root.width,
              heightRatio: rect.height / root.height,
            };
          });
        const clippedText = textElements
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return (
              rect.left < root.left - 1 ||
              rect.top < root.top - 1 ||
              rect.right > root.right + 1 ||
              rect.bottom > root.bottom + 1
            );
          })
          .map((element) => (element.textContent ?? "").trim().slice(0, 80));
        return {
          index: index + 1,
          id: slide.id || null,
          width: root.width,
          height: root.height,
          elementCount: visible.length,
          textElementCount: textElements.length,
          imageCount: images.length,
          hasFullSlideImage: images.some(
            (image) => image.widthRatio >= 0.95 && image.heightRatio >= 0.95,
          ),
          clippedText,
        };
      }),
    );

    if (slides.length === 0) errors.push("No slide elements were found.");
    for (const slide of slides) {
      if (slide.width <= 0 || slide.height <= 0) {
        errors.push(`Slide ${slide.index} has invalid dimensions.`);
      }
      if (slide.elementCount === 0) {
        errors.push(`Slide ${slide.index} is empty.`);
      }
      if (slide.hasFullSlideImage) {
        errors.push(`Slide ${slide.index} contains a near-full-slide image.`);
      }
      if (slide.textElementCount === 0) {
        warnings.push(`Slide ${slide.index} contains no editable text.`);
      }
      if (slide.clippedText.length > 0) {
        errors.push(
          `Slide ${slide.index} has text outside its bounds: ${slide.clippedText.join(
            ", ",
          )}`,
        );
      }
    }
    for (const url of failedResources) {
      errors.push(`Resource failed to load: ${url}`);
    }

    return { ok: errors.length === 0, errors, warnings, slides };
  } finally {
    await browser.close();
  }
}
