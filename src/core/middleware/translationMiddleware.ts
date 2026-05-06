import { Request, Response, NextFunction } from "express";
import translate from "google-translate-api-x";
import NodeCache from "node-cache";
import {
  JsonResponseBody,
  TranslatableObject,
  TranslatableValue,
} from "../../interface/translation";

export const translationCache = new NodeCache({ stdTTL: 86400 }); // Cache for 24 hours


/**
 * Check if a key should be excluded from translation
 * @param {string} key - The key to check
 * @returns {boolean} - Returns true if the key should be skipped, otherwise false
 */
function shouldSkipKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
 
  const skipFields = [
    "token",
    "accesstoken",
    "refreshtoken",
    "jwt",
    "apikey",
    "api_key",
    "password",
    "hash",
    "secret",
    "key",
    "authorization",
    "bearer",
    "email",
    "phone",
    "phonenumber",
    "mobile",
    "url",
    "uri",
    "link",
    "path",
    "endpoint",
    "code",
    "verificationcode",
    "otp",
    "pin",
    "success",
    // "name",
    "is_healthy",
    "is_plant",
    "isplant",
    "ishealthy",
    "watering_notification_enabled",
    "fertilizer_notification_enabled",
    "pruning_notification_enabled",
    // "generic_care_notification_enabled",
    "generic_notification_enabled",
    "next_watered_at",
    "next_fertilized_at",
    "next_pruned_at",
    "next_generic_care_at",
    "created_at",
    "updated_at",
    "startdate",
    "enddate",
    "appear_in_search",
    "premium_profile_badge",
    "priority_customer_support",
    "highlight_in_result",
    "verification_badge",
    "rating",
    "edible",
    "tropical",
    "indoor",
    "poisonous_to_humans",
    "poisonous_to_pets",
    "drought_tolerant",
    "added_at",
  ];
 
  if (skipFields.some((field) => lowerKey.includes(field))) {
    return true;
  }
 
  // More precise ID matching - only skip if it's clearly an ID field
  return (
    key === "id" ||
    key === "ID" ||
    key === "_id" ||
    lowerKey.endsWith("_id") ||
    (lowerKey.endsWith("id") &&
      (lowerKey.length <= 4 || /[^a-z]id$/.test(lowerKey))) ||
    /^id[^a-z]/i.test(key) // Matches "id123", "idUser", etc.
  );
}

/**
 * Check if a string looks like a GUID/UUID, ID, token, email, or URL
 * @param {string} str - The string to check
 * @returns {boolean} - Returns true if the string resembles an identifier-like value, otherwise false
 */
function looksLikeId(str: string): boolean {
  // MongoDB ObjectId (24 hex characters)
  if (/^[a-f0-9]{24}$/i.test(str)) return true;

  // UUID/GUID
  if (
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(str)
  )
    return true;

  // Numeric ID
  if (/^\d+$/.test(str)) return true;

  // JWT token pattern (three base64 segments separated by dots)
  if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(str)) return true;

  // Generic token pattern (long alphanumeric string)
  if (str.length > 30 && /^[A-Za-z0-9_-]+$/.test(str)) return true;

  // Email pattern
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) return true;

  // URL pattern
  if (/^(https?:\/\/|www\.)/i.test(str)) return true;

  return false;
}

/**
 * Detect the language of a text string using the translation API
 * @param text - Text to detect language
 * @returns Language code (e.g., 'en', 'pt', 'es') or null if detection fails
 */
export async function detectLanguage(text: string): Promise<string | null> {
  try {
    // Use translation API to detect language
    const result = await translate(text, { from: "auto", to: "en" });
    return result.from?.language?.iso || null;
  } catch (err) {
    console.error(`Error detecting language for: "${text}"`, err);
    return null;
  }
}

/**
 * Translate with caching and language detection
 * @param {string} text - The text to be translated
 * @param {string} targetLang - The target language code (e.g., "en", "fr")
 * @returns {Promise<string>} - Resolves to the translated text (or original text if skipped or on error)
 */
