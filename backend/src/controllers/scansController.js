const { supabaseAdmin } = require('../config/supabase');

/**
 * POST /scans
 * Scanner un colis
 */
const scan = async (req, res) => {
  try {
    const { tracking, mode_hors_ligne = false } = req.body;
    const userId = req.user.id;
    
    if (!tracking) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_TRACKING',
        message: 'Numéro de tracking requis',
      });
    }
    
    // Récupérer la journée en cours
    const today = new Date().toISOString().split('T')[0];
    const { data: journee } = await supabaseAdmin
      .from('journees')
      .select('id')
      .eq('date', today)
      .eq('statut', 'en_cours')
      .single();
    
    if (!journee) {
      return res.status(400).json({
        success: false,
        error: 'NO_ACTIVE_DAY',
        message: 'Aucune journée de tri en cours',
      });
    }
    
    // Rechercher le colis
    const { data: colis, error: colisError } = await supabaseAdmin
      .from('colis')
      .select(`
        id,
        tracking,
        adresse,
        ville,
        code_postal,
        numero_ordre,
        source,
        statut,
        tournee_id,
        tournees (
          id,
          chauffeur_id,
          chauffeurs (
            id,
            nom,
            prenom,
            sous_traitant_id
          )
        )
      `)
      .eq('journee_id', journee.id)
      .ilike('tracking', tracking)
      .single();
    
    // Colis inconnu
    if (colisError || !colis) {
      // Enregistrer le colis inconnu
      await supabaseAdmin
        .from('colis')
        .insert({
          tracking: tracking.toUpperCase(),
          statut: 'inconnu',
          journee_id: journee.id,
          source: 'inconnu',
        });
      
      return res.status(404).json({
        success: false,
        type: 'inconnu',
        error: 'COLIS_INCONNU',
        data: {
          tracking: tracking.toUpperCase(),
        },
      });
    }
    
    // Vérifier si déjà scanné (doublon)
    const { data: existingScan } = await supabaseAdmin
      .from('scans')
      .select(`
        id,
        heure_scan,
        user_id,
        users (
          nom,
          prenom
        )
      `)
      .eq('colis_id', colis.id)
      .single();
    
    if (existingScan) {
      // C'est un doublon - on met à jour le scan existant
      await supabaseAdmin
        .from('scans')
        .update({
          user_id: userId,
          heure_scan: new Date().toISOString(),
          mode_hors_ligne,
        })
        .eq('id', existingScan.id);
      
      const scannerPar = existingScan.users 
        ? `${existingScan.users.prenom} ${existingScan.users.nom}`
        : 'Inconnu';
      
      return res.json({
        success: true,
        type: 'doublon',
        data: {
          colis_id: colis.id,
          tracking: colis.tracking,
          chauffeur: colis.tournees?.chauffeurs 
            ? `${colis.tournees.chauffeurs.prenom} ${colis.tournees.chauffeurs.nom}`
            : null,
          numero_ordre: colis.numero_ordre,
          premier_scan: existingScan.heure_scan,
          scanner_par: scannerPar,
        },
      });
    }
    
    // Premier scan - créer le scan et mettre à jour le statut du colis
    await supabaseAdmin
      .from('scans')
      .insert({
        colis_id: colis.id,
        user_id: userId,
        heure_scan: new Date().toISOString(),
        mode_hors_ligne,
      });
    
    await supabaseAdmin
      .from('colis')
      .update({ statut: 'trie' })
      .eq('id', colis.id);
    
    // Construire l'adresse complète
    const adresseComplete = [colis.adresse, colis.code_postal, colis.ville]
      .filter(Boolean)
      .join(', ');
    
    res.json({
      success: true,
      type: 'success',
      data: {
        colis_id: colis.id,
        tracking: colis.tracking,
        chauffeur: colis.tournees?.chauffeurs 
          ? `${colis.tournees.chauffeurs.prenom} ${colis.tournees.chauffeurs.nom}`
          : null,
        numero_ordre: colis.numero_ordre,
        adresse: adresseComplete,
      },
    });
    
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({
      success: false,
      error: 'SCAN_ERROR',
      message: 'Erreur lors du scan',
    });
  }
};

/**
 * GET /scans
 * Liste des scans du jour
 */
