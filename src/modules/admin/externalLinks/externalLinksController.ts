import { Response, NextFunction } from "express";
import { AuthRequest } from "../../../interface/auth";
import { AuthUserPayload } from "../../../interface/user";
import { HTTP_STATUS } from "../../../core/utils/constants";
import { errorResponse, successResponse } from "../../../core/utils/responseFormatter";
import { findUserByEmail } from "../../auth/authRepository";
import { createExternalLinks, deleteExternalLinkById, fetchExternalLinksFromDB, updateExternalLink, updateStatusInDb } from "./externalLinksModal";
import { ZodError } from "zod";
import NodeCache from "node-cache";


/**
 * Application-level in-memory cache
 * Used to cache frequently accessed data like external links
 */
export const appCache = new NodeCache({
    stdTTL: 600,        // 10 minutes
    checkperiod: 120,
    useClones: false
});

/**
 * Cache key constants
 */
export const CACHE_KEYS = {
    EXTERNAL_LINKS: "external_links"
};

/**
 * Creates a new external link.
 *
 * Access: Admin only
 *
 * @param req - Express request with authenticated user and link data
 * @param res - Express response
 * @param next - Express next middleware function
 *
 * @returns HTTP 201 on success
 */
export const createExternalLinksTable = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const userPayload = req.user as AuthUserPayload | undefined;

    if (!userPayload?.userEmail) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
        return;
    }

    const user = await findUserByEmail(userPayload.userEmail);
    if (!user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("User not found"));
        return;
    }

    if (userPayload.role !== "Admin") {
        res
            .status(HTTP_STATUS.UNAUTHORIZED)
            .json(errorResponse("Unauthorized Role"));
        return;
    }

    try {
        const { title, url, is_active } = req.body; // Removed 'key'
        
        // Logic to create external link entry in the database
        await createExternalLinks(
            title,
            url ?? null,
            is_active // Removed 'key'
        );

        appCache.del(CACHE_KEYS.EXTERNAL_LINKS); // Invalidate cache    
        res.status(201).json(successResponse(null, "External link created successfully") );

    } catch (err) {
        if (err instanceof ZodError) {
            res.status(HTTP_STATUS.BAD_REQUEST).json({ errors: err.issues });
            return;
        }
        console.error("Failed to create external link:", err);
        next(err);
    }
};

/**
 * Fetches all external links.
 *
 * Uses in-memory cache for faster response.
 * If cache is available, data is returned from cache.
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next middleware function
 *
 * @returns HTTP 200 with external links list
 */
export const getExternalLinks = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const cachedLinks = appCache.get(CACHE_KEYS.EXTERNAL_LINKS);
        if (cachedLinks) {
            res.status(HTTP_STATUS.OK).json(
                successResponse({ links: cachedLinks }, "External links retrieved from cache")
            );
            return;
        }
        const links = await fetchExternalLinksFromDB();

        //  Store in cache
        appCache.set(CACHE_KEYS.EXTERNAL_LINKS, links);

        // Send response
        res.status(HTTP_STATUS.OK).json(
            successResponse(
                { links },
                "External links retrieved successfully"
            )
        );


    } catch (err) {
        console.error("Cache retrieval error:", err);
        next(err);
    }
}


/**
 * Updates an existing external link.
 * Only provided fields will be updated.
 *
 * Access: Admin only
 *
 * @param req - Express request containing link ID and update fields
 * @param res - Express response
 * @param next - Express next middleware function
 *
 * @returns HTTP 200 if update succeeds
 */
export const updateLinks = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userPayload = req.user as AuthUserPayload | undefined;

    // Auth check
    if (!userPayload?.userEmail) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
      return;
    }

    const user = await findUserByEmail(userPayload.userEmail);
    if (!user || userPayload.role !== "Admin") {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized Role"));
      return;
    }

    // Input
    const { id, title, url, is_active } = req.body;

    if (!id) {
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("External link id is required"));
      return;
    }

    // Update DB
    const updated = await updateExternalLink(id, title, url, is_active);

    if (!updated) {
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse("External link not found"));
      return;
    }

    // Clear cache
    appCache.del(CACHE_KEYS.EXTERNAL_LINKS);

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(null, "External link updated successfully"));
  } catch (err) {
    console.error("Failed to update external link:", err);
    next(err);
  }
};

/**
 * Deletes an external link by ID.
 *
 * Access: Admin only
 *
 * @param req - Express request containing link ID in params
 * @param res - Express response
 * @param next - Express next middleware function
 *
 * @returns HTTP 200 if deletion succeeds
 */
export const deleteExternalLink = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userPayload = req.user as AuthUserPayload | undefined;

    // Auth check
    if (!userPayload?.userEmail) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
      return;
    }

    const user = await findUserByEmail(userPayload.userEmail);
    if (!user || userPayload.role !== "Admin") {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized Role"));
      return;
    }

    // Input
    const { id } = req.params;
    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("External link id is required"));
      return;
    }

    // Delete from DB
    const deleted = await deleteExternalLinkById(id);
    if (!deleted) {
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("External link not found"));
      return;
    }

    // Clear cache
    appCache.del(CACHE_KEYS.EXTERNAL_LINKS);

    res.status(HTTP_STATUS.OK).json(successResponse(null, "External link deleted successfully"));
  } catch (error) {
    console.error("Failed to delete external link:", error);
    next(error);
  }
};

/**
 * Updates status value by status ID.
 *
 * Access: Admin only
 *
 * @param req - Express request containing status ID and new status value
 * @param res - Express response
 * @param next - Express next middleware function
 *
 * @returns HTTP 200 with updated status object
 */
export const updateStatusById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userPayload = req.user as AuthUserPayload | undefined;

    // Auth check
    if (!userPayload?.userEmail) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized"));
      return;
    }

    const user = await findUserByEmail(userPayload.userEmail);
    if (!user || userPayload.role !== "Admin") {
      res.status(HTTP_STATUS.UNAUTHORIZED).json(errorResponse("Unauthorized Role"));
      return;
    }

    // Input validation
    const { id } = req.params;
    const { status } = req.body;
    if (!id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Status ID is required"));
      return;
    }
    if (!status) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse("Status value is required"));
      return;
    }

    // Update in DB
    const updatedStatus = await updateStatusInDb(id, status);
    if (!updatedStatus) {
      res.status(HTTP_STATUS.NOT_FOUND).json(errorResponse("Status not found"));
      return;
    }

    // Clear cache
    appCache.del(CACHE_KEYS.EXTERNAL_LINKS);

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(updatedStatus, "Status updated successfully"));
  } catch (error) {
    console.error("Failed to update status:", error);
    next(error);
  }
};
