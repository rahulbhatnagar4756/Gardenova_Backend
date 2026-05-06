import { ZodError } from "zod";
import { IPartnerProfile } from "../../interface/answer";
import { getDB } from "../../core/config/db";
import { createPartnerProfileDto } from "../../dto/partnerProfileDto";
import { RawPartnerProfileInput } from "../../interface/partnerProfile";
import { getSignedFileUrl } from "../../core/services/s3UploadService";

/**
 * Updates an existing partner profile in the database.
 * Accepts partial fields to update and optionally updates the project image URL.
 *
 * @param id - The unique identifier of the partner profile to update.
 * @param data - Partial partner profile fields that should be updated.
 * @param projectImageUrl - The new project image URL to save with the profile.
 */
export const updatePartnerProfileDb = async (
  id: string,
  data: RawPartnerProfileInput,
  projectImageUrl: string
): Promise<void> => {
  const client = await getDB();

  // Map incoming data (flatten + handle arrays)
  const mappedData = {
    mobile_number: data.mobileNumber ?? null,
    company_name: data.companyName ?? null,
    speciality_1: data.speciality?.[0] ?? null,
    speciality_2: data.speciality?.[1] ?? null,
    speciality_3: data.speciality?.[2] ?? null,
    street: data.address?.street ?? null,
    city: data.address?.city ?? null,
    state: data.address?.state ?? null,
    country: data.address?.country ?? null,
    zip_code: data.address?.zipCode ?? null,
    website: data.website ?? null,
    contact_person: data.contactPerson ?? null,
    status: data.status ?? null,
    email: data.email ?? null,
  };

  await client.query(
    `
    UPDATE partner_profiles SET
      mobile_number=$1,
      company_name=$2,
      speciality_1=$3,
      speciality_2=$4,
      speciality_3=$5,
      street=$6,
      city=$7,
      state=$8,
      country=$9,
      zip_code=$10,
      website=$11,
      contact_person=$12,
      project_image_url=$13,
      status=$14,
      email=$15,
      updated_at = NOW()
    WHERE id=$16
    `,
    [
      mappedData.mobile_number,
      mappedData.company_name,
      mappedData.speciality_1,
      mappedData.speciality_2,
      mappedData.speciality_3,
      mappedData.street,
      mappedData.city,
      mappedData.state,
      mappedData.country,
      mappedData.zip_code,
      mappedData.website,
      mappedData.contact_person,
      projectImageUrl,
      mappedData.status,
      mappedData.email,
      id,
    ]
  );
};

/**
 * Retrieves a partner profile record from the database by its unique ID.
 *
 * @param id - The unique identifier of the partner profile to fetch.
 * @returns The partner profile data if found, otherwise null.
 */
export const getPartnerProfileById = async (
  id: string
): Promise<IPartnerProfile | null> => {
  const client = await getDB();
  const { rows } = await client.query(
    `SELECT * FROM partner_profiles WHERE id = $1`,
    [id]
  );

  return rows.length > 0 ? (rows[0] as IPartnerProfile) : null;
};

/**
 * Retrieves all partner profiles from the database.
 *
 * @param limit
 * @param offset
 * @returns A list of all partner profile records.
 */
export const getAllPartnerProfilesDb = async (
  limit: number,
  offset: number
): Promise<{ profiles: RawPartnerProfileInput[]; totalCount: number }> => {
  const client = await getDB();

  // Get paginated profiles
  const result = await client.query(
    `
    SELECT 
      id,
      email,
      mobile_number,
      company_name,
      speciality_1,
      speciality_2,
      speciality_3,
      street,
      city,
      state,
      country,
      zip_code,
      website,
      contact_person,
      project_image_url,
      rating,
      status
    FROM partner_profiles
   ORDER BY created_at ASC
    LIMIT $1 OFFSET $2
  `,
    [limit, offset]
  );

  // Get total record count for pagination
  const countResult = await client.query(
    `SELECT COUNT(*) FROM partner_profiles`
  );
  const totalCount = parseInt(countResult.rows[0].count, 10);

  // Format results
  const formatted = await Promise.all(
    result.rows.map(async (row) => ({
      id: row.id,
      email: row.email,
      mobileNumber: row.mobile_number,
      companyName: row.company_name,
      speciality: [row.speciality_1, row.speciality_2, row.speciality_3].filter(
        Boolean
      ),
      address: {
        street: row.street,
        city: row.city,
        state: row.state,
        country: row.country,
        zipCode: row.zip_code,
      },
      website: row.website,
      contactPerson: row.contact_person,
      projectImageUrl: (await getSignedFileUrl(row.project_image_url)) || "",
      status: row.status,
      rating: row.rating,
    }))
  );

  return { profiles: formatted, totalCount };
};