async function translateWithCache(
  text: string,
  targetLang: string
): Promise<string> {
  const cacheKey = `${text}:${targetLang}`;

  // Check cache first
  const cached = translationCache.get<string>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Detect the source language
    const detectedLang = await detectLanguage(text);

    // If the detected language matches the target language, return original text
    if (detectedLang === targetLang) {
      console.error(
        `Skipping translation: Text is already in target language (${targetLang})`
      );
      translationCache.set(cacheKey, text); // Cache the original text
      return text;
    }

    // If target is English and text is already in English, skip translation
    if (targetLang === "en" && detectedLang === "en") {
      translationCache.set(cacheKey, text);
      return text;
    }

    // Perform translation
    const result = await translate(text, {
      from: detectedLang || "auto",
      to: targetLang,
    });

    // Store in cache
    translationCache.set(cacheKey, result.text);
    return result.text;
  } catch (err) {
    console.error(`Error translating: "${text}"`, err);
    return text;
  }
}

/**
 * Translate boolean values dynamically
 * @param {boolean} value - The boolean value to translate
 * @param {string} targetLang - The target language code (e.g., "en", "fr")
 * @returns {Promise<string>} - Resolves to the translated boolean string
 */
async function translateBoolean(
  value: boolean,
  targetLang: string
): Promise<string> {
  const booleanString = value ? "true" : "false";
  return await translateWithCache(booleanString, targetLang);
}

/**
 * Recursively translates all string values in an object or array
 * @param {TranslatableValue} obj - The object, array, or primitive value to translate
 * @param {string} targetLang - The target language code
 * @param {string} [parentKey] - Optional parent key to evaluate skip rules
 * @returns {Promise<TranslatableValue>} - The translated object, array, or primitive value
 */
async function translateObject(
  obj: TranslatableValue,
  targetLang: string,
  parentKey?: string
): Promise<TranslatableValue> {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "boolean") {
    return await translateBoolean(obj, targetLang);
  }

  if (Array.isArray(obj)) {
    return Promise.all(
      obj.map((item) => translateObject(item, targetLang, parentKey))
    );
  }

  if (typeof obj === "object") {
    const translatedObj: TranslatableObject = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (shouldSkipKey(key)) {
          translatedObj[key] = obj[key];
        } else {
          translatedObj[key] = await translateObject(obj[key], targetLang, key);
        }
      }
    }
    return translatedObj;
  }

  if (typeof obj === "string" && obj.trim().length > 0) {
    if (parentKey && shouldSkipKey(parentKey)) {
      return obj;
    }
    if (looksLikeId(obj)) {
      return obj;
    }
    return await translateWithCache(obj, targetLang);
  }

  return obj;
}

/**
 * Middleware that intercepts res.json responses and translates
 * all text content based on the Accept-Language header
 * @param {string} [defaultLang="pt"] - Default language to translate into when no Accept-Language header is provided
 * @returns {(req: Request, res: Response, next: NextFunction) => void} - Express middleware function
 */
function translationMiddleware(defaultLang: string = "pt") {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.path.startsWith("/api/v1/stateCityData")) {
      return next(); // skip translation for these routes
    }
    const originalJson = res.json.bind(res);

    res.json = (async (body: JsonResponseBody) => {
      try {
        const acceptLang = (req.headers["accept-language"] as string) || "";
        let targetLang = defaultLang;

        if (acceptLang) {
          const primaryLang = acceptLang.split(",")[0]?.trim();
          const langCode = primaryLang?.split("-")[0]?.toLowerCase();
          targetLang = langCode || defaultLang;
        }
        if ( typeof body === "object" && body !== null) {
          const translatedBody = await translateObject(
            body as TranslatableValue,
            targetLang
          );
          return originalJson(translatedBody as JsonResponseBody);
        }

        return originalJson(body);
      } catch (err) {
        console.error("Error translating:", err);
        return originalJson(body);
      }
    }) as unknown as Response["json"];

    next();
  };
}

export default translationMiddleware;
