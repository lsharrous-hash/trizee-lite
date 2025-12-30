const { supabaseAdmin } = require('../config/supabase');

/**
 * Retourne la date de demain au format YYYY-MM-DD
 */
function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * GET /tournees
 * Liste des tournées pour une date donnée
 */
const list = async (req, res) => {
  try {
    const targetDate = req.query.date || getTomorrowDate();
    
    console.log('Fetching tournees for date:', targetDate);

    // Récupérer la journée
    const { data: journee, error: journeeError } = await supabaseAdmin
      .from('journees')
      .select('id')
      .eq('date', targetDate)
      .single();

    console.log('Journee found:', journee, 'Error:', journeeError);

    if (!journee) {
      return res.json({ success: true, data: [] });
    }

    // Récupérer les tournées
    const { data: tournees, error: tourneesError } = await supabaseAdmin
      .from('tournees')
      .select('*')
      .eq('journee_id', journee.id);

    console.log('Tournees found:', tournees?.length, 'Error:', tourneesError);

    if (tourneesError) throw tourneesError;

    // Enrichir avec les infos du chauffeur et sous-traitant
    const enrichedTournees = await Promise.all(
      (tournees || []).map(async (tournee) => {
        // Récupérer le chauffeur
        let chauffeur = null;
        if (tournee.chauffeur_id) {
          const { data: chauffeurData } = await supabaseAdmin
            .from('chauffeurs')
            .select('id, nom, prenom, sous_traitant_id')
            .eq('id', tournee.chauffeur_id)
            .single();
          chauffeur = chauffeurData;
        }

        // Récupérer le sous-traitant
        let sousTraitant = null;
        if (chauffeur?.sous_traitant_id) {
          const { data: stData } = await supabaseAdmin
            .from('sous_traitants')
            .select('id, nom_entreprise')
            .eq('id', chauffeur.sous_traitant_id)
            .single();
          sousTraitant = stData;
        }

        // Compter les colis triés
        const { count: nbTries } = await supabaseAdmin
          .from('colis')
          .select('id', { count: 'exact', head: true })
          .eq('tournee_id', tournee.id)
          .eq('statut', 'trie');

        // Compter les sources (gofo/cainiao)
        const { data: sourcesColis } = await supabaseAdmin
          .from('colis')
          .select('source')
          .eq('tournee_id', tournee.id);

        const sources = [...new Set((sourcesColis || []).map(c => c.source).filter(Boolean))];
        const hasGofo = sources.includes('gofo');
        const hasCainiao = sources.includes('cainiao');

        // Compter par source
        const { count: nbGofo } = await supabaseAdmin
          .from('colis')
          .select('id', { count: 'exact', head: true })
          .eq('tournee_id', tournee.id)
          .eq('source', 'gofo');

        const { count: nbCainiao } = await supabaseAdmin
          .from('colis')
          .select('id', { count: 'exact', head: true })
          .eq('tournee_id', tournee.id)
          .eq('source', 'cainiao');

        const pourcentage = tournee.nb_colis > 0
          ? Math.round(((nbTries || 0) / tournee.nb_colis) * 100)
          : 0;

        return {
          ...tournee,
          chauffeur,
          sous_traitant: sousTraitant,
          nb_tries: nbTries || 0,
          pourcentage,
          sources: {
            gofo: hasGofo,
            cainiao: hasCainiao,
            nb_gofo: nbGofo || 0,
            nb_cainiao: nbCainiao || 0,
          },
        };
      })
    );

    console.log('Enriched tournees:', enrichedTournees.length);

    res.json({ success: true, data: enrichedTournees });
  } catch (error) {
    console.error('List tournees error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de la récupération des tournées',
    });
  }
};

/**
 * GET /tournees/:id
 * Détail d'une tournée avec ses colis
 */
const get = async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer la tournée
    const { data: tournee, error } = await supabaseAdmin
      .from('tournees')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !tournee) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Tournée non trouvée',
      });
    }

    // Récupérer le chauffeur
    let chauffeur = null;
    if (tournee.chauffeur_id) {
      const { data: chauffeurData } = await supabaseAdmin
        .from('chauffeurs')
        .select('id, nom, prenom')
        .eq('id', tournee.chauffeur_id)
        .single();
      chauffeur = chauffeurData;
    }

    // Récupérer les colis
    const { data: colis } = await supabaseAdmin
      .from('colis')
      .select('*')
      .eq('tournee_id', id)
      .order('created_at');

    res.json({
      success: true,
      data: {
        ...tournee,
        chauffeur,
        colis: colis || [],
      },
    });
  } catch (error) {
    console.error('Get tournee error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de la récupération de la tournée',
    });
  }
};

