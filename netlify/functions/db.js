import { neon } from "@netlify/neon";

export function getDatabase(context) {
  try {
    const databaseUrl = context?.env?.NETLIFY_DATABASE_URL ||
                        context?.NETLIFY_DATABASE_URL ||
                        process.env.NETLIFY_DATABASE_URL;

    if (!databaseUrl) {
      console.error("NETLIFY_DATABASE_URL not found in context or environment");
      throw new Error("Database URL not configured");
    }

    // Configure with connection options for better reliability
    const sql = neon(databaseUrl, {
      fetchOptions: {
        timeout: 8000, // 8 second timeout to stay under function limit
      },
    });

    return sql;
  } catch (error) {
    const err = /** @type {Error & {code?: string}} */ (error);
    const errorMessage = err.message || "Unknown database connection error";
    console.error("Database connection error:", errorMessage, err.code);
    throw new Error(`Failed to connect to database: ${errorMessage}`);
  }
}
