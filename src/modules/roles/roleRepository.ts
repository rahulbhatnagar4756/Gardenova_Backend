import { ZodError } from "zod";
import { createRoleDto } from "../../dto/roleDto";
import { getDB } from "../../core/config/db";
import { IRole } from "../../interface/user";

/**
 * Retrieves all roles from the database.
 * @returns An array of roles (id, name, description).
 */
export async function getAllRoles(): Promise<IRole[]> {
  const client = await getDB();

  const query = `
    SELECT id, name, description
    FROM roles
    ORDER BY created_at DESC;
  `;

  const result = await client.query<IRole>(query);
  return result.rows;
}

/**
 * Deletes a role by its ID.
 * @param roleId The ID of the role to delete.
 * @returns True if a role was deleted, otherwise false.
 */
export async function deleteRoleById(roleId: string): Promise<boolean> {
  const client = await getDB();

  const query = `
    DELETE FROM roles
    WHERE id = $1
    RETURNING id;
  `;

  const result = await client.query<{ id: string }>(query, [roleId]);
  return result.rowCount! > 0;
}

/**
 * Finds a role by its ID.
 * @param roleId The ID of the role to find.
 * @returns The role object if found, otherwise null.
 */
export async function findRoleById(roleId: string): Promise<IRole | null> {
  const client = await getDB();

  const query = `
    SELECT id, name, description
    FROM roles
    WHERE id = $1
    LIMIT 1;
  `;

  const result = await client.query<IRole>(query, [roleId]);
  return result.rows.length > 0 ? result.rows[0]! : null;
}

/**
 * Checks if a role with the given name already exists in the database.
 * @param name - The role name to check.
 * @returns The role ID if it exists, otherwise null.
 */
export async function findRoleByName(name: string): Promise<string | null> {
  const client = await getDB();

  const query = `
    SELECT id
    FROM roles
    WHERE name = $1
    LIMIT 1;
  `;

  const result = await client.query<{ id: string }>(query, [name]);

  // Return the ID if found, else null
  return result.rows.length > 0 ? result.rows[0]!.id : null;
}
/**
 * Creates a new role after validating with Zod.
 * @param data - Unvalidated input data
 * @returns The created role record
 */
export async function createValidatedRole(data: unknown): Promise<IRole> {
  try {
    // Validate incoming data
    const parsedData = createRoleDto.parse(data);

    // Connect to PostgreSQL
    const client = await getDB();

    // Insert record
    const insertQuery = `
      INSERT INTO roles (name, description)
      VALUES ($1, $2)
      RETURNING id, name, description, created_at;
    `;
    const values = [parsedData.name, parsedData.description ?? null];

    const result = await client.query(insertQuery, values);
    const row = result.rows[0];

    // Convert created_at to ISO string
    const formattedResult = {
      ...row,
      created_at: row.created_at
        ? new Date(row.created_at).toISOString()
        : null,
    };

    return formattedResult;
  } catch (err) {
    if (err instanceof ZodError) throw err;
    throw new Error(`Database error: ${(err as Error).message}`);
  }
}

/**
 * Updates a role after validating with Zod.
 * @param roleId - The role's UUID
 * @param data - Unvalidated update data
 * @returns The updated role or null if not found
 */
export async function updateValidatedRole(
  roleId: string,
  data: unknown
): Promise<IRole | null> {
  try {
    // Validate data (ensures same schema rules)
    const parsedData = createRoleDto.parse(data);

    // Connect to DB
    const client = await getDB();

    // Update query
    const updateQuery = `
      UPDATE roles
      SET name = $1,
          description = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, name, description, updated_at;
    `;
    const values = [parsedData.name, parsedData.description ?? null, roleId];

    const result = await client.query(updateQuery, values);

    const row = result.rows.length > 0 ? result.rows[0] : null;

    // Convert updated_at to ISO string
    const formattedResult = {
      ...row,
      updated_at: row.updated_at
        ? new Date(row.updated_at).toISOString()
        : null,
    };

    return formattedResult;
  } catch (err) {
    if (err instanceof ZodError) throw err;
    throw new Error(`Database error: ${(err as Error).message}`);
  }
}
