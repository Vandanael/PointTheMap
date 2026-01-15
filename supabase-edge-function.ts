// ============================================
// FONCTION EDGE SUPABASE POUR VALIDATION SERVEUR
// ============================================
// Cette fonction peut être déployée comme Edge Function dans Supabase
// pour une validation supplémentaire côté serveur
// 
// Pour déployer:
// 1. Créer une Edge Function dans Supabase Dashboard
// 2. Nommer la fonction "validate-leaderboard"
// 3. Copier ce code dans la fonction
// 4. Configurer les variables d'environnement si nécessaire
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Récupérer les variables d'environnement Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    // Créer le client Supabase avec la clé de service (pour bypass RLS si nécessaire)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parser le body de la requête
    const { pseudo, score, time, wordle, date, timestamp, session_id } = await req.json()

    // ============================================
    // VALIDATIONS STRICTES
    // ============================================
    
    const MAX_SCORE = 30000
    const MIN_SCORE = 0
    const MAX_TIME = 300 // 5 minutes
    const MIN_TIME = 5
    const MAX_PSEUDO_LENGTH = 5
    const MIN_PSEUDO_LENGTH = 3
    const MAX_SUBMISSIONS_PER_HOUR = 10

    // Validation du pseudo
    if (!pseudo || typeof pseudo !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Pseudo invalide' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const normalizedPseudo = pseudo.trim().toUpperCase()
    if (normalizedPseudo.length < MIN_PSEUDO_LENGTH || normalizedPseudo.length > MAX_PSEUDO_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Pseudo doit contenir entre ${MIN_PSEUDO_LENGTH} et ${MAX_PSEUDO_LENGTH} caractères` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!/^[A-Z]+$/.test(normalizedPseudo)) {
      return new Response(
        JSON.stringify({ error: 'Pseudo doit contenir uniquement des lettres majuscules' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validation du score
    const scoreNum = Number(score)
    if (isNaN(scoreNum) || !isFinite(scoreNum) || scoreNum < MIN_SCORE || scoreNum > MAX_SCORE) {
      return new Response(
        JSON.stringify({ error: `Score doit être entre ${MIN_SCORE} et ${MAX_SCORE}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validation du temps
    const timeNum = Number(time)
    if (isNaN(timeNum) || !isFinite(timeNum) || timeNum < MIN_TIME || timeNum > MAX_TIME) {
      return new Response(
        JSON.stringify({ error: `Temps doit être entre ${MIN_TIME} et ${MAX_TIME} secondes` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validation de la date
    if (!date || typeof date !== 'string' || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return new Response(
        JSON.stringify({ error: 'Date invalide' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validation du timestamp
    const timestampNum = Number(timestamp)
    if (isNaN(timestampNum) || !isFinite(timestampNum) || timestampNum < 0) {
      return new Response(
        JSON.stringify({ error: 'Timestamp invalide' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limiting: vérifier le nombre de soumissions par session_id
    if (session_id) {
      const oneHourAgo = Date.now() - (60 * 60 * 1000)
      const { count, error: countError } = await supabase
        .from('leaderboard')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session_id)
        .gt('timestamp', oneHourAgo)

      if (!countError && count && count >= MAX_SUBMISSIONS_PER_HOUR) {
        return new Response(
          JSON.stringify({ error: `Trop de soumissions: maximum ${MAX_SUBMISSIONS_PER_HOUR} par heure` }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // ============================================
    // INSERTION DANS LA BASE DE DONNÉES
    // ============================================
    
    const entry = {
      pseudo: normalizedPseudo,
      score: Math.round(scoreNum),
      time: Math.round(timeNum),
      wordle: Array.isArray(wordle) ? wordle.join(' ').substring(0, 100) : (wordle || '').substring(0, 100),
      date: date,
      timestamp: timestampNum,
      session_id: session_id || null
    }

    const { data, error } = await supabase
      .from('leaderboard')
      .insert([entry])
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return new Response(
        JSON.stringify({ error: 'Erreur lors de l\'enregistrement' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, data: data[0] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Erreur serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
