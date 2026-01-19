// Helper pour la connexion à Netlify Database (PostgreSQL via Neon)
import { neon } from "@netlify/neon";

// Obtenir la connexion à la base de données
// Netlify Database utilise automatiquement NETLIFY_DATABASE_URL
export function getDatabase(context) {
  try {
    // Dans Netlify Functions, les variables d'environnement sont dans context.env
    // Mais @netlify/neon peut aussi les lire automatiquement depuis process.env
    // On essaie d'abord context.env, puis process.env, puis on laisse neon() le faire automatiquement
    const databaseUrl = context?.env?.NETLIFY_DATABASE_URL || 
                        context?.NETLIFY_DATABASE_URL ||
                        process.env.NETLIFY_DATABASE_URL;
    
    if (databaseUrl) {
      return neon(databaseUrl);
    }
    
    // Fallback : neon() sans paramètre devrait utiliser NETLIFY_DATABASE_URL automatiquement
    return neon();
  } catch (error) {
    console.error("Error creating database connection:", error);
    throw new Error(`Failed to connect to database: ${error.message}`);
  }
}