/**
 * GET /tournees/:id/export
 * Exporter une tournée au format Excel
 */
const exportTournee = async (req, res) => {
  try {
    const { id } = req.params;
    const XLSX = require('xlsx');

    // Récupérer la tournée
    const { data: tournee } = await supabaseAdmin
      .from('tournees')
      .select('*')
      .eq('id', id)
      .single();

    // Récupérer le chauffeur
    let chauffeurNom = 'export';
    if (tournee?.chauffeur_id) {
      const { data: chauffeur } = await supabaseAdmin
        .from('chauffeurs')
        .select('nom, prenom')
        .eq('id', tournee.chauffeur_id)
        .single();
      if (chauffeur) {
        chauffeurNom = `${chauffeur.prenom || ''}_${chauffeur.nom}`.trim();
      }
    }

    // Récupérer les colis
    const { data: colis } = await supabaseAdmin
      .from('colis')
      .select('tracking, adresse, ville, code_postal, statut')
      .eq('tournee_id', id)
      .order('created_at');

    // Créer le fichier Excel
    const wsData = [
      ['Tracking', 'Adresse', 'Ville', 'Code Postal', 'Statut'],
      ...(colis || []).map(c => [
        c.tracking,
        c.adresse,
        c.ville,
        c.code_postal,
        c.statut === 'trie' ? 'Trié' : 'En attente'
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Colis');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=tournee_${chauffeurNom}.xlsx`);
    res.send(buffer);
  } catch (error) {
    console.error('Export tournee error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de l\'export',
    });
  }
};

/**
 * POST /tournees/:id/spoke
 * Importer un fichier Spoke pour mettre à jour l'ordre des colis d'une tournée existante
 */
const importSpoke = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FILE',
        message: 'Fichier Spoke requis',
      });
    }

    // Vérifier que la tournée existe
    const { data: tournee, error: tourneeError } = await supabaseAdmin
      .from('tournees')
      .select('id, journee_id, chauffeur_id')
      .eq('id', id)
      .single();

    if (tourneeError || !tournee) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Tournée non trouvée',
      });
    }

    // Parser le fichier Spoke PDF
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(file.buffer);
    const text = pdfData.text;

    console.log('PDF Text extracted for tournee', id, ', length:', text.length);

    // Extraire les numéros de tracking et leur ordre
    const trackingOrders = [];
    
    // Pattern pour capturer les trackings dans le format Spoke
    const trackingPattern = /([A-Z]{2}FR\d{10,20}(?:HD)?);?/gi;
    
    let match;
    let orderNum = 1;
    
    while ((match = trackingPattern.exec(text)) !== null) {
      const tracking = match[1].replace(/;$/, '').trim();
      trackingOrders.push({ tracking, ordre: orderNum });
      orderNum++;
    }

    console.log('Trackings found:', trackingOrders.length);

    // Mettre à jour les colis avec leur ordre
    let updatedCount = 0;
    for (const { tracking, ordre } of trackingOrders) {
      const { data: updated } = await supabaseAdmin
        .from('colis')
        .update({ ordre })
        .eq('tracking', tracking)
        .eq('tournee_id', id)
        .select('id');

      if (updated && updated.length > 0) {
        updatedCount++;
      }
    }

    // Marquer la tournée comme ayant un Spoke importé
    await supabaseAdmin
      .from('tournees')
      .update({ spoke_importe: true })
      .eq('id', id);

    res.json({
      success: true,
      data: {
        tournee_id: id,
        trackings_trouves: trackingOrders.length,
        colis_mis_a_jour: updatedCount,
      },
    });
  } catch (error) {
    console.error('Import spoke error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de l\'import du fichier Spoke',
    });
  }
};

/**
 * POST /tournees/create-spoke
 * Créer une tournée manuellement avec un fichier Spoke
 */
