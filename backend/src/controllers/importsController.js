const { supabaseAdmin } = require('../config/supabase');
const { parseExcel, parseGofoExcel, parseCainiaoExcel, parseSpokePDF } = require('../services/importService');
const { findByName } = require('./chauffeursController');
const path = require('path');

/**
 * Retourne la date de demain au format YYYY-MM-DD
 */
function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * GET /imports
 * Liste des imports du jour
 */
const list = async (req, res) => {
  try {
    const targetDate = req.query.date || getTomorrowDate();

    const { data: journee } = await supabaseAdmin
      .from('journees')
      .select('id')
      .eq('date', targetDate)
      .single();

    if (!journee) {
      return res.json({ success: true, data: [] });
    }

    const { data, error } = await supabaseAdmin
      .from('imports')
      .select('*')
      .eq('journee_id', journee.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error('List imports error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de la récupération des imports',
    });
  }
};

/**
 * POST /imports/gofo
 * Importer un fichier Gofo Excel (par chauffeur)
 * Nom du fichier = nom du chauffeur
 */
const importGofo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'NO_FILE',
        message: 'Fichier requis',
      });
    }

    const result = await processExcelImport(req, 'gofo', parseGofoExcel);
    res.status(201).json(result);

  } catch (error) {
    console.error('Import Gofo error:', error);
    res.status(500).json({
      success: false,
      error: 'IMPORT_ERROR',
      message: error.message || 'Erreur lors de l\'import',
    });
  }
};

/**
 * POST /imports/cainiao
 * Importer un fichier Cainiao Excel (par chauffeur)
 * Nom du fichier = nom du chauffeur
 */
const importCainiao = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'NO_FILE',
        message: 'Fichier requis',
      });
    }

    const result = await processExcelImport(req, 'cainiao', parseCainiaoExcel);
    res.status(201).json(result);

  } catch (error) {
    console.error('Import Cainiao error:', error);
    res.status(500).json({
      success: false,
      error: 'IMPORT_ERROR',
      message: error.message || 'Erreur lors de l\'import',
    });
  }
};

/**
 * POST /imports/spoke
 * Importer un fichier Spoke multi-chauffeurs (PDF) - Cas Reims
 * Dispatche automatiquement les colis vers les bons chauffeurs selon l'en-tête
 */
const importSpoke = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'NO_FILE',
        message: 'Fichier PDF requis',
      });
    }

    // Utiliser la date fournie ou demain par défaut
    const targetDate = req.body.date || req.query.date || getTomorrowDate();

    // Récupérer ou créer la journée
    let { data: journee } = await supabaseAdmin
      .from('journees')
      .select('id')
      .eq('date', targetDate)
      .single();

    if (!journee) {
      const { data: newJournee } = await supabaseAdmin
        .from('journees')
        .insert({ date: targetDate, statut: 'en_cours' })
        .select()
        .single();
      journee = newJournee;
    }

    // Parser le PDF Spoke
    const spokeData = await parseSpokePDF(req.file.buffer);

    if (!spokeData || spokeData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'PARSE_ERROR',
        message: 'Impossible de lire le fichier Spoke ou aucun chauffeur trouvé',
      });
    }

    let totalColis = 0;
    const chauffeurResults = [];

    // Pour chaque chauffeur dans le Spoke
    for (const chauffeurData of spokeData) {
      const chauffeur = await findByName(chauffeurData.nom);

      if (!chauffeur) {
        chauffeurResults.push({
          nom: chauffeurData.nom,
          status: 'not_found',
          message: 'Chauffeur non trouvé dans la base',
          colis: 0,
        });
        continue;
      }

      // Vérifier/créer la tournée
      let { data: tournee } = await supabaseAdmin
        .from('tournees')
        .select('id')
        .eq('journee_id', journee.id)
        .eq('chauffeur_id', chauffeur.id)
        .single();

      if (!tournee) {
        const { data: newTournee } = await supabaseAdmin
          .from('tournees')
          .insert({
            journee_id: journee.id,
            chauffeur_id: chauffeur.id,
            spoke_importe: false,
          })
          .select()
          .single();
        tournee = newTournee;
      }

      // Importer les colis
      let colisImported = 0;
      for (const colis of chauffeurData.colis) {
        // Vérifier si le colis existe déjà
        const { data: existing } = await supabaseAdmin
          .from('colis')
          .select('id')
          .ilike('tracking', colis.tracking)
          .eq('journee_id', journee.id)
          .single();

        if (!existing) {
          await supabaseAdmin
            .from('colis')
            .insert({
              tournee_id: tournee.id,
              journee_id: journee.id,
              tracking: colis.tracking,
              adresse: colis.adresse,
              source: 'spoke',
              statut: 'non_trie',
            });
          colisImported++;
        }
      }

      // Mettre à jour nb_colis de la tournée
      const { count } = await supabaseAdmin
        .from('colis')
        .select('id', { count: 'exact', head: true })
        .eq('tournee_id', tournee.id);

      await supabaseAdmin
        .from('tournees')
        .update({ nb_colis: count })
        .eq('id', tournee.id);

      totalColis += colisImported;
      chauffeurResults.push({
        nom: chauffeurData.nom,
        chauffeur_id: chauffeur.id,
        status: 'imported',
        colis_importes: colisImported,
        colis_total_spoke: chauffeurData.colis.length,
      });
    }

    // Enregistrer l'import
    await supabaseAdmin
      .from('imports')
      .insert({
        user_id: req.user.id,
        journee_id: journee.id,
        type_fichier: 'spoke',
        nom_fichier: req.file.originalname,
        nb_colis_importes: totalColis,
      });

    res.status(201).json({
      success: true,
      data: {
        type: 'spoke',
        nom_fichier: req.file.originalname,
        date: targetDate,
        total_colis_importes: totalColis,
        chauffeurs: chauffeurResults,
      },
    });

  } catch (error) {
    console.error('Import Spoke error:', error);
    res.status(500).json({
      success: false,
      error: 'IMPORT_ERROR',
      message: error.message || 'Erreur lors de l\'import',
    });
  }
};

