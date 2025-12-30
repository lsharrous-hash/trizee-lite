const XLSX = require('xlsx');
const pdfParse = require('pdf-parse');

/**
 * Parse un fichier Gofo Excel
 * Colonnes: data.waybillNo, data.statusName, data.toState, data.toCity, data.toArea, data.toStreet
 * @param {Buffer} buffer - Le contenu du fichier
 * @returns {Array} Liste des colis
 */
async function parseGofoExcel(buffer) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convertir en JSON avec headers
    const data = XLSX.utils.sheet_to_json(sheet);
    
    if (!data || data.length === 0) {
      return [];
    }
    
    const colis = [];
    
    for (const row of data) {
      // Colonnes Gofo
      const tracking = row['data.waybillNo'];
      const adresse = row['data.toStreet'];
      const ville = row['data.toCity'];
      const departement = row['data.toState'];
      // Gofo n'a pas de code postal
      
      if (tracking) {
        const trackingClean = String(tracking).trim().toUpperCase();
        
        // Ignorer les lignes sans tracking valide
        if (trackingClean.length < 5) continue;
        
        colis.push({
          tracking: trackingClean,
          adresse: adresse ? String(adresse).trim() : null,
          ville: ville ? String(ville).trim() : null,
          code_postal: null, // Gofo n'a pas de CP
          departement: departement ? String(departement).trim() : null,
        });
      }
    }
    
    return colis;
    
  } catch (error) {
    console.error('Parse Gofo Excel error:', error);
    throw new Error('Erreur lors de la lecture du fichier Gofo');
  }
}

/**
 * Parse un fichier Cainiao Excel
 * Colonnes: Tracking No., Sort Code, Receiver's Region/Province, Receiver's City, Receiver's Detail Address
 * @param {Buffer} buffer - Le contenu du fichier
 * @returns {Array} Liste des colis
 */
async function parseCainiaoExcel(buffer) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convertir en JSON avec headers
    const data = XLSX.utils.sheet_to_json(sheet);
    
    if (!data || data.length === 0) {
      return [];
    }
    
    const colis = [];
    
    for (const row of data) {
      // Colonnes Cainiao
      const tracking = row['Tracking No.'];
      const codePostal = row['Sort Code'];
      const departement = row["Receiver's Region/Province"];
      const ville = row["Receiver's City"];
      const adresse = row["Receiver's Detail Address"];
      
      if (tracking) {
        const trackingClean = String(tracking).trim().toUpperCase();
        
        // Ignorer les lignes sans tracking valide
        if (trackingClean.length < 5) continue;
        
        colis.push({
          tracking: trackingClean,
          adresse: adresse ? String(adresse).trim() : null,
          ville: ville ? String(ville).trim() : null,
          code_postal: codePostal ? String(codePostal).trim() : null,
          departement: departement ? String(departement).trim() : null,
        });
      }
    }
    
    return colis;
    
  } catch (error) {
    console.error('Parse Cainiao Excel error:', error);
    throw new Error('Erreur lors de la lecture du fichier Cainiao');
  }
}

/**
 * Parse un fichier Excel générique (détection auto Gofo/Cainiao)
 * @param {Buffer} buffer - Le contenu du fichier
 * @returns {Object} { type: 'gofo'|'cainiao'|'unknown', colis: Array }
 */
async function parseExcel(buffer) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Lire les headers pour détecter le format
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (!data || data.length < 2) {
      return { type: 'unknown', colis: [] };
    }
    
    const headers = data[0].map(h => String(h || '').toLowerCase());
    
    // Détecter si c'est Gofo ou Cainiao
    const isGofo = headers.some(h => h.includes('waybillno') || h.includes('data.waybillno'));
    const isCainiao = headers.some(h => h.includes('tracking no'));
    
    if (isGofo) {
      const colis = await parseGofoExcel(buffer);
      return { type: 'gofo', colis };
    } else if (isCainiao) {
      const colis = await parseCainiaoExcel(buffer);
      return { type: 'cainiao', colis };
    }
    
    // Format inconnu - essayer parsing générique
    console.warn('Format Excel non reconnu, tentative de parsing générique');
    const colis = await parseGenericExcel(buffer);
    return { type: 'unknown', colis };
    
  } catch (error) {
    console.error('Parse Excel error:', error);
    throw new Error('Erreur lors de la lecture du fichier Excel');
  }
}

