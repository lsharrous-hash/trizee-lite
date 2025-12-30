import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDate } from '../context/DateContext';
import { tourneesAPI, chauffeursAPI } from '../services/api';
import {
  Package,
  Truck,
  Download,
  Loader,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertTriangle,
  Plus,
  X,
  Upload,
  FileText,
} from 'lucide-react';

export default function Tournees() {
  const { user, isAdmin } = useAuth();
  const { selectedDate, formatDate } = useDate();
  const [tournees, setTournees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [colisData, setColisData] = useState({});
  const [loadingColis, setLoadingColis] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // Modal ajout tournée (admin)
  const [showAddModal, setShowAddModal] = useState(false);
  const [chauffeurs, setChauffeurs] = useState([]);
  const [selectedChauffeur, setSelectedChauffeur] = useState('');
  const [spokeFile, setSpokeFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Import Spoke pour une tournée existante (sous-traitant)
  const [importingSpoke, setImportingSpoke] = useState(null);
  const [spokeImportResult, setSpokeImportResult] = useState(null);
  const spokeInputRefs = useRef({});

  const isSousTraitant = user?.role === 'sous_traitant';

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await tourneesAPI.list(selectedDate);
      setTournees(response.data.data || []);
    } catch (err) {
      console.error('Error fetching tournees:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChauffeurs = async () => {
    try {
      const response = await chauffeursAPI.list();
      setChauffeurs(response.data.data || []);
    } catch (err) {
      console.error('Error fetching chauffeurs:', err);
    }
  };

  useEffect(() => {
    fetchData();
    setExpandedId(null);
    setColisData({});
  }, [selectedDate]);

  const openAddModal = () => {
    fetchChauffeurs();
    setSelectedChauffeur('');
    setSpokeFile(null);
    setUploadError(null);
    setShowAddModal(true);
  };

  const toggleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);

    if (!colisData[id]) {
      setLoadingColis(id);
      try {
        const response = await tourneesAPI.get(id);
        setColisData((prev) => ({ ...prev, [id]: response.data.data.colis || [] }));
      } catch (err) {
        console.error('Error fetching colis:', err);
      } finally {
        setLoadingColis(null);
      }
    }
  };

  const handleExport = async (id, chauffeurNom) => {
    try {
      const response = await tourneesAPI.export(id);
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tournee_${chauffeurNom}_${selectedDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erreur lors de l\'export');
    }
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    try {
      await tourneesAPI.delete(id);
      setTournees((prev) => prev.filter((t) => t.id !== id));
      setShowDeleteConfirm(null);
      setExpandedId(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la suppression');
    } finally {
      setDeleting(null);
    }
  };

  // Import Spoke pour une tournée existante
  const handleSpokeImport = async (tourneeId, file) => {
    if (!file) return;

    setImportingSpoke(tourneeId);
    setSpokeImportResult(null);

    try {
      const response = await tourneesAPI.importSpoke(tourneeId, file);
      setSpokeImportResult({
        tourneeId,
        success: true,
        message: `${response.data.data.colis_mis_a_jour} colis mis à jour avec l'ordre de livraison`,
      });
      // Recharger les données de la tournée
      setColisData((prev) => ({ ...prev, [tourneeId]: null }));
      const tourneeResponse = await tourneesAPI.get(tourneeId);
      setColisData((prev) => ({ ...prev, [tourneeId]: tourneeResponse.data.data.colis || [] }));
      // Rafraîchir la liste pour mettre à jour le badge Spoke
      fetchData();
    } catch (err) {
      setSpokeImportResult({
        tourneeId,
        success: false,
        message: err.response?.data?.message || 'Erreur lors de l\'import',
      });
    } finally {
      setImportingSpoke(null);
    }
  };

  // Drag & Drop pour le fichier Spoke (modal admin)
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.pdf')) {
      setSpokeFile(file);
      setUploadError(null);
    } else {
      setUploadError('Seuls les fichiers PDF sont acceptés');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSpokeFile(file);
      setUploadError(null);
    }
  };

  const handleAddTournee = async () => {
    if (!selectedChauffeur) {
      setUploadError('Veuillez sélectionner un chauffeur');
      return;
    }
    if (!spokeFile) {
      setUploadError('Veuillez sélectionner un fichier Spoke PDF');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      await tourneesAPI.createWithSpoke(selectedChauffeur, spokeFile, selectedDate);
      setShowAddModal(false);
      fetchData();
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Erreur lors de la création de la tournée');
    } finally {
      setUploading(false);
    }
  };

  // Grouper les chauffeurs par sous-traitant pour le select
  const chauffeursByST = chauffeurs.reduce((acc, c) => {
    const stNom = c.sous_traitant?.nom_entreprise || c.sous_traitants?.nom_entreprise || 'Sans sous-traitant';
    if (!acc[stNom]) acc[stNom] = [];
    acc[stNom].push(c);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tournées</h1>
          <p className="text-gray-500">{tournees.length} tournée(s) - {formatDate(selectedDate)}</p>
        </div>
        {isAdmin && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            <span>Ajouter tournée</span>
          </button>
        )}
      </div>

      {/* Liste des tournées */}
      {tournees.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Aucune tournée pour cette date</p>
          {isAdmin && (
            <button
              onClick={openAddModal}
              className="mt-4 text-blue-600 hover:underline"
            >
              Créer une tournée manuellement
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {tournees.map((tournee) => (
            <div key={tournee.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Header de la tournée */}
              <div 
                className="p-6 cursor-pointer hover:bg-gray-50 transition"
                onClick={() => toggleExpand(tournee.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <Truck className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">
                          {tournee.chauffeur?.prenom} {tournee.chauffeur?.nom}
                        </h3>
                        {/* Badge Spoke importé */}
                        {tournee.spoke_importe && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                            Spoke ✓
                          </span>
                        )}
                        {/* Badges sources */}
                        <div className="flex gap-1">
                          {tournee.sources?.gofo && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                              Gofo {tournee.sources.nb_gofo > 0 && `(${tournee.sources.nb_gofo})`}
                            </span>
                          )}
                          {tournee.sources?.cainiao && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                              Cainiao {tournee.sources.nb_cainiao > 0 && `(${tournee.sources.nb_cainiao})`}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">{tournee.sous_traitant?.nom_entreprise}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold">{tournee.nb_colis || 0}</p>
                        <p className="text-xs text-gray-500">Colis</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">{tournee.nb_tries || 0}</p>
                        <p className="text-xs text-gray-500">Triés</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{tournee.pourcentage || 0}%</p>
                        <p className="text-xs text-gray-500">Avancement</p>
                      </div>
                    </div>

                    {/* Chevron */}
                    {expandedId === tournee.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Barre de progression */}
                <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      tournee.pourcentage >= 100 ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${tournee.pourcentage || 0}%` }} 
                  />
                </div>

                {/* Stats mobile */}
                <div className="sm:hidden mt-4 flex justify-around text-center">
                  <div>
                    <p className="text-lg font-bold">{tournee.nb_colis || 0}</p>
                    <p className="text-xs text-gray-500">Colis</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">{tournee.nb_tries || 0}</p>
                    <p className="text-xs text-gray-500">Triés</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{tournee.pourcentage || 0}%</p>
                    <p className="text-xs text-gray-500">Avancement</p>
                  </div>
                </div>
              </div>

              {/* Contenu expandé */}
              {expandedId === tournee.id && (
                <div className="border-t border-gray-100">
                  {/* Actions */}
                  <div className="p-4 bg-gray-50 flex flex-wrap gap-2 items-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExport(tournee.id, tournee.chauffeur?.nom); }}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                    >
                      <Download className="w-4 h-4" />
                      <span>Exporter Excel</span>
                    </button>

                    {/* Bouton Importer Spoke - pour sous-traitant et admin */}
                    <div className="relative">
                      <input
                        ref={(el) => spokeInputRefs.current[tournee.id] = el}
                        type="file"
                        accept=".pdf"
                        onChange={(e) => {
                          handleSpokeImport(tournee.id, e.target.files[0]);
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          spokeInputRefs.current[tournee.id]?.click();
                        }}
                        disabled={importingSpoke === tournee.id}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                      >
                        {importingSpoke === tournee.id ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            <span>Import...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span>Importer Spoke</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Résultat de l'import Spoke */}
                    {spokeImportResult?.tourneeId === tournee.id && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                        spokeImportResult.success 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {spokeImportResult.success ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <AlertTriangle className="w-4 h-4" />
                        )}
                        <span>{spokeImportResult.message}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSpokeImportResult(null); }}
                          className="ml-1 hover:opacity-70"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Bouton Supprimer - admin seulement */}
                    {isAdmin && (
                      <>
                        {showDeleteConfirm === tournee.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-red-600 flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4" />
                              Confirmer ?
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(tournee.id); }}
                              disabled={deleting === tournee.id}
                              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                            >
                              {deleting === tournee.id ? 'Suppression...' : 'Oui, supprimer'}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(null); }}
                              className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(tournee.id); }}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Supprimer</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Liste des colis */}
                  <div className="max-h-96 overflow-y-auto">
                    {loadingColis === tournee.id ? (
                      <div className="p-8 text-center">
                        <Loader className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12">#</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tracking</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Adresse</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Source</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {colisData[tournee.id]?.map((colis, index) => (
                            <tr key={colis.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-bold text-purple-600">
                                {colis.ordre || '-'}
                              </td>
                              <td className="px-4 py-3 font-mono text-sm">{colis.tracking}</td>
                              <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">
                                {colis.adresse}{colis.ville && `, ${colis.ville}`}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {colis.source === 'gofo' && (
                                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">Gofo</span>
                                )}
                                {colis.source === 'cainiao' && (
                                  <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">Cainiao</span>
                                )}
                                {!colis.source && (
                                  <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {colis.statut === 'trie' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                                    <CheckCircle className="w-3 h-3" />
                                    Trié
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                                    <Clock className="w-3 h-3" />
                                    En attente
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Ajouter tournée (Admin) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ajouter une tournée</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Info date */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  📅 Tournée pour le <strong>{formatDate(selectedDate)}</strong>
                </p>
              </div>

              {/* Erreur */}
              {uploadError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {uploadError}
                </div>
              )}

              {/* Sélection chauffeur */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chauffeur *
                </label>
                <select
                  value={selectedChauffeur}
                  onChange={(e) => setSelectedChauffeur(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Sélectionner un chauffeur...</option>
                  {Object.entries(chauffeursByST).map(([stNom, chauffs]) => (
                    <optgroup key={stNom} label={stNom}>
                      {chauffs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.prenom} {c.nom}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Upload fichier Spoke */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fichier Spoke (PDF optimisé) *
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`
                    border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition
                    ${dragOver ? 'border-purple-400 bg-purple-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}
                    ${spokeFile ? 'border-green-400 bg-green-50' : ''}
                  `}
                >
                  {spokeFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-10 h-10 text-green-600" />
                      <p className="font-medium text-green-700">{spokeFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(spokeFile.size / 1024).toFixed(1)} Ko
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSpokeFile(null); }}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Supprimer
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-10 h-10 text-gray-400" />
                      <p className="text-gray-600">
                        Glisser-déposer ou <span className="text-blue-600">cliquer</span>
                      </p>
                      <p className="text-sm text-gray-400">PDF uniquement</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Info Spoke */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-800">
                  💡 Le fichier Spoke contient l'ordre de livraison optimisé. 
                  Les colis existants seront mis à jour avec leur numéro d'ordre.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleAddTournee}
                disabled={uploading || !selectedChauffeur || !spokeFile}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader className="w-4 h-4 animate-spin" />
                    Création...
                  </span>
                ) : (
                  'Créer la tournée'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
