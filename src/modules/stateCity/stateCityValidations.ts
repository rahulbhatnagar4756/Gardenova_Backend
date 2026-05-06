import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../../core/utils/constants";
import { errorResponse } from "../../core/utils/responseFormatter";

/**
 * Simple validation middleware that only validates params (no query modification)
 */
export const statesValidation = {
  /**
   * Retrieves all states for a given country.
   *
   * @param req - Express request object containing parameters and query.
   * @param res - Express response object used to send back the data.
   * @param next - Express next function for error handling or passing control.
   */
  getStatesByCountry: (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const { iso2 } = req.params;

    // Check if iso2 is provided
    if (!iso2) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("ISO2 code is required"));
      return;
    }

    // Check if iso2 is exactly 2 characters
    if (iso2.length !== 2) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("ISO2 code must be exactly 2 characters long"));
      return;
    }

    // Check if iso2 contains only uppercase letters
    if (!/^[A-Z]{2}$/.test(iso2)) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(
          errorResponse(
            "ISO2 code must be 2 uppercase letters (e.g., IN, US, GB)"
          )
        );
      return;
    }

    next();
  },

  /**
   * Retrieves all cities for a specific state within a country.
   *
   * @param req - Express request object containing path parameters `iso2` (country code) and `stateIso2` (state code).
   * @param res - Express response object used to send back the list of cities.
   * @param next - Express next function for error handling or passing control to the next middleware.
   */
  getCitiesByState: (req: Request, res: Response, next: NextFunction): void => {
    const { iso2, stateIso2 } = req.params;

    // Check if iso2 is provided
    if (!iso2) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("Country ISO2 code is required"));
      return;
    }

    // Check if stateIso2 is provided
    if (!stateIso2) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("State ISO2 code is required"));
      return;
    }

    // Check if iso2 is exactly 2 characters
    if (iso2.length !== 2) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(
          errorResponse("Country ISO2 code must be exactly 2 characters long")
        );
      return;
    }

    // Check if stateIso2 is 2 characters (most common) or allow up to 4 for some regions
    if (stateIso2.length < 2 || stateIso2.length > 4) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(
          errorResponse("State ISO2 code must be between 2-4 characters long")
        );
      return;
    }

    // Check if iso2 contains only uppercase letters
    if (!/^[A-Z]{2}$/.test(iso2)) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(
          errorResponse(
            "Country ISO2 code must be 2 uppercase letters (e.g., IN, US, GB)"
          )
        );
      return;
    }

    // Check if stateIso2 contains only uppercase letters
    if (!/^[A-Z]{2,4}$/.test(stateIso2)) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(
          errorResponse(
            "State ISO2 code must be 2-4 uppercase letters (e.g., MH, KA, TN)"
          )
        );
      return;
    }

    next();
  },

  /**
   * Retrieves a list of all countries.
   *
   * @param req - Express request object.
   * @param res - Express response object used to send back the list of countries.
   * @param next - Express next function for error handling or passing control to the next middleware.
   */
  getCountries: (req: Request, res: Response, next: NextFunction): void => {
    // No validation needed for countries endpoint
    next();
  },
};
