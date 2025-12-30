import { useState, useEffect } from 'react';
import { chauffeursAPI, sousTraitantsAPI } from '../services/api';
import {
  Truck,
  Plus,
  Edit,
  Trash2,
  X,
  Loader,
  Phone,
  Building,
} from 'lucide-react';

export default function Chauffeurs() {
  const [chauffeurs, setChauffeurs] = useState([]);
  const [sousTraitants, setSousTraitants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    sous_traitant_id: '',
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  const fetchData = async () => {
    try {
      const [chauffeursRes, stRes] = await Promise.all([
        chauffeursAPI.list(),
        sousTraitantsAPI.list(),
      ]);
      setChauffeurs(chauffeursRes.data.data || []);
      setSousTraitants(stRes.data.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      nom: '',
      prenom: '',
      telephone: '',
      sous_traitant_id: sousTraitants[0]?.id || '',
    });
    setError(null);
    setShowModal(true);
  };

  const openEditModal = (chauffeur) => {
    setEditingId(chauffeur.id);
    setFormData({
      nom: chauffeur.nom,
      prenom: chauffeur.prenom || '',
      telephone: chauffeur.telephone || '',
      sous_traitant_id: chauffeur.sous_traitant_id,
    });
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (editingId) {
        await chauffeursAPI.update(editingId, formData);
      } else {
        await chauffeursAPI.create(formData);
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Une erreur est survenue');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce chauffeur ?')) {
      return;
    }

    try {
      await chauffeursAPI.delete(id);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const filteredChauffeurs = filter === 'all'
    ? chauffeurs
    : chauffeurs.filter((c) => c.sous_traitant_id === filter);

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
          <h1 className="text-2xl font-bold text-gray-900">Chauffeurs</h1>
          <p className="text-gray-500">{chauffeurs.length} chauffeur(s)</p>
        </div>
        <button
          onClick={openCreateModal}
          disabled={sousTraitants.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          <span>Ajouter</span>
        </button>
      </div>

      {/* Filtre par ST */}
      {sousTraitants.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Tous
          </button>
          {sousTraitants.map((st) => (
            <button
              key={st.id}
              onClick={() => setFilter(st.id)}
              className={`px-4 py-2 rounded-lg transition ${
                filter === st.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {st.nom_entreprise}
            </button>
          ))}
        </div>
      )}

      {/* Liste */}
      {sousTraitants.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-yellow-800">
            Vous devez d'abord créer un sous-traitant avant d'ajouter des chauffeurs.
          </p>
        </div>
      ) : filteredChauffeurs.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <Truck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Aucun chauffeur pour le moment</p>
          <button
            onClick={openCreateModal}
            className="mt-4 text-blue-600 hover:underline"
          >
            Créer le premier chauffeur
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredChauffeurs.map((chauffeur) => (
            <div key={chauffeur.id} className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Truck className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      {chauffeur.prenom} {chauffeur.nom}
                    </h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Building className="w-3 h-3" />
                      {chauffeur.sous_traitant?.nom_entreprise}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditModal(chauffeur)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(chauffeur.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {chauffeur.telephone && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Phone className="w-4 h-4" />
                  <span>{chauffeur.telephone}</span>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-gray-100">
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                  chauffeur.actif
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {chauffeur.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingId ? 'Modifier' : 'Nouveau'} chauffeur
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sous-traitant *
                </label>
                <select
                  value={formData.sous_traitant_id}
                  onChange={(e) => setFormData({ ...formData, sous_traitant_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                >
                  <option value="">Sélectionner...</option>
                  {sousTraitants.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.nom_entreprise}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom
                  </label>
                  <input
                    type="text"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
