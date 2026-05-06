import { connectDB } from "../core/config/db";
/**
 * Creates the `plant_toxic_to_pets` table in the database if it does not already exist.
 *
 * This table stores information about plants that may be toxic to pets,
 * including their popular names, scientific name, toxicity status for
 * different animals, severity, toxic principles, symptoms, and origin.
 *
 * @async
 * @function createPlantToxicToPetsTable
 * @returns {Promise<void>} Resolves when the table creation query has executed.
 *
 * @throws Will log an error if the table creation query fails.
 */
export const createPlantToxicToPetsTable = async ():Promise<void>=> {
    const client = await connectDB();
    try {
        const query=`
            CREATE TABLE IF NOT EXISTS plant_toxic_to_pets (
                id SERIAL PRIMARY KEY,
                popular_name_en  VARCHAR(255),
                popular_name_pt VARCHAR(255),
                scientific_name VARCHAR(255) NOT NULL,
                family VARCHAR(255),
                other_names varchar(225),
                toxic_dogs varchar(255),
                toxic_cats varchar(255),
                toxic_horse varchar(255),
                pet_friendly varchar(255),
                severity VARCHAR(255),
                severity_source VARCHAR(255),
                toxic_principle text,
                toxic_principle_pt text ,
                clinical_symptoms text,
                clinical_symptoms_pt text,
                origin VARCHAR(255),
                
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `;
        
        await client.query(query);
        console.error("plant_toxic_to_pets table created successfully");
    }
    catch (error) {
        console.error("Error creating plant_toxic_to_pets table:", error);
    }   
         
};