const list = async (req, res) => {
  try {
    const { user_id, limit = 50 } = req.query;
    
    // Récupérer la journée en cours
    const today = new Date().toISOString().split('T')[0];
    const { data: journee } = await supabaseAdmin
      .from('journees')
      .select('id')
      .eq('date', today)
      .single();
    
    if (!journee) {
      return res.json({
        success: true,
        data: [],
      });
    }
    
    // Construire la requête
    let query = supabaseAdmin
      .from('scans')
      .select(`
        id,
        heure_scan,
        mode_hors_ligne,
        users (
          id,
          nom,
          prenom
        ),
        colis (
          id,
          tracking,
          numero_ordre,
          adresse,
          ville,
          tournees (
            chauffeurs (
              nom,
              prenom
            )
          )
        )
      `)
      .order('heure_scan', { ascending: false })
      .limit(parseInt(limit));
    
    // Filtrer par trieur si demandé
    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    
    // Filtrer par les colis de la journée
    const { data: scans, error } = await query;
    
    if (error) {
      throw error;
    }
    
    // Formater les résultats
    const formattedScans = scans.map(scan => ({
      id: scan.id,
      tracking: scan.colis?.tracking,
      chauffeur: scan.colis?.tournees?.chauffeurs 
        ? `${scan.colis.tournees.chauffeurs.prenom} ${scan.colis.tournees.chauffeurs.nom}`
        : null,
      numero_ordre: scan.colis?.numero_ordre,
      adresse: scan.colis?.adresse,
      ville: scan.colis?.ville,
      trieur: scan.users 
        ? `${scan.users.prenom} ${scan.users.nom}`
        : null,
      heure_scan: scan.heure_scan,
      mode_hors_ligne: scan.mode_hors_ligne,
    }));
    
    res.json({
      success: true,
      data: formattedScans,
    });
    
  } catch (error) {
    console.error('List scans error:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Erreur lors de la récupération des scans',
    });
  }
};

/**
 * GET /scans/recent
 * 20 derniers scans (pour affichage temps réel)
 */
const recent = async (req, res) => {
  req.query.limit = 20;
  return list(req, res);
};

/**
 * POST /scans/sync
 * Synchroniser les scans hors-ligne
 */
const sync = async (req, res) => {
  try {
    const { scans } = req.body;
    const userId = req.user.id;
    
    if (!scans || !Array.isArray(scans)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_DATA',
        message: 'Liste de scans invalide',
      });
    }
    
    let synchronises = 0;
    let doublons = 0;
    let inconnus = 0;
    
    for (const scanData of scans) {
      // Simuler un scan pour chaque colis
      const fakeReq = {
        body: {
          tracking: scanData.tracking,
          mode_hors_ligne: true,
        },
        user: { id: userId },
      };
      
      // Rechercher le colis
      const { data: colis } = await supabaseAdmin
        .from('colis')
        .select('id, statut')
        .ilike('tracking', scanData.tracking)
        .single();
      
      if (!colis) {
        inconnus++;
        continue;
      }
      
      // Vérifier si déjà scanné
      const { data: existingScan } = await supabaseAdmin
        .from('scans')
        .select('id')
        .eq('colis_id', colis.id)
        .single();
      
      if (existingScan) {
        doublons++;
        continue;
      }
      
      // Créer le scan
      await supabaseAdmin
        .from('scans')
        .insert({
          colis_id: colis.id,
          user_id: userId,
          heure_scan: scanData.heure_scan || new Date().toISOString(),
          mode_hors_ligne: true,
        });
      
      await supabaseAdmin
        .from('colis')
        .update({ statut: 'trie' })
        .eq('id', colis.id);
      
      synchronises++;
    }
    
    res.json({
      success: true,
      data: {
        total: scans.length,
        synchronises,
        doublons,
        inconnus,
      },
    });
    
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      error: 'SYNC_ERROR',
      message: 'Erreur lors de la synchronisation',
    });
  }
};

/**
 * GET /scans/stats
 * Stats des scans pour un trieur
 */
const stats = async (req, res) => {
  try {
    const userId = req.query.user_id || req.user.id;
    
    // Vérifier les permissions
    if (req.user.role !== 'admin' && userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Accès non autorisé',
      });
    }
    
    // Récupérer la journée en cours
    const today = new Date().toISOString().split('T')[0];
    
    // Compter les scans du jour pour cet utilisateur
    const { count: scansAujourdhui } = await supabaseAdmin
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('heure_scan', `${today}T00:00:00`);
    
    // Calculer la vitesse moyenne (scans des 10 dernières minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: scansRecents } = await supabaseAdmin
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('heure_scan', tenMinutesAgo);
    
    const vitesseMoyenne = Math.round((scansRecents / 10) * 10) / 10; // colis/min
    
    res.json({
      success: true,
      data: {
        scans_aujourdhui: scansAujourdhui || 0,
        vitesse_moyenne: vitesseMoyenne,
      },
    });
    
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      error: 'STATS_ERROR',
      message: 'Erreur lors du calcul des stats',
    });
  }
};

module.exports = {
  scan,
  list,
  recent,
  sync,
  stats,
};
