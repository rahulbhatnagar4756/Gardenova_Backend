import translate from "google-translate-api-x";
import { translationCache } from "../../core/middleware/translationMiddleware";

/**
 * Translates a given text into the specified target language.
 *
 * @param {string} text - The text to translate.
 * @param {string} targetLang - The language code to translate the text into (e.g., 'pt' for Portuguese).
 * @returns {Promise<string>} A promise that resolves to the translated text.
 */
export const translateText = async (
  text: string,
  targetLang: string
): Promise<string> => {
  const cacheKey = `${text}:${targetLang}`;
  const cached = translationCache.get<string>(cacheKey);
  if (cached) return cached;

  try {
    const result = await translate(text, { from: "auto", to: targetLang });
    translationCache.set(cacheKey, result.text);
    return result.text;
  } catch (err) {
    console.error(`Translation failed for "${text}" →`, err);
    return text;
  }
};

/**
 * Recursively translates all string values in a mixed object into the specified target language.
 *
 * @template T
 * @param {T} obj - The object containing strings (and possibly nested objects or arrays) to translate.
 * @param {string} targetLang - The target language code (e.g., 'pt' for Portuguese).
 * @returns {Promise<T>} A promise that resolves to a new object with translated string values.
 */
export const translateObject = async <T>(
  obj: T,
  targetLang: string
): Promise<T> => {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    const translatedArray = await Promise.all(
      obj.map((item) => translateObject(item, targetLang))
    );
    return translatedArray as T;
  }

  if (typeof obj === "object") {
    const translatedObj: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      const value = (obj as Record<string, unknown>)[key];
      translatedObj[key] = await translateObject(value, targetLang);
    }
    return translatedObj as T;
  }

  if (typeof obj === "string" && obj.trim().length > 0) {
    let translated = await translateText(obj, targetLang);
    translated = applyWordMappings(translated);
    return toTitleCase(translated) as T;
  }

  return obj;
};

/**
 * Converts specific translated words to standardized terms.
 * Example: "Wide" -> "Ample"
 *
 * @param {string} str - The translated string.
 * @returns {string} The normalized string with applied mappings.
 */
const applyWordMappings = (str: string): string => {
  const mappings: Record<string, string> = {
    wide: "Ample",
  };

  const lower = str.trim().toLowerCase();
  return mappings[lower] ?? str;
};

/**
 * Converts a string to Title Case.
 * Example: "home garden" -> "Home Garden"
 *
 * @param {string} str - The input string to convert.
 * @returns {string} The string converted to title case.
 */
const toTitleCase = (str: string): string => {
  return str
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};