/**
 * DELETE /imports/:id
 * Supprimer un import (et ses colis associés)
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('imports')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Import supprimé',
    });
  } catch (error) {
    console.error('Delete import error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de la suppression',
    });
  }
};

/**
 * Fonction utilitaire pour traiter un import Excel (Gofo/Cainiao)
 * @param {Object} req - Request Express avec fichier
 * @param {string} type - Type d'import ('gofo' ou 'cainiao')
 * @param {Function} parseFunction - Fonction de parsing à utiliser
 */
async function processExcelImport(req, type, parseFunction) {
  // Utiliser la date fournie ou demain par défaut
  const targetDate = req.body.date || req.query.date || getTomorrowDate();

  // Récupérer ou créer la journée
  let { data: journee } = await supabaseAdmin
    .from('journees')
    .select('id')
    .eq('date', targetDate)
    .single();

  if (!journee) {
    const { data: newJournee } = await supabaseAdmin
      .from('journees')
      .insert({ date: targetDate, statut: 'en_cours' })
      .select()
      .single();
    journee = newJournee;
  }

  // Extraire le nom du chauffeur du nom de fichier
  const fileName = req.file.originalname;
  const chauffeurName = path.basename(fileName, path.extname(fileName));

  // Trouver le chauffeur
  const chauffeur = await findByName(chauffeurName);

  if (!chauffeur) {
    throw new Error(`Chauffeur "${chauffeurName}" non trouvé. Vérifiez le nom du fichier.`);
  }

  // Parser le fichier Excel avec la fonction appropriée
  const colis = await parseFunction(req.file.buffer);

  if (!colis || colis.length === 0) {
    throw new Error('Fichier vide ou format invalide');
  }

  // Vérifier/créer la tournée
  let { data: tournee } = await supabaseAdmin
    .from('tournees')
    .select('id')
    .eq('journee_id', journee.id)
    .eq('chauffeur_id', chauffeur.id)
    .single();

  if (!tournee) {
    const { data: newTournee } = await supabaseAdmin
      .from('tournees')
      .insert({
        journee_id: journee.id,
        chauffeur_id: chauffeur.id,
        spoke_importe: false,
      })
      .select()
      .single();
    tournee = newTournee;
  }

  // Importer les colis (éviter les doublons par tracking)
  let colisImported = 0;
  let colisSkipped = 0;

  for (const colisData of colis) {
    // Vérifier si le colis existe déjà (dans toute la journée)
    const { data: existing } = await supabaseAdmin
      .from('colis')
      .select('id')
      .ilike('tracking', colisData.tracking)
      .eq('journee_id', journee.id)
      .single();

    if (!existing) {
      await supabaseAdmin
        .from('colis')
        .insert({
          tournee_id: tournee.id,
          journee_id: journee.id,
          tracking: colisData.tracking,
          adresse: colisData.adresse,
          ville: colisData.ville,
          code_postal: colisData.code_postal,
          source: type,
          statut: 'non_trie',
        });
      colisImported++;
    } else {
      colisSkipped++;
    }
  }

  // Mettre à jour nb_colis de la tournée
  const { count } = await supabaseAdmin
    .from('colis')
    .select('id', { count: 'exact', head: true })
    .eq('tournee_id', tournee.id);

  await supabaseAdmin
    .from('tournees')
    .update({ nb_colis: count })
    .eq('id', tournee.id);

  // Enregistrer l'import
  const { data: importRecord } = await supabaseAdmin
    .from('imports')
    .insert({
      user_id: req.user.id,
      journee_id: journee.id,
      chauffeur_id: chauffeur.id,
      type_fichier: type,
      nom_fichier: fileName,
      nb_colis_importes: colisImported,
    })
    .select()
    .single();

  return {
    success: true,
    data: {
      id: importRecord.id,
      type_fichier: type,
      nom_fichier: fileName,
      date: targetDate,
      chauffeur_id: chauffeur.id,
      chauffeur_nom: `${chauffeur.prenom || ''} ${chauffeur.nom}`.trim(),
      colis_importes: colisImported,
      colis_ignores: colisSkipped,
      colis_total_fichier: colis.length,
      journee_id: journee.id,
    },
  };
}

module.exports = {
  list,
  importGofo,
  importCainiao,
  importSpoke,
  remove,
};