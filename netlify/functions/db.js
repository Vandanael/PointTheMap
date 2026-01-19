// Helper pour la connexion à Netlify Database (PostgreSQL via Neon)
import { neon } from "@netlify/neon";

// Obtenir la connexion à la base de données
// Netlify Database utilise automatiquement NETLIFY_DATABASE_URL
export function getDatabase(context) {
  // neon() utilise automatiquement NETLIFY_DATABASE_URL depuis les variables d'environnement
  // On peut aussi passer explicitement la variable si nécessaire
  const databaseUrl = context.env?.NETLIFY_DATABASE_URL || 
                      process.env.NETLIFY_DATABASE_URL;
  
  if (databaseUrl) {
    return neon(databaseUrl);
  }
  
  // Fallback : neon() sans paramètre utilise automatiquement NETLIFY_DATABASE_URL
  return neon();
}
