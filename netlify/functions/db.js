import { neon } from "@netlify/neon";

export function getDatabase(context) {
  try {
    const databaseUrl = context?.env?.NETLIFY_DATABASE_URL || 
                        context?.NETLIFY_DATABASE_URL ||
                        process.env.NETLIFY_DATABASE_URL;
    
    return databaseUrl ? neon(databaseUrl) : neon();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error creating database connection:", error.message);
    } else {
      console.error("Database connection error");
    }
    throw new Error(`Failed to connect to database: ${error.message}`);
  }
}