/**
 * Retrieves a partner profile from the database using the provided email address.
 *
 * @param email - The email address of the partner profile to look up.
 * @returns The matching partner profile if found, otherwise null.
 */
export const findPartnerProfileByEmail = async (
  email: string
): Promise<IPartnerProfile | null> => {
  const client = await getDB();
  const result = await client.query(
    `SELECT * FROM partner_profiles WHERE email = $1 LIMIT 1`,
    [email]
  );
  return (result.rows[0] as IPartnerProfile) ?? null;
};

/**
 * Create a new partner profile.
 *
 * @param data - Unvalidated input data
 * @returns The created partner profile record
 * @throws ZodError if validation fails
 */
export const createPartnerProfile = async (
  data: RawPartnerProfileInput
): Promise<IPartnerProfile> => {
  const client = await getDB();

  try {
    // Transform input to match DTO
    const transformedData = {
      email: data.email,
      mobileNumber: data.mobileNumber,
      companyName: data.companyName,
      speciality1: data.speciality?.[0],
      speciality2: data.speciality?.[1],
      speciality3: data.speciality?.[2],
      street: data.address?.street,
      city: data.address?.city,
      state: data.address?.state,
      country: data.address?.country,
      zipCode: data.address?.zipCode,
      website: data.website,
      contactPerson: data.contactPerson,
      projectImageUrl: data.projectImageUrl,
      status: data.status,
      rating: data.rating || 0.0,
    };

    // Validate after mapping
    const parsed = createPartnerProfileDto.parse(transformedData);

    // Insert into DB
    const result = await client.query(
      `
      INSERT INTO partner_profiles (
        email, mobile_number, company_name,
        speciality_1, speciality_2, speciality_3,
        street, city, state, country, zip_code,
        website, contact_person, project_image_url,
        status, rating
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *;
      `,
      [
        parsed.email,
        parsed.mobileNumber,
        parsed.companyName ?? null,
        parsed.speciality1 ?? null,
        parsed.speciality2 ?? null,
        parsed.speciality3 ?? null,
        parsed.street ?? null,
        parsed.city ?? null,
        parsed.state ?? null,
        parsed.country ?? null,
        parsed.zipCode ?? null,
        parsed.website ?? null,
        parsed.contactPerson ?? null,
        parsed.projectImageUrl ?? null,
        parsed.status ?? "pending",
        parsed.rating ?? null,
      ]
    );

    return result.rows[0] as IPartnerProfile;
  } catch (err) {
    if (err instanceof ZodError) {
      console.error("Validation error:", err.issues);
      throw err;
    }
    throw err;
  }
};

/**
 * Update the rating of an existing partner profile.
 *
 * @param profileId - The profile's UUID
 * @param rating - Rating value (0–5)
 * @returns The updated partner profile or null if not found
 * @throws Error if rating is out of range
 */
export const updateRating = async (
  profileId: string,
  rating: number
): Promise<IPartnerProfile | null> => {
  const client = await getDB();

  if (rating < 0 || rating > 5) {
    throw new Error("Rating must be between 0 and 5");
  }

  const result = await client.query(
    `
    UPDATE partner_profiles
    SET rating = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *;
    `,
    [profileId, rating]
  );

  return (result.rows[0] as IPartnerProfile) ?? null;
};

/**
 * Updates the status of a partner profile by its ID.
 *
 * @param {string} profileId - The unique ID of the partner profile to update.
 * @param {string} status - The new status to assign (e.g., "pending", "approved", "rejected", "inactive").
 * @returns {Promise<IPartnerProfile | null>} The updated partner profile record, or null if not found.
 */
export const updatePartnerStatus = async (
  profileId: string,
  status: string
): Promise<IPartnerProfile | null> => {
  const client = await getDB();

  const validStatuses = ["pending", "active", "suspended", "inactive"];

  if (!validStatuses.includes(status.toLowerCase())) {
    throw new Error(
      `Invalid status. Allowed values are: ${validStatuses.join(", ")}`
    );
  }

  const result = await client.query(
    `
    UPDATE partner_profiles
    SET status = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *;
    `,
    [profileId, status]
  );

  return (result.rows[0] as IPartnerProfile) ?? null;
};

/**
 * Deletes a partner profile record from the database by its unique ID.
 *
 * @param id - The unique identifier of the partner profile to delete.
 * @returns The number of records deleted (0 means no record was found).
 */
export const deletePartnerProfileDb = async (id: string): Promise<number> => {
  const client = await getDB();
  const { rowCount } = await client.query(
    `DELETE FROM partner_profiles WHERE id=$1`,
    [id]
  );

  return rowCount!; // always a number
};