/**
 * Parse un fichier Excel générique (fallback)
 * Suppose: colonne A = tracking, puis adresse, ville, CP
 */
async function parseGenericExcel(buffer) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (!data || data.length < 2) {
      return [];
    }
    
    const colis = [];
    
    // Ignorer la première ligne (headers)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      const tracking = row[0];
      
      if (tracking) {
        const trackingClean = String(tracking).trim().toUpperCase();
        if (trackingClean.length < 5) continue;
        
        colis.push({
          tracking: trackingClean,
          adresse: row[1] ? String(row[1]).trim() : null,
          ville: row[2] ? String(row[2]).trim() : null,
          code_postal: row[3] ? String(row[3]).trim() : null,
        });
      }
    }
    
    return colis;
    
  } catch (error) {
    console.error('Parse generic Excel error:', error);
    throw new Error('Erreur lors de la lecture du fichier Excel');
  }
}

/**
 * Parse un PDF Spoke multi-chauffeurs (cas Reims)
 * Format en-tête: (HAKIM 1-69)(LOUIS 70-168)(ABDEL 169-256)...
 * Format lignes: # | Address | Time | Notes (tracking)
 * @param {Buffer} buffer - Le contenu du fichier PDF
 * @returns {Array} Liste des chauffeurs avec leurs colis
 */
async function parseSpokePDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    const text = data.text;
    
    // 1. Extraire les plages chauffeurs de l'en-tête
    // Format: (HAKIM 1-69)(LOUIS 70-168)...
    const headerMatch = text.match(/\([A-Z]+\s+\d+-\d+\)/gi);
    
    if (!headerMatch || headerMatch.length === 0) {
      throw new Error('Format Spoke non reconnu: en-tête chauffeurs introuvable');
    }
    
    // Parser les plages
    const chauffeurRanges = [];
    for (const match of headerMatch) {
      // (HAKIM 1-69) -> { nom: 'HAKIM', debut: 1, fin: 69 }
      const parsed = match.match(/\(([A-Z]+)\s+(\d+)-(\d+)\)/i);
      if (parsed) {
        chauffeurRanges.push({
          nom: parsed[1].toUpperCase(),
          debut: parseInt(parsed[2]),
          fin: parseInt(parsed[3]),
          colis: [],
        });
      }
    }
    
    // 2. Extraire les colis du tableau
    // Format ligne: numéro, adresse, heure, tracking (dans Notes)
    const lines = text.split('\n');
    
    for (const line of lines) {
      // Chercher les lignes avec un numéro d'ordre au début
      // Format: "1 44BOULEVARD DES PHÉNICIENS..." ou "1\t44BOULEVARD..."
      const lineMatch = line.match(/^(\d+)\s+(.+)/);
      
      if (lineMatch) {
        const ordre = parseInt(lineMatch[1]);
        const reste = lineMatch[2];
        
        // Chercher le tracking dans la ligne (format: CNFR... ou DOFR... ou GFFR...)
        const trackingMatch = reste.match(/([A-Z]{2}FR\d{13}[A-Z]{2})/i);
        
        if (trackingMatch) {
          const tracking = trackingMatch[1].toUpperCase();
          
          // Extraire l'adresse (tout avant le tracking, nettoyé)
          const adressePartie = reste.substring(0, reste.indexOf(trackingMatch[0])).trim();
          // Enlever l'heure à la fin (format 00:09 ou similaire)
          const adresse = adressePartie.replace(/\d{1,2}:\d{2}\s*$/, '').trim();
          
          // Trouver à quel chauffeur appartient ce colis
          for (const chauffeur of chauffeurRanges) {
            if (ordre >= chauffeur.debut && ordre <= chauffeur.fin) {
              chauffeur.colis.push({
                tracking,
                adresse,
                ordre_dans_tournee: ordre - chauffeur.debut + 1, // Position relative dans la tournée
              });
              break;
            }
          }
        }
      }
    }
    
    // Filtrer les chauffeurs sans colis
    return chauffeurRanges.filter(c => c.colis.length > 0);
    
  } catch (error) {
    console.error('Parse Spoke PDF error:', error);
    throw new Error('Erreur lors de la lecture du fichier Spoke: ' + error.message);
  }
}

