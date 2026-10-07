// services/pawapay.js
// Appels à l'API PawaPay v2 (dépôts Mobile Money)
//
// Variables d'environnement :
// - PAWAPAY_BASE_URL  : https://api.sandbox.pawapay.io (test)
//                       https://api.pawapay.io         (production)
// - PAWAPAY_API_TOKEN : token API du tableau de bord PawaPay

const PAYS = 'COD';

// Limites des opérateurs gardées en mémoire 1 heure
const DUREE_CACHE_CONFIG = 60 * 60 * 1000;

let cacheConfig = null;
let dateCacheConfig = 0;

// =====================================================
// REQUÊTE HTTP
// =====================================================

const appelerPawapay = async (methode, chemin, corps) => {

  const baseUrl = process.env.PAWAPAY_BASE_URL;
  const token = process.env.PAWAPAY_API_TOKEN;

  if (!baseUrl || !token) {
    throw new Error('PAWAPAY_BASE_URL ou PAWAPAY_API_TOKEN manquant dans le .env');
  }

  const reponse = await fetch(`${baseUrl}${chemin}`, {
    method: methode,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: corps ? JSON.stringify(corps) : undefined,
    signal: AbortSignal.timeout(30000)
  });

  const texte = await reponse.text();

  let donnees = null;
  try {
    donnees = texte ? JSON.parse(texte) : null;
  } catch {
    donnees = { brut: texte };
  }

  return { httpStatus: reponse.status, donnees };

};

// =====================================================
// LIMITES D'UN OPÉRATEUR (montant min / max, décimales)
// =====================================================

const getLimitesOperateur = async (provider, devise) => {

  if (!cacheConfig || Date.now() - dateCacheConfig > DUREE_CACHE_CONFIG) {

    const { httpStatus, donnees } = await appelerPawapay(
      'GET',
      `/v2/active-conf?country=${PAYS}&operationType=DEPOSIT`
    );

    if (httpStatus !== 200) {
      throw new Error(`Configuration PawaPay indisponible (HTTP ${httpStatus})`);
    }

    cacheConfig = donnees;
    dateCacheConfig = Date.now();

  }

  const pays = (cacheConfig.countries || []).find(c => c.country === PAYS);
  const operateur = (pays?.providers || []).find(p => p.provider === provider);
  const monnaie = (operateur?.currencies || []).find(c => c.currency === devise);
  const depot = monnaie?.operationTypes?.DEPOSIT;

  if (!depot) {
    return null;
  }

  return {
    min: Number(depot.minAmount),
    max: Number(depot.maxAmount),
    decimales: depot.decimalsInAmount === 'NONE' ? 0 : 2,
    disponible: depot.status === 'OPERATIONAL'
  };

};

// =====================================================
// MONTANT AU FORMAT PAWAPAY
// Chaîne sans zéro inutile : 10 → "10", 10.5 → "10.5"
// =====================================================

const formaterMontant = (montant, decimales) => {
  const facteur = 10 ** decimales;
  return String(Math.round(montant * facteur) / facteur);
};

// =====================================================
// DÉPÔT : LANCER LE PAIEMENT
// Le fidèle reçoit la demande de code PIN sur son téléphone
// =====================================================

const initierDepot = ({ depositId, montant, devise, telephone, provider, reference }) =>
  appelerPawapay('POST', '/v2/deposits', {
    depositId,
    amount: montant,
    currency: devise,
    payer: {
      type: 'MMO',
      accountDetails: {
        phoneNumber: telephone,
        provider
      }
    },
    clientReferenceId: reference,
    // 4 à 22 caractères, lettres / chiffres / espaces (visible par le fidèle)
    customerMessage: 'Flechissons'
  });

// =====================================================
// DÉPÔT : STATUT OFFICIEL CHEZ PAWAPAY
// Renvoie data du dépôt, ou null s'il est introuvable
// =====================================================

const getDepot = async (depositId) => {

  const { httpStatus, donnees } = await appelerPawapay(
    'GET',
    `/v2/deposits/${encodeURIComponent(depositId)}`
  );

  if (httpStatus !== 200 || donnees?.status !== 'FOUND') {
    return null;
  }

  return donnees.data;

};

module.exports = {
  getLimitesOperateur,
  formaterMontant,
  initierDepot,
  getDepot
};
