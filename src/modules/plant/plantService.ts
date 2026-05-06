import { plantValidation, updatePlantValidation } from "./plantValidation";
import {
  createPlantRepo,
  getAllPlantsRepo,
  getPlantByIdRepo,
  updatePlantRepo,
  insertArrayRepo,
  insertLocationsRepo,
  softDeletePlantRepo,
  updateArrayRelation,
  updateLocationsRepo,
  getPlantById,
} from "./plantRepository";
import {
  deleteFileFromS3,
  uploadBase64ToS3,
} from "../../core/services/s3UploadService";
import { IPlant, PaginatedPlants } from "../../interface/plants";

/**
 * CREATE A NEW PLANT
 * Validates input, uploads image if needed, inserts plant + relations.
 *
 * @param rawData
 * @returns {Promise<{ plantId: string }>}
 */
export const createPlantService = async (
  rawData: unknown
): Promise<{ plantId: string }> => {
  const validated = await plantValidation.validateAsync(rawData);

  let imageUrl = validated.image_search_url;

  if (imageUrl && imageUrl.startsWith("data:image/")) {
    const fileName = `${validated.scientific_name.replace(/\s+/g, "_")}_${Date.now()}.jpg`;
    imageUrl = await uploadBase64ToS3(imageUrl, fileName, "Admin/PlantImages");
  }

  const plantId = await createPlantRepo({
    ...validated,
    image_search_url: imageUrl,
  } as IPlant);

  await insertArrayRepo(
    "plant_space_types",
    plantId,
    "space_type",
    validated.space_types
  );
  await insertArrayRepo(
    "plant_area_sizes",
    plantId,
    "area_size",
    validated.area_sizes
  );
  await insertArrayRepo(
    "plant_challenges",
    plantId,
    "challenge",
    validated.challenges
  );
  await insertArrayRepo(
    "plant_tech_preferences",
    plantId,
    "tech_preference",
    validated.tech_preferences
  );
  await insertArrayRepo(
    "plant_care_notes",
    plantId,
    "note",
    validated.care_notes
  );
  await insertLocationsRepo(plantId, validated.locations);

  return { plantId };
};

/**
 * GET ALL PLANTS
 * @param page
 * @param limit
 * @param search
 * @returns {Promise<IPlant[]>}
 */
export const getAllPlantsService = async (
  page: number,
  limit: number,
  search: string
): Promise<PaginatedPlants> => {
  return await getAllPlantsRepo(page, limit, search);
};

/**
 * GET SINGLE PLANT BY ID
 * @param id
 * @returns {Promise<IPlant | null>}
 */
export const getPlantByIdService = async (
  id: string
): Promise<IPlant | null> => {
  return await getPlantByIdRepo(id);
};

/**
 * UPDATE PLANT
 * @param id
 * @param rawData
 * @returns {Promise<{ message: string }>}
 */
export const updatePlantService = async (
  id: string,
  rawData: unknown
): Promise<{ message: string }> => {
  const validated = await updatePlantValidation.validateAsync(rawData);

  // Fetch existing plant details (to delete old image if needed)
  const existingPlant = await getPlantById(id);

  let imageUrl = validated.image_search_url;

  // If user uploaded a new Base64 image
  const isNewImage = imageUrl && imageUrl.startsWith("data:image/");

  if (isNewImage) {
    // Upload new image to S3
    // Sanitize name → remove spaces & non-alphanumeric characters
    const safeName = (validated.scientific_name ?? "plant")
      .replace(/\s+/g, "_") // replace spaces with underscores
      .replace(/[^a-zA-Z0-9_]/g, ""); // remove special characters

    const fileName = `${safeName}_${Date.now()}.jpg`;

    imageUrl = await uploadBase64ToS3(imageUrl, fileName, "Admin/PlantImages");

    // Delete old image
    if (existingPlant?.image_search_url) {
      await deleteFileFromS3(existingPlant.image_search_url);
    }
  } else {
    imageUrl = existingPlant?.image_search_url || null;
  }

  // Update main plant table
  await updatePlantRepo(id, {
    ...validated,
    image_search_url: imageUrl,
  });

  // UPDATE ONLY CHANGES — NO FULL DELETE
  await updateArrayRelation(
    id,
    "plant_space_types",
    "space_type",
    validated.space_types
  );

  await updateArrayRelation(
    id,
    "plant_area_sizes",
    "area_size",
    validated.area_sizes
  );

  await updateArrayRelation(
    id,
    "plant_challenges",
    "challenge",
    validated.challenges
  );

  await updateArrayRelation(
    id,
    "plant_tech_preferences",
    "tech_preference",
    validated.tech_preferences
  );

  await updateArrayRelation(
    id,
    "plant_care_notes",
    "note",
    validated.care_notes
  );

  await updateLocationsRepo(id, validated.locations);

  return { message: "Plant updated successfully" };
};

/**
 * SOFT DELETE PLANT
 * @param id
 * @returns {Promise<{ message: string }>}
 */
export const deletePlantService = async (
  id: string
): Promise<{ message: string }> => {
  await softDeletePlantRepo(id);
  return { message: "Plant deleted successfully" };
};
