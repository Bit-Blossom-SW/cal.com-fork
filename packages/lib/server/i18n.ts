import fs from "fs";
import { createInstance } from "i18next";
import path from "path";

import { WEBAPP_URL } from "@calcom/lib/constants";

const translationCache = new Map<string, Record<string, string>>();
const i18nInstanceCache = new Map<string, any>();

// Clear cache in development to ensure fresh translations
if (process.env.NODE_ENV === "development") {
  translationCache.clear();
  i18nInstanceCache.clear();
}

/**
 * Loads English fallback translations for when requested locale translations fail
 * Implements caching to avoid redundant network requests
 * @returns {Promise<Record<string, string>>} English translations object or empty object on failure
 */
async function loadFallbackTranslations() {
  const cacheKey = "en-common";

  // Skip cache in development for fresh translations
  if (process.env.NODE_ENV !== "development" && translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  try {
    let translations;

    if (process.env.NODE_ENV === "development") {
      // In development, read directly from filesystem
      let translationPath;
      const cwd = process.cwd();

      // Try different path configurations
      const possiblePaths = [
        path.join(cwd, "public/static/locales/en/common.json"),
        path.join(cwd, "apps/web/public/static/locales/en/common.json"),
        path.join(cwd, "../web/public/static/locales/en/common.json"),
      ];

      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          translationPath = possiblePath;
          break;
        }
      }

      if (!translationPath) {
        console.error("Could not find translation file, tried paths:", possiblePaths);
        throw new Error("Translation file not found");
      }

      const translationData = fs.readFileSync(translationPath, "utf8");
      translations = JSON.parse(translationData);
    } else {
      // In production, use HTTP fetch
      const res = await fetch(`${WEBAPP_URL}/static/locales/en/common.json`, {
        cache: "force-cache",
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch fallback translations: ${res.status}`);
      }

      translations = await res.json();
    }

    translationCache.set(cacheKey, translations);
    return translations;
  } catch (error) {
    console.error("Could not load fallback translations:", error);
    return {};
  }
}

/**
 * Loads translations for a specific locale and namespace with optimized caching
 * @param {string} _locale - The locale code (e.g., 'en', 'fr', 'zh')
 * @param {string} ns - The namespace for the translations
 * @returns {Promise<Record<string, string>>} Translations object or fallback translations on failure
 */
export async function loadTranslations(_locale: string, ns: string) {
  const locale = _locale === "zh" ? "zh-CN" : _locale;
  const cacheKey = `${locale}-${ns}`;

  // Skip cache in development for fresh translations
  if (process.env.NODE_ENV !== "development" && translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  try {
    let translations;

    if (process.env.NODE_ENV === "development") {
      // In development, read directly from filesystem
      let translationPath;
      const cwd = process.cwd();

      // Try different path configurations
      const possiblePaths = [
        path.join(cwd, `public/static/locales/${locale}/${ns}.json`),
        path.join(cwd, `apps/web/public/static/locales/${locale}/${ns}.json`),
        path.join(cwd, `../web/public/static/locales/${locale}/${ns}.json`),
      ];

      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          translationPath = possiblePath;
          break;
        }
      }

      if (!translationPath) {
        throw new Error(`Translation file not found for ${locale}/${ns}`);
      }

      const translationData = fs.readFileSync(translationPath, "utf8");
      translations = JSON.parse(translationData);
    } else {
      // In production, use HTTP fetch
      const url = `${WEBAPP_URL}/static/locales/${locale}/${ns}.json`;
      const response = await fetch(url, {
        cache: "force-cache",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch translations: ${response.status}`);
      }

      translations = await response.json();
    }

    translationCache.set(cacheKey, translations);
    return translations;
  } catch (error) {
    console.warn(`Failed to load translations for ${locale}/${ns}, falling back to English:`, error);
    const fallbackTranslations = await loadFallbackTranslations();
    return fallbackTranslations;
  }
}

/**
 * Creates or retrieves a cached i18next translation function for the specified locale and namespace
 * @param {string} locale - The locale code (e.g., 'en', 'fr')
 * @param {string} ns - The namespace for the translations
 * @returns {Promise<Function>} A translation function bound to the specified locale and namespace
 */
export const getTranslation = async (locale: string, ns: string) => {
  const cacheKey = `${locale}-${ns}`;
  if (i18nInstanceCache.has(cacheKey)) {
    return i18nInstanceCache.get(cacheKey).getFixedT(locale, ns);
  }

  const resources = await loadTranslations(locale, ns);

  const _i18n = createInstance();
  _i18n.init({
    lng: locale,
    resources: {
      [locale]: {
        [ns]: resources,
      },
    },
    fallbackLng: "en",
  });

  // Cache the i18n instance
  i18nInstanceCache.set(cacheKey, _i18n);
  return _i18n.getFixedT(locale, ns);
};
