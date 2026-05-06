import { connectDB } from "../core/config/db";

/**
 * Creates the plant_care table in the database if it does not already exist.
 * This table stores care-related information for various plants, including
 * details about watering, sunlight, temperature, humidity, and other plant care attributes.
 * 
 * @returns {Promise<void>} A promise that resolves once the table is created.
 */
export async function createPlantCareTables():Promise<void> {
    try {
         const client = await connectDB();
         const query = `
            CREATE TABLE IF NOT EXISTS plant_care (

                id SERIAL PRIMARY KEY,  
                common_name VARCHAR(255),
                scientific_name VARCHAR(255) NOT NULL,
                family VARCHAR(255),
                genus VARCHAR(255),
                watering VARCHAR(255),
                sunlight VARCHAR(255),
                care_level VARCHAR(255),
                growth_rate VARCHAR(255),
                indoor VARCHAR(255),
                temperature_min decimal(5,2)null,
                temperature_max int null,
                humidity_min int null,
                humidity_max int null,
                light_min int null,
                light_max int null,
                soil_moisture_min int null,
                soil_moisture_max int null,
                poisonous_to_humans boolean null,
                poisonous_to_pets boolean null,
                drought_tolerant boolean null,
                tropical boolean null,
                medical boolean null,
                edible boolean null,
                soil VARCHAR(255),
                fertilizer VARCHAR(255),
                pruning VARCHAR(255),
                cycle VARCHAR(255),
                pest VARCHAR(255),
                diseases VARCHAR(255),
                origin VARCHAR(255),
                category VARCHAR(255),
                climate VARCHAR(255),
                color VARCHAR(255),
                blooming varchar(255),
                description TEXT,
                image_url text,
                source VARCHAR(255),
                common_name_pt VARCHAR(255),
                watering_pt VARCHAR(255),
                sunlight_pt VARCHAR(255),
                care_level_pt VARCHAR(255),
                growth_rate_pt VARCHAR(255),
                indoor_pt VARCHAR(255),
                soil_pt VARCHAR(255),
                fertilizer_pt VARCHAR(255),
                pruning_pt VARCHAR(255),
                cycle_pt VARCHAR(255),
                climate_pt VARCHAR(255),
                poisonous_to_humans_pt VARCHAR(255),
                poisonous_to_pets_pt VARCHAR(255),
                drought_tolerant_pt VARCHAR(255),
                tropical_pt VARCHAR(255),
                medical_pt VARCHAR(255),
                edible_pt VARCHAR(255), 
                brazil_region VARCHAR(255),
                description_pt TEXT,
                temperature_source VARCHAR(255),
                fertilizer_source VARCHAR(255),
                description_source VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await client.query(query);
        console.error("Plant care tables created successfully.");
    } catch (error) {
        console.error("Error creating plant care tables:", error);
    }
}