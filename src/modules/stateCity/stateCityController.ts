import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../../core/utils/constants";
import {
  errorResponse,
  successResponse,
} from "../../core/utils/responseFormatter";
import { CustomError } from "../../interface/Error";
import config from "../../core/config/env";
import { City, Country, State } from "../../interface/stateCity";
import { makeCSCRequest } from "../../core/services/stateCityService";
import NodeCache from "node-cache";
import { error as logError, warn } from "../../core/utils/logger";

/**
 * Node-cache instance for location data with 30-day TTL
 */
export const locationCache = new NodeCache({
  stdTTL: 2592000, // 30 days in seconds
  checkperiod: 600, // Check for expired keys every 10 minutes
  useClones: false, // Better performance, don't clone objects
});

/**
 * Cache statistics for monitoring
 * @returns Cache statistics object
 */
export const getCacheStats = (): NodeCache.Stats => locationCache.getStats();

/**
 * Retrieves all states for a specific country by ISO2 code.
 * @param req
 * @param res
 * @param next
 */
export const getStatesByCountry = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();
  const iso2 = "IN";
  const cacheKey = `states:${iso2}`;

  try {
    if (!config.CSC_API_KEY) {
      await logError(
        "CSC API key not configured",
        {
          endpoint: "getStatesByCountry",
        },
        { req, source: "state-city-controller" }
      );

      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          errorResponse("Server configuration error: CSC API key not found")
        );
      return;
    }

    // Try to get from cache
    let states = locationCache.get<State[]>(cacheKey);

    if (!states) {
      states = await makeCSCRequest<State[]>(`/countries/${iso2}/states`);
      states.sort((a, b) =>
        a.name.localeCompare(b.name, "en", { sensitivity: "base" })
      );

      // Store in cache
      locationCache.set(cacheKey, states);
    }

    res.status(HTTP_STATUS.OK).json(
      successResponse({
        country: iso2,
        states: states.map((state) => ({
          name: state.name,
          iso2: state.iso2,
        })),
        count: states.length,
      })
    );
  } catch (err: unknown) {
    const duration = Date.now() - startTime;

    await logError(
      "Failed to fetch states",
      {
        iso2,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        duration,
      },
      { req, source: "state-city-controller" }
    );

    next(err);
  }
};

/**
 * Retrieves all countries available in the CSC API.
 * @param req
 * @param res
 * @param next
 */
export const getCountries = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();
  const cacheKey = "countries:all";

  try {
    // Check if API key is available
    if (!config.CSC_API_KEY) {
      await logError(
        "CSC API key not configured",
        {
          endpoint: "getCountries",
        },
        { req, source: "state-city-controller" }
      );

      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          errorResponse("Server configuration error: CSC API key not found")
        );
      return;
    }

    // Try to get from cache
    let countries = locationCache.get<Country[]>(cacheKey);

    if (!countries) {
      countries = await makeCSCRequest<Country[]>(`/countries`);

      // Sort countries alphabetically by name (case-insensitive)
      countries.sort((a, b) =>
        a.name.localeCompare(b.name, "en", { sensitivity: "base" })
      );

      // Store in cache
      locationCache.set(cacheKey, countries);
    }

    res.status(HTTP_STATUS.OK).json(
      successResponse({
        countries,
        count: countries.length,
      })
    );
  } catch (err: unknown) {
    const duration = Date.now() - startTime;

    // Type guard to safely convert unknown to CustomError
    const errorObj: CustomError =
      err instanceof Error
        ? (err as CustomError)
        : ({
          name: "UnknownError",
          message:
            typeof err === "string" ? err : "An unknown error occurred",
        } as CustomError);

    await logError(
      "Failed to fetch countries",
      {
        error: errorObj.message,
        stack: errorObj.stack,
        duration,
      },
      { req, source: "state-city-controller" }
    );

    next(errorObj);
  }
};

/**
 * Retrieves all cities for a specific state by country ISO2 and state ISO2 codes.
 * @param req
 * @param res
 * @param next
 */
export const getCitiesByState = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();
  const { iso2, stateIso2 } = req.params;
  const cacheKey = `cities:${iso2}:${stateIso2}`;
  const search = (req.query.search as string | undefined)?.toLowerCase().trim(); // 👈


  try {
    if (!config.CSC_API_KEY) {
      await logError(
        "CSC API key not configured",
        {
          endpoint: "getCitiesByState",
          iso2,
          stateIso2,
        },
        { req, source: "state-city-controller" }
      );

      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          errorResponse("Server configuration error: CSC API key not found")
        );
      return;
    }

    // Try to get from cache
    let cities = locationCache.get<City[]>(cacheKey);

    if (!cities) {
      cities = await makeCSCRequest<City[]>(
        `/countries/${iso2}/states/${stateIso2}/cities`
      );
      // converted city id string to Number....
      cities = cities.map((city) => ({
        ...city,
        id: Number(city.id),
      }));

      cities.sort((a, b) =>
        a.name.localeCompare(b.name, "en", { sensitivity: "base" })
      );

      // Store in cache
      locationCache.set(cacheKey, cities);
    }

     const filtered = search
      ? cities.filter((city) =>
          city.name.toLowerCase().startsWith(search) // startsWith = better autocomplete UX
        )
      : cities;


    res.status(HTTP_STATUS.OK).json(
      successResponse({
        country: iso2,
        state: stateIso2,
        cities: filtered,
        count: filtered.length,
        ...(search && { query: search }),
      })
    );
  } catch (err: unknown) {
    const duration = Date.now() - startTime;

    if (typeof err === "object" && err !== null && "status" in err) {
      const apiError = err as { status: number; message: string };

      if (apiError.status === 404) {
        await warn(
          "Cities not found",
          {
            iso2,
            stateIso2,
            status: 404,
            duration,
          },
          { req, source: "state-city-controller" }
        );

        res
          .status(HTTP_STATUS.NOT_FOUND)
          .json(
            errorResponse(
              `No cities found for state: ${stateIso2} in country: ${iso2}`
            )
          );
        return;
      }

      await logError(
        "API error while fetching cities",
        {
          iso2,
          stateIso2,
          status: apiError.status,
          error: apiError.message,
          duration,
        },
        { req, source: "state-city-controller" }
      );

      res
        .status(apiError.status)
        .json(errorResponse(apiError.message || "Failed to fetch cities"));
      return;
    }

    await logError(
      "Failed to fetch cities",
      {
        iso2,
        stateIso2,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        duration,
      },
      { req, source: "state-city-controller" }
    );

    next(err);
  }
};
