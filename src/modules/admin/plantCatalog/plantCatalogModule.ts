import { getDB } from "../../../core/config/db";
import env from "../../../core/config/env";

/** Live `plant_table_final` columns used by myPlants (introspected). */
const PLANT_COLUMNS = `
  p.id,
  p.common_name,
  p.scientific_name,
  p.other_name,
  p.family,
  p.genus,
  p.species_epithet,
  p.hybrid,
  p.authority,
  p.subspecies,
  p.cultivar,
  p.variety,
  p.origin,
  p.type,
  p.cycle,
  p.watering,
  p.watering_benchmark_value,
  p.watering_benchmark_unit,
  p.sunlight,
  p.hardiness_min,
  p.hardiness_max,
  p.dimension_type,
  p.dimension_min_value,
  p.dimension_max_value,
  p.dimension_unit,
  p.growth_rate,
  p.maintenance,
  p.care_level,
  p.soil,
  p.pruning_month,
  p.propagation,
  p.attracts,
  p.pest_susceptibility,
  p.plant_anatomy,
  p.drought_tolerant,
  p.salt_tolerant,
  p.thorny,
  p.invasive,
  p.tropical,
  p.indoor,
  p.flowers,
  p.flowering_season,
  p.cones,
  p.fruits,
  p.edible_fruit,
  p.harvest_season,
  p.leaf,
  p.edible_leaf,
  p.seeds,
  p.cuisine,
  p.medicinal,
  p.poisonous_to_humans,
  p.poisonous_to_pets,
  p.description,
  p.care_guides_url,
  p.image_original_url,
  p.image_regular_url,
  p.image_medium_url,
  p.image_small_url,
  p.image_thumbnail,
  p.image_license,
  p.local_image_path,
  pc.watering AS care_watering,
  pc.sunlight AS care_sunlight,
  pc.pruning AS care_pruning
`;

export interface PlantCatalogListFilters {
  search?: string;
  page: number;
  limit: number;
}

export interface PlantCatalogCareInstructions {
  watering: string | null;
  sunlight: string | null;
  pruning: string | null;
}

/** Admin plant master item aligned to live `plant_table_final` + `plant_care_table`. */
export interface PlantCatalogItem {
  plant_id: number;
  common_name: string | null;
  scientific_name: string | null;
  other_name: string | null;
  family: string | null;
  genus: string | null;
  species_epithet: string | null;
  hybrid: string | null;
  author: string | null;
  subspecies: string | null;
  cultivar: string | null;
  variety: string | null;
  origin: string | null;
  plant_type: string | null;
  type: string | null;
  cycle: string | null;
  description: string | null;
  watering: string | null;
  watering_benchmark_value: string | null;
  watering_benchmark_unit: string | null;
  sunlight: string | null;
  hardiness_min: string | null;
  hardiness_max: string | null;
  dimension_type: string | null;
  dimension_min_value: string | null;
  dimension_max_value: string | null;
  dimension_unit: string | null;
  growth_rate: string | null;
  maintenance: string | null;
  care_level: string | null;
  soil: string | null;
  pruning_month: string | null;
  propagation: string | null;
  attracts: string | null;
  pest_susceptibility: string | null;
  plant_anatomy: string | null;
  drought_tolerant: boolean | null;
  salt_tolerant: boolean | null;
  thorny: boolean | null;
  invasive: boolean | null;
  tropical: boolean | null;
  indoor: boolean | null;
  flowers: boolean | null;
  flowering_season: string | null;
  cones: boolean | null;
  fruits: boolean | null;
  edible_fruit: boolean | null;
  harvest_season: string | null;
  leaf: boolean | null;
  edible_leaf: boolean | null;
  seeds: boolean | null;
  cuisine: boolean | null;
  medicinal: boolean | null;
  poisonous_to_humans: boolean | null;
  poisonous_to_pets: boolean | null;
  care_guides_url: string | null;
  image_original_url: string | null;
  image_regular_url: string | null;
  image_medium_url: string | null;
  image_small_url: string | null;
  image_thumbnail: string | null;
  image_license: string | null;
  image_url: string | null;
  /** Detailed care text from live `plant_care_table` */
  care_instructions: PlantCatalogCareInstructions | null;
}