/**
 * Alias pour compatibilité
 */
async function parseSpokeMultiPDF(buffer) {
  return parseSpokePDF(buffer);
}

/**
 * Parse un PDF Spoke pour une tournée unique (réimport par le ST)
 * @param {Buffer} buffer - Le contenu du fichier PDF
 * @returns {Array} Liste des colis avec numéros d'ordre
 */
async function parseSpokeSinglePDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    const text = data.text;
    
    const colis = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    for (const line of lines) {
      // Format attendu: N. TRACKING - Adresse
      // ou: N TRACKING Adresse
      const match = line.match(/^(\d+)[.\-\s]+([A-Z0-9]{8,})/i);
      
      if (match) {
        const ordre = parseInt(match[1]);
        const tracking = match[2].toUpperCase();
        
        colis.push({
          ordre,
          tracking,
        });
      }
    }
    
    return colis;
    
  } catch (error) {
    console.error('Parse Spoke single PDF error:', error);
    throw new Error('Erreur lors de la lecture du fichier Spoke');
  }
}

/**
 * Parse une adresse complète pour extraire ville et CP
 */
function parseAdresse(adresseComplete) {
  // Format typique: "12 rue de Paris, 94200 Ivry-sur-Seine"
  // ou: "12 rue de Paris 94200 Ivry-sur-Seine"
  
  let adresse = adresseComplete;
  let ville = null;
  let code_postal = null;
  
  // Chercher le code postal (5 chiffres)
  const cpMatch = adresseComplete.match(/\b(\d{5})\b/);
  if (cpMatch) {
    code_postal = cpMatch[1];
    
    // La ville est généralement après le CP
    const afterCP = adresseComplete.substring(adresseComplete.indexOf(code_postal) + 5).trim();
    if (afterCP) {
      ville = afterCP.replace(/^[,\s]+/, '').trim();
    }
    
    // L'adresse est avant le CP
    adresse = adresseComplete.substring(0, adresseComplete.indexOf(code_postal)).replace(/[,\s]+$/, '').trim();
  }
  
  return { adresse, ville, code_postal };
}

/**
 * Génère un fichier Excel pour export de tournée
 * @param {Array} colis - Liste des colis
 * @returns {Buffer} Fichier Excel
 */
function generateExcel(colis) {
  const data = [
    ['Tracking', 'Adresse', 'Ville', 'Code Postal'],
    ...colis.map(c => [c.tracking, c.adresse, c.ville, c.code_postal]),
  ];
  
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(data);
  
  // Ajuster la largeur des colonnes
  sheet['!cols'] = [
    { wch: 20 }, // Tracking
    { wch: 40 }, // Adresse
    { wch: 20 }, // Ville
    { wch: 10 }, // CP
  ];
  
  XLSX.utils.book_append_sheet(workbook, sheet, 'Tournee');
  
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  parseExcel,
  parseGofoExcel,
  parseCainiaoExcel,
  parseGenericExcel,
  parseSpokePDF,
  parseSpokeMultiPDF,
  parseSpokeSinglePDF,
  parseAdresse,
  generateExcel,
};
