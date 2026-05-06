import { Response, NextFunction } from "express";
import {
  createValidatedRole,
  deleteRoleById,
  findRoleById,
  findRoleByName,
  getAllRoles,
  updateValidatedRole,
} from "./roleRepository";
import {
  successResponse,
  errorResponse,
} from "../../core/utils/responseFormatter";
import { HTTP_STATUS, MESSAGES } from "../../core/utils/constants";
import { error, warn } from "../../core/utils/logger";
import { CustomError } from "../../interface/Error";
import { ZodError } from "zod";
import { findUserByEmail } from "../auth/authRepository";
import { AuthRequest } from "../../interface/auth";
import { AuthUserPayload } from "../../interface/user";

/**
 * Creates a new role in the system.
 *
 * Validates the authenticated user, checks for duplicate roles,
 * and creates a new role if it does not already exist.
 * Logs each step of the process for auditing and debugging.
 *
 * @param req - Express request object containing role data (`name`, `description`) in the body
 *              and the authenticated user in `req.user`.
 * @param res - Express response object used to send HTTP responses.
 * @param next - Express next middleware function used to handle errors.
 * @returns A promise that resolves with no value (`void`).
 */
export const createRole = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userPayload = req.user as AuthUserPayload | undefined;

  if (!userPayload?.userEmail) {
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized request"));
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
    const { name, description } = req.body;

    // Check if role already exists in PostgreSQL
    const existingRoleId = await findRoleByName(name);
    if (existingRoleId) {
      res.status(HTTP_STATUS.CONFLICT).json(errorResponse(MESSAGES.ROLE_EXIST));
      return;
    }

    // Create new role (validated using Zod internally)
    const newRole = await createValidatedRole({ name, description });

    res
      .status(HTTP_STATUS.CREATED)
      .json(successResponse(newRole, MESSAGES.ROLE_CREATED));
  } catch (err: unknown) {
    // Handle Zod validation errors
    if (err instanceof ZodError) {
      const formattedErrors = err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));

      await warn(
        "Role creation failed - validation errors",
        { errors: formattedErrors },
        { userId: user?.id!, source: "role.createRole", req }
      );

      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Validation failed",
        errors: formattedErrors,
      });
      return;
    }

    const errorObj: CustomError =
      err instanceof Error
        ? (err as CustomError)
        : {
            name: "UnknownError",
            message:
              typeof err === "string" ? err : "An unknown error occurred",
          };

    await error(
      "Role creation failed with unexpected error",
      { error: errorObj.message, stack: errorObj.stack, userId: user?.id! },
      { userId: user?.id!, source: "role.createRole", req }
    );
    next(errorObj);
  }
};

/**
 * Retrieves all roles.
 * @param req - Express request object containing role data (`name`, `description`) in the body
 *              and the authenticated user in `req.user`.
 * @param res - Express response object used to send HTTP responses.
 * @param next - Express next middleware function used to handle errors.
 */
export const getRoles = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Verify authentication
  const userPayload = req.user as AuthUserPayload | undefined;
  if (!userPayload?.userEmail) {
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized request"));
    return;
  }

  // Fetch user by email
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
    //  Connect to DB and fetch roles
    const roles = await getAllRoles();

    //  Send response without created_at or updated_at
    res.status(HTTP_STATUS.OK).json(successResponse(roles));
  } catch (err: unknown) {
    const errorObj: CustomError =
      err instanceof Error
        ? (err as CustomError)
        : ({
            name: "UnknownError",
            message:
              typeof err === "string" ? err : "An unknown error occurred",
          } as CustomError);

    await error(
      "Get all roles failed with unexpected error",
      { error: errorObj.message, stack: errorObj.stack },
      { userId: user.id!, source: "role.getRoles", req }
    );
    next(errorObj);
  }
};

/**
 * Update an existing role by ID.
 * @param req - Express request object containing role data (`name`, `description`) in the body
 *              and the authenticated user in `req.user`.
 * @param res - Express response object used to send HTTP responses.
 * @param next - Express next middleware function used to handle errors.
 */
export const updateRole = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const roleId = req.params.id;
  const updateData = req.body;

  // Authenticate user
  const userPayload = req.user as AuthUserPayload | undefined;
  if (!userPayload?.userEmail) {
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized request"));
    return;
  }

  //  Validate user existence
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
    // Check if role exists in PostgreSQL
    const existingRole = await findRoleById(roleId!);

    if (!existingRole) {
      await warn(
        "Role update failed - role not found",
        { roleId },
        { userId: user.id!, source: "role.updateRole", req }
      );

      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse(MESSAGES.ROLE_NOT_EXIST));
      return;
    }

    // Use validated update logic
    const updatedRole = await updateValidatedRole(roleId!, updateData);

    if (!updatedRole) {
      await warn(
        "Role update failed - could not update record",
        { roleId },
        { userId: user.id!, source: "role.updateRole", req }
      );

      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(errorResponse("Failed to update role"));
      return;
    }

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(updatedRole, MESSAGES.ROLE_UPDATED));
  } catch (err: unknown) {
    // Handle Zod validation errors
    if (err instanceof ZodError) {
      const formattedErrors = err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));

      await warn(
        "Role update failed - validation errors",
        { errors: formattedErrors, roleId },
        { userId: user.id!, source: "role.updateRole", req }
      );

      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Validation failed",
        errors: formattedErrors,
      });
      return;
    }

    // Catch-all error handling
    const errorObj: CustomError =
      err instanceof Error
        ? (err as CustomError)
        : {
            name: "UnknownError",
            message:
              typeof err === "string" ? err : "An unknown error occurred",
          };

    await error(
      "Role update failed with unexpected error",
      {
        roleId,
        updateData,
        error: errorObj.message,
        stack: errorObj.stack,
        userId: user.id!,
      },
      { userId: user.id!, source: "role.updateRole", req }
    );
    next(errorObj);
  }
};

/**
 * Delete a role by ID.
 * @param req - Express request object containing role data (`name`, `description`) in the body
 *              and the authenticated user in `req.user`.
 * @param res - Express response object used to send HTTP responses.
 * @param next - Express next middleware function used to handle errors.
 */
export const deleteRole = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const roleId = req.params.id;

  //  Validate authentication
  const userPayload = req.user as AuthUserPayload | undefined;
  if (!userPayload?.userEmail) {
    res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(errorResponse("Unauthorized request"));
    return;
  }

  // Verify user existence
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
    // Check if role exists
    const roleToDelete = await findRoleById(roleId!);

    if (!roleToDelete) {
      await warn(
        "Role deletion failed - role not found",
        { roleId },
        { userId: user.id!, source: "role.deleteRole", req }
      );

      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(errorResponse(MESSAGES.ROLE_NOT_EXIST));
      return;
    }

    // Delete the role
    await deleteRoleById(roleId!);

    res
      .status(HTTP_STATUS.OK)
      .json(successResponse(null, MESSAGES.ROLE_DELETED));
  } catch (err: unknown) {
    const errorObj: CustomError =
      err instanceof Error
        ? (err as CustomError)
        : {
            name: "UnknownError",
            message:
              typeof err === "string" ? err : "An unknown error occurred",
          };

    await error(
      "Role deletion failed with unexpected error",
      { roleId, error: errorObj.message, stack: errorObj.stack },
      { userId: user.id!, source: "role.deleteRole", req }
    );

    next(errorObj);
  }
};