/**
 * Builds a public plant-images URL from a stored local path.
 *
 * @param {string | null} localPath - Stored local_image_path value.
 * @returns {string | null} Absolute URL or null.
 */
function toImageUrl(localPath: string | null): string | null {
  if (!localPath) return null;
  const filename = localPath.split("/").pop();
  if (!filename) return null;
  return `${env.APPDEV_URL}/plant-images/${filename}`;
}

/**
 * Lists plant master catalog rows for the admin portal (live schema).
 *
 * @param {PlantCatalogListFilters} filters - Pagination and optional search.
 * @returns {Promise<{ plants: PlantCatalogItem[]; total: number }>} Page of plants.
 */
export async function findPlantCatalog(
  filters: PlantCatalogListFilters
): Promise<{ plants: PlantCatalogItem[]; total: number }> {
  const db = getDB();
  const values: unknown[] = [];
  const where: string[] = ["p.id IS NOT NULL"];

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    values.push(q);
    values.push(`%${q}%`);
    where.push(`(
      unaccent(COALESCE(p.common_name, '')) ILIKE unaccent($2)
      OR unaccent(COALESCE(p.scientific_name, '')) ILIKE unaccent($2)
      OR unaccent(COALESCE(p.genus, '')) ILIKE unaccent($2)
      OR unaccent(COALESCE(p.species_epithet, '')) ILIKE unaccent($2)
      OR to_tsvector('simple', unaccent(COALESCE(p.common_name, '')))
           @@ plainto_tsquery('simple', unaccent($1))
      OR to_tsvector('simple', unaccent(COALESCE(p.scientific_name, '')))
           @@ plainto_tsquery('simple', unaccent($1))
    )`);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const countResult = await db.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM plant_table_final p
    ${whereSql}
    `,
    values
  );
  const total = Number(countResult.rows[0]?.count ?? 0);

  values.push(filters.limit);
  const limitIdx = values.length;
  values.push((filters.page - 1) * filters.limit);
  const offsetIdx = values.length;

  const { rows } = await db.query<Record<string, unknown>>(
    `
    SELECT ${PLANT_COLUMNS}
    FROM plant_table_final p
    LEFT JOIN plant_care_table pc ON pc.plant_id = p.id
    ${whereSql}
    ORDER BY p.common_name ASC NULLS LAST, p.id ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
    values
  );

  return { plants: rows.map(mapRow), total };
}

/**
 * Fetches one plant master record by id from the live catalog tables.
 *
 * @param {number} plantId - Catalog plant id.
 * @returns {Promise<PlantCatalogItem | null>} Plant or null.
 */
export async function findPlantCatalogById(
  plantId: number
): Promise<PlantCatalogItem | null> {
  const db = getDB();
  const { rows } = await db.query<Record<string, unknown>>(
    `
    SELECT ${PLANT_COLUMNS}
    FROM plant_table_final p
    LEFT JOIN plant_care_table pc ON pc.plant_id = p.id
    WHERE p.id = $1
    LIMIT 1
    `,
    [plantId]
  );

  const row = rows[0];
  return row ? mapRow(row) : null;
}

/**
 * Maps a live DB row into the admin plant-catalog response shape.
 *
 * @param {Record<string, unknown>} row - Query row from plant_table_final.
 * @returns {PlantCatalogItem} Normalized plant master item.
 */