const createWithSpoke = async (req, res) => {
  try {
    const { chauffeur_id, date } = req.body;
    const file = req.file;

    if (!chauffeur_id || !file || !date) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Chauffeur, fichier et date sont requis',
      });
    }

    // Vérifier que le chauffeur existe
    const { data: chauffeur, error: chauffeurError } = await supabaseAdmin
      .from('chauffeurs')
      .select('id, nom, prenom, sous_traitant_id')
      .eq('id', chauffeur_id)
      .single();

    if (chauffeurError || !chauffeur) {
      return res.status(404).json({
        success: false,
        error: 'CHAUFFEUR_NOT_FOUND',
        message: 'Chauffeur non trouvé',
      });
    }

    // Récupérer ou créer la journée
    let { data: journee } = await supabaseAdmin
      .from('journees')
      .select('id')
      .eq('date', date)
      .single();

    if (!journee) {
      const { data: newJournee, error: journeeError } = await supabaseAdmin
        .from('journees')
        .insert({ date, statut: 'en_cours' })
        .select('id')
        .single();

      if (journeeError) throw journeeError;
      journee = newJournee;
    }

    // Vérifier si une tournée existe déjà pour ce chauffeur à cette date
    const { data: existingTournee } = await supabaseAdmin
      .from('tournees')
      .select('id')
      .eq('journee_id', journee.id)
      .eq('chauffeur_id', chauffeur_id)
      .single();

    let tourneeId;

    if (existingTournee) {
      // Mettre à jour la tournée existante
      tourneeId = existingTournee.id;
      await supabaseAdmin
        .from('tournees')
        .update({ spoke_importe: true })
        .eq('id', tourneeId);
    } else {
      // Créer une nouvelle tournée
      const { data: newTournee, error: tourneeError } = await supabaseAdmin
        .from('tournees')
        .insert({
          journee_id: journee.id,
          chauffeur_id: chauffeur_id,
          nb_colis: 0,
          spoke_importe: true,
        })
        .select('id')
        .single();

      if (tourneeError) throw tourneeError;
      tourneeId = newTournee.id;
    }

    // Parser le fichier Spoke PDF
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(file.buffer);
    const text = pdfData.text;

    console.log('PDF Text extracted, length:', text.length);

    // Extraire les numéros de tracking et leur ordre
    // Format Spoke: chaque ligne contient un numéro d'ordre et un tracking dans Notes
    // Formats de tracking:
    // - GFFR + 14 chiffres (Gofo)
    // - CNFR + chiffres + HD (Cainiao)
    // - DOFR + chiffres + HD (Autre)
    const trackingOrders = [];
    
    // Pattern pour capturer les trackings dans le format Spoke
    // Les trackings sont généralement suivis de ; dans la colonne Notes
    const trackingPattern = /([A-Z]{2}FR\d{10,20}(?:HD)?);?/gi;
    
    let match;
    let orderNum = 1;
    
    while ((match = trackingPattern.exec(text)) !== null) {
      const tracking = match[1].replace(/;$/, '').trim();
      trackingOrders.push({ tracking, ordre: orderNum });
      orderNum++;
    }

    console.log('Trackings found:', trackingOrders.length);
    if (trackingOrders.length > 0) {
      console.log('First 5 trackings:', trackingOrders.slice(0, 5));
    }

    // Mettre à jour les colis avec leur ordre
    let updatedCount = 0;
    for (const { tracking, ordre } of trackingOrders) {
      const { data: updated } = await supabaseAdmin
        .from('colis')
        .update({ ordre, tournee_id: tourneeId })
        .eq('tracking', tracking)
        .eq('journee_id', journee.id)
        .select('id');

      if (updated && updated.length > 0) {
        updatedCount++;
      }
    }

    // Mettre à jour le nombre de colis de la tournée
    const { count: nbColis } = await supabaseAdmin
      .from('colis')
      .select('id', { count: 'exact', head: true })
      .eq('tournee_id', tourneeId);

    await supabaseAdmin
      .from('tournees')
      .update({ nb_colis: nbColis || 0 })
      .eq('id', tourneeId);

    res.json({
      success: true,
      data: {
        tournee_id: tourneeId,
        chauffeur: `${chauffeur.prenom} ${chauffeur.nom}`,
        trackings_trouves: trackingOrders.length,
        colis_mis_a_jour: updatedCount,
      },
    });
  } catch (error) {
    console.error('Create tournee with spoke error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de la création de la tournée',
    });
  }
};

/**
 * DELETE /tournees/:id
 * Supprimer une tournée et ses colis
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que la tournée existe
    const { data: tournee, error: fetchError } = await supabaseAdmin
      .from('tournees')
      .select('id, chauffeur_id')
      .eq('id', id)
      .single();

    if (fetchError || !tournee) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Tournée non trouvée',
      });
    }

    // Supprimer d'abord les colis de cette tournée
    const { error: colisError } = await supabaseAdmin
      .from('colis')
      .delete()
      .eq('tournee_id', id);

    if (colisError) {
      console.error('Error deleting colis:', colisError);
      throw colisError;
    }

    // Supprimer la tournée
    const { error: tourneeError } = await supabaseAdmin
      .from('tournees')
      .delete()
      .eq('id', id);

    if (tourneeError) {
      console.error('Error deleting tournee:', tourneeError);
      throw tourneeError;
    }

    res.json({
      success: true,
      message: 'Tournée supprimée avec succès',
    });
  } catch (error) {
    console.error('Delete tournee error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de la suppression de la tournée',
    });
  }
};

module.exports = {
  list,
  get,
  exportTournee,
  importSpoke,
  remove,
  createWithSpoke,
};
