import { neon } from "@netlify/neon";

export function getDatabase(context) {
  try {
    const databaseUrl = context?.env?.NETLIFY_DATABASE_URL || 
                        context?.NETLIFY_DATABASE_URL ||
                        process.env.NETLIFY_DATABASE_URL;
    
    if (!databaseUrl) {
      // In production, neon() should work without URL if configured via Netlify
      // But we'll try both approaches
      try {
        return neon();
      } catch (fallbackError) {
        throw new Error("Database URL not configured and neon() failed");
      }
    }
    
    return neon(databaseUrl);
  } catch (error) {
    const errorMessage = error.message || "Unknown database connection error";
    if (process.env.NODE_ENV === "development") {
      console.error("Error creating database connection:", errorMessage, error.code);
    } else {
      console.error("Database connection error");
    }
    throw new Error(`Failed to connect to database: ${errorMessage}`);
  }
}