function mapRow(row: Record<string, unknown>): PlantCatalogItem {
  const careWatering = (row.care_watering as string | null) ?? null;
  const careSunlight = (row.care_sunlight as string | null) ?? null;
  const carePruning = (row.care_pruning as string | null) ?? null;
  const hasCareInstructions =
    careWatering !== null || careSunlight !== null || carePruning !== null;

  const plantType = (row.type as string | null) ?? null;

  return {
    plant_id: Number(row.id),
    common_name: (row.common_name as string | null) ?? null,
    scientific_name: (row.scientific_name as string | null) ?? null,
    other_name: (row.other_name as string | null) ?? null,
    family: (row.family as string | null) ?? null,
    genus: (row.genus as string | null) ?? null,
    species_epithet: (row.species_epithet as string | null) ?? null,
    hybrid: (row.hybrid as string | null) ?? null,
    author: (row.authority as string | null) ?? null,
    subspecies: (row.subspecies as string | null) ?? null,
    cultivar: (row.cultivar as string | null) ?? null,
    variety: (row.variety as string | null) ?? null,
    origin: (row.origin as string | null) ?? null,
    plant_type: plantType,
    type: plantType,
    cycle: (row.cycle as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    watering: (row.watering as string | null) ?? null,
    watering_benchmark_value:
      (row.watering_benchmark_value as string | null) ?? null,
    watering_benchmark_unit:
      (row.watering_benchmark_unit as string | null) ?? null,
    sunlight: (row.sunlight as string | null) ?? null,
    hardiness_min: (row.hardiness_min as string | null) ?? null,
    hardiness_max: (row.hardiness_max as string | null) ?? null,
    dimension_type: (row.dimension_type as string | null) ?? null,
    dimension_min_value: (row.dimension_min_value as string | null) ?? null,
    dimension_max_value: (row.dimension_max_value as string | null) ?? null,
    dimension_unit: (row.dimension_unit as string | null) ?? null,
    growth_rate: (row.growth_rate as string | null) ?? null,
    maintenance: (row.maintenance as string | null) ?? null,
    care_level: (row.care_level as string | null) ?? null,
    soil: (row.soil as string | null) ?? null,
    pruning_month: (row.pruning_month as string | null) ?? null,
    propagation: (row.propagation as string | null) ?? null,
    attracts: (row.attracts as string | null) ?? null,
    pest_susceptibility: (row.pest_susceptibility as string | null) ?? null,
    plant_anatomy: (row.plant_anatomy as string | null) ?? null,
    drought_tolerant: (row.drought_tolerant as boolean | null) ?? null,
    salt_tolerant: (row.salt_tolerant as boolean | null) ?? null,
    thorny: (row.thorny as boolean | null) ?? null,
    invasive: (row.invasive as boolean | null) ?? null,
    tropical: (row.tropical as boolean | null) ?? null,
    indoor: (row.indoor as boolean | null) ?? null,
    flowers: (row.flowers as boolean | null) ?? null,
    flowering_season: (row.flowering_season as string | null) ?? null,
    cones: (row.cones as boolean | null) ?? null,
    fruits: (row.fruits as boolean | null) ?? null,
    edible_fruit: (row.edible_fruit as boolean | null) ?? null,
    harvest_season: (row.harvest_season as string | null) ?? null,
    leaf: (row.leaf as boolean | null) ?? null,
    edible_leaf: (row.edible_leaf as boolean | null) ?? null,
    seeds: (row.seeds as boolean | null) ?? null,
    cuisine: (row.cuisine as boolean | null) ?? null,
    medicinal: (row.medicinal as boolean | null) ?? null,
    poisonous_to_humans: (row.poisonous_to_humans as boolean | null) ?? null,
    poisonous_to_pets: (row.poisonous_to_pets as boolean | null) ?? null,
    care_guides_url: (row.care_guides_url as string | null) ?? null,
    image_original_url: (row.image_original_url as string | null) ?? null,
    image_regular_url: (row.image_regular_url as string | null) ?? null,
    image_medium_url: (row.image_medium_url as string | null) ?? null,
    image_small_url: (row.image_small_url as string | null) ?? null,
    image_thumbnail: (row.image_thumbnail as string | null) ?? null,
    image_license: (row.image_license as string | null) ?? null,
    image_url: toImageUrl((row.local_image_path as string | null) ?? null),
    care_instructions: hasCareInstructions
      ? {
          watering: careWatering,
          sunlight: careSunlight,
          pruning: carePruning,
        }
      : null,
  };
}
