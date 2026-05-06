import   {connectDB} from "../core/config/db";

/**
 * Creates the `Professional` table in the database if it does not already exist.
 *
 * This function:
 * - Establishes a database connection
 * - Executes a `CREATE TABLE IF NOT EXISTS` query
 * - Defines schema for professional/business-related user data
 *
 * Table includes:
 * - Basic business info (name, category, contact details)
 * - Location data (city, state, coordinates)
 * - Subscription and verification status
 * - Timestamps for creation and updates
 *
 * Notes:
 * - `user_id` is a unique foreign key referencing the `users` table
 * - `ON DELETE CASCADE` ensures related records are removed automatically
 * - Default values are applied for trial expiration, verification, and activity status
 *
 * @async
 * @function createProfessionalTable
 * @returns {Promise<void>} Resolves when the table is created successfully or already exists.
 *
 * @throws {Error} Logs errors if table creation fails (does not rethrow).
 */
export async function createProfessionalTable(): Promise<void> {
    try {
        const client = await connectDB();
        const query = `
CREATE TABLE IF NOT EXISTS Professional (
    id SERIAL PRIMARY KEY,
    user_id UUID UNIQUE references users(id) ON DELETE CASCADE,
    business_name VARCHAR(255),
    legal_name VARCHAR(255),
    cnpj VARCHAR(30),
    category VARCHAR(100),
    phone VARCHAR(500),
    whatsapp VARCHAR(30),
    email VARCHAR(255),
    website VARCHAR(255),
    address VARCHAR(255),
    neighborhood VARCHAR(100),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(10),
    zip_code VARCHAR(20),
    subscription_plan VARCHAR(50),
    trial_expires DATE DEFAULT '2026-06-27',
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    source VARCHAR(100),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);`;  
        await client.query(query);
        console.error("Professional table created successfully!");
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error creating Professional table:", error.message);
        } else {
            console.error("Unknown error:", error);
        }
    }
}