-- ============================================
-- TRIZEE LITE - SCHÉMA BASE DE DONNÉES
-- PostgreSQL / Supabase
-- ============================================

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE: users
-- Utilisateurs de l'application
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'sous_traitant', 'trieur')),
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100),
    telephone VARCHAR(20),
    sous_traitant_id UUID,
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_sous_traitant ON users(sous_traitant_id);

-- ============================================
-- TABLE: sous_traitants
-- Entreprises sous-traitantes
-- ============================================
CREATE TABLE sous_traitants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom_entreprise VARCHAR(255) NOT NULL,
    siret VARCHAR(20),
    adresse TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ajouter la FK sur users après création des deux tables
ALTER TABLE users 
ADD CONSTRAINT fk_users_sous_traitant 
FOREIGN KEY (sous_traitant_id) REFERENCES sous_traitants(id) ON DELETE SET NULL;

-- ============================================
-- TABLE: chauffeurs
-- Chauffeurs livreurs (appartiennent à un ST)
-- ============================================
CREATE TABLE chauffeurs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sous_traitant_id UUID NOT NULL REFERENCES sous_traitants(id) ON DELETE CASCADE,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100),
    telephone VARCHAR(20),
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chauffeurs_sous_traitant ON chauffeurs(sous_traitant_id);
CREATE INDEX idx_chauffeurs_nom ON chauffeurs(nom);

-- ============================================
-- TABLE: journees
-- Journées de tri (une par jour)
-- ============================================
CREATE TABLE journees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE UNIQUE NOT NULL,
    deadline TIME DEFAULT '22:30:00',
    deadline_active BOOLEAN DEFAULT true,
    statut VARCHAR(20) DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'terminee')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_journees_date ON journees(date);
CREATE INDEX idx_journees_statut ON journees(statut);

-- ============================================
-- TABLE: tournees
-- Tournées de livraison (une par chauffeur par jour)
-- ============================================
CREATE TABLE tournees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journee_id UUID NOT NULL REFERENCES journees(id) ON DELETE CASCADE,
    chauffeur_id UUID NOT NULL REFERENCES chauffeurs(id) ON DELETE CASCADE,
    spoke_importe BOOLEAN DEFAULT false,
    date_spoke_import TIMESTAMP WITH TIME ZONE,
    nb_colis INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Une seule tournée par chauffeur par jour
    UNIQUE(journee_id, chauffeur_id)
);

CREATE INDEX idx_tournees_journee ON tournees(journee_id);
CREATE INDEX idx_tournees_chauffeur ON tournees(chauffeur_id);

-- ============================================
-- TABLE: colis
-- Colis à trier
-- ============================================
CREATE TABLE colis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournee_id UUID REFERENCES tournees(id) ON DELETE CASCADE,
    journee_id UUID NOT NULL REFERENCES journees(id) ON DELETE CASCADE,
    tracking VARCHAR(50) NOT NULL,
    adresse TEXT,
    ville VARCHAR(100),
    code_postal VARCHAR(10),
    numero_ordre INTEGER, -- Optionnel, pour Spoke
    source VARCHAR(20) NOT NULL CHECK (source IN ('gofo', 'cainiao', 'spoke', 'inconnu')),
    statut VARCHAR(20) DEFAULT 'non_trie' CHECK (statut IN ('non_trie', 'trie', 'inconnu')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour recherche rapide par tracking
CREATE INDEX idx_colis_tracking ON colis(tracking);
CREATE INDEX idx_colis_journee ON colis(journee_id);
CREATE INDEX idx_colis_tournee ON colis(tournee_id);
CREATE INDEX idx_colis_statut ON colis(statut);

-- Index unique pour éviter les doublons de tracking par journée
CREATE UNIQUE INDEX idx_colis_tracking_journee ON colis(UPPER(tracking), journee_id);

-- ============================================
-- TABLE: scans
-- Enregistrements des scans (un seul par colis)
-- ============================================
CREATE TABLE scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    colis_id UUID NOT NULL REFERENCES colis(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    heure_scan TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    mode_hors_ligne BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Un seul scan par colis
CREATE UNIQUE INDEX idx_scans_colis ON scans(colis_id);
CREATE INDEX idx_scans_user ON scans(user_id);
CREATE INDEX idx_scans_heure ON scans(heure_scan);

-- ============================================
-- TABLE: imports
-- Historique des imports de fichiers
-- ============================================
CREATE TABLE imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    journee_id UUID NOT NULL REFERENCES journees(id) ON DELETE CASCADE,
    chauffeur_id UUID REFERENCES chauffeurs(id) ON DELETE SET NULL,
    type_fichier VARCHAR(20) NOT NULL CHECK (type_fichier IN ('gofo', 'cainiao', 'spoke')),
    nom_fichier VARCHAR(255) NOT NULL,
    nb_colis_importes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_imports_journee ON imports(journee_id);
CREATE INDEX idx_imports_user ON imports(user_id);

-- ============================================
-- TABLE: token_blacklist
-- Tokens JWT invalidés (logout)
-- ============================================
CREATE TABLE token_blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_token_blacklist_hash ON token_blacklist(token_hash);
CREATE INDEX idx_token_blacklist_expires ON token_blacklist(expires_at);

-- ============================================
-- VUE: vue_avancement_tri
-- Avancement du tri par tournée
-- ============================================
CREATE OR REPLACE VIEW vue_avancement_tri AS
SELECT 
    t.id AS tournee_id,
    t.journee_id,
    t.chauffeur_id,
    c.nom AS chauffeur_nom,
    c.prenom AS chauffeur_prenom,
    c.sous_traitant_id,
    st.nom_entreprise AS sous_traitant_nom,
    t.nb_colis AS total_colis,
    COALESCE(
        (SELECT COUNT(*) FROM colis WHERE tournee_id = t.id AND statut = 'trie'),
        0
    ) AS colis_tries,
    CASE 
        WHEN t.nb_colis > 0 THEN 
            ROUND((COALESCE((SELECT COUNT(*) FROM colis WHERE tournee_id = t.id AND statut = 'trie'), 0)::DECIMAL / t.nb_colis) * 100, 1)
        ELSE 0 
    END AS pourcentage,
    t.spoke_importe
FROM tournees t
JOIN chauffeurs c ON t.chauffeur_id = c.id
JOIN sous_traitants st ON c.sous_traitant_id = st.id;

-- ============================================
-- FONCTION: Nettoyer les tokens expirés
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM token_blacklist WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Mise à jour automatique de updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger sur les tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sous_traitants_updated_at BEFORE UPDATE ON sous_traitants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chauffeurs_updated_at BEFORE UPDATE ON chauffeurs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journees_updated_at BEFORE UPDATE ON journees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournees_updated_at BEFORE UPDATE ON tournees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_colis_updated_at BEFORE UPDATE ON colis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DONNÉES INITIALES
-- ============================================

-- Créer un utilisateur admin par défaut
-- Mot de passe: admin123 (à changer en production!)
INSERT INTO users (email, password_hash, role, nom, prenom, actif)
VALUES (
    'admin@trizee.fr',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- bcrypt hash de "admin123"
    'admin',
    'Admin',
    'Trizee',
    true
);

-- ============================================
-- COMMENTAIRES
-- ============================================
COMMENT ON TABLE users IS 'Utilisateurs de l''application (admin, sous-traitant, trieur)';
COMMENT ON TABLE sous_traitants IS 'Entreprises sous-traitantes de livraison';
COMMENT ON TABLE chauffeurs IS 'Chauffeurs livreurs appartenant aux sous-traitants';
COMMENT ON TABLE journees IS 'Journées de tri (une par jour)';
COMMENT ON TABLE tournees IS 'Tournées de livraison (une par chauffeur par jour)';
COMMENT ON TABLE colis IS 'Colis à trier avec leur tracking et adresse';
COMMENT ON TABLE scans IS 'Enregistrements des scans effectués par les trieurs';
COMMENT ON TABLE imports IS 'Historique des imports de fichiers Gofo/Cainiao/Spoke';
COMMENT ON TABLE token_blacklist IS 'Tokens JWT invalidés lors de la déconnexion';
