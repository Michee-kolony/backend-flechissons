// services/rappelEvenements.js
// Rappels automatiques des évènements du calendrier (notification push à tous) :
//
// - la veille : 24 h avant l'évènement  → "Demain : Culte à 09:00"
// - le jour J : à l'heure de l'évènement → "C'est maintenant : Culte"
//
// La date et l'heure d'un évènement sont saisies dans l'heure locale de l'église
// (fuseau EVENEMENT_FUSEAU, Kinshasa par défaut), quel que soit le fuseau du serveur.
// Évènement sans heure : il est considéré comme commençant à HEURE_PAR_DEFAUT.
//
// Chaque rappel n'est envoyé qu'une fois : il est "réservé" dans MongoDB
// (rappelVeilleEnvoye / rappelDebutEnvoye) avant l'envoi. Modifier la date ou
// l'heure d'un évènement remet ces marqueurs à zéro (voir controllers/evenement.js).

const Evenement = require('../models/evenement');
const { envoyerATous, routes } = require('./notification');

const FUSEAU = process.env.EVENEMENT_FUSEAU || 'Africa/Kinshasa';

const HEURE_PAR_DEFAUT = '08:00';

const INTERVALLE_MS = 60 * 1000;

const UN_JOUR_MS = 24 * 60 * 60 * 1000;

// Serveur arrêté au moment prévu : au-delà de ce délai, le rappel n'a plus de sens
const RETARD_MAX_DEBUT_MS = 30 * 60 * 1000;

// Évènement ajouté au dernier moment : pas de rappel "veille" s'il commence dans moins d'1 h
const AVANCE_MIN_VEILLE_MS = 60 * 60 * 1000;


// =====================================================
// FUSEAU HORAIRE
// =====================================================

// Décalage (ms) du fuseau par rapport à UTC à un instant donné
const decalageFuseau = (instant) => {

  const parties = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: FUSEAU,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
      .formatToParts(new Date(instant))
      .map(p => [p.type, p.value])
  );

  const commeUtc = Date.UTC(
    Number(parties.year), Number(parties.month) - 1, Number(parties.day),
    Number(parties.hour), Number(parties.minute), Number(parties.second)
  );

  return commeUtc - Math.floor(instant / 1000) * 1000;
};

// "2026-11-15" + "09:00" (heure de l'église) -> instant UTC en ms
const instantEvenement = (evenement) => {

  const [annee, mois, jour] = evenement.date.split('-').map(Number);
  const [h, m] = (evenement.heure || HEURE_PAR_DEFAUT).split(':').map(Number);

  const commeUtc = Date.UTC(annee, mois - 1, jour, h, m);

  // Deux passes : correct aussi autour d'un changement d'heure
  let instant = commeUtc - decalageFuseau(commeUtc);
  instant = commeUtc - decalageFuseau(instant);

  return instant;
};

// Date du jour "AAAA-MM-JJ" dans le fuseau de l'église
const jourFuseau = (instant) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU }).format(new Date(instant));


// =====================================================
// MESSAGES
// =====================================================

const messageVeille = (evenement, maintenant) => {

  const aujourdhui = jourFuseau(maintenant) === evenement.date;
  const quand = aujourdhui ? "Aujourd'hui" : 'Demain';
  const heure = evenement.heure ? ` à ${evenement.heure}` : '';

  return {
    titre: `${quand} : ${evenement.titre}`,
    message: evenement.description
      ? `${quand}${heure} — ${evenement.description}`
      : `N'oubliez pas : ${evenement.titre} ${quand.toLowerCase()}${heure}.`
  };
};

const messageDebut = (evenement) => ({
  titre: `C'est maintenant : ${evenement.titre}`,
  message: evenement.description
    ? `Vous avez ${evenement.titre} maintenant — ${evenement.description}`
    : `Vous avez ${evenement.titre} maintenant.`
});


// =====================================================
// ENVOI
// =====================================================

// Réserve le rappel (un seul envoi, même avec plusieurs instances du serveur)
const reserver = (evenement, champ) =>
  Evenement.findOneAndUpdate(
    { _id: evenement._id, [champ]: null },
    { [champ]: new Date() },
    { new: true }
  );

const envoyer = (evenement, { titre, message }) =>
  envoyerATous({
    titre,
    message,
    route: routes.evenement(evenement),
    data: { type: 'evenement', evenementId: evenement._id }
  });

const traiterEvenement = async (evenement, maintenant) => {

  const debut = instantEvenement(evenement);

  // Rappel de la veille
  if (!evenement.rappelVeilleEnvoye && maintenant >= debut - UN_JOUR_MS && maintenant < debut) {

    const reserve = await reserver(evenement, 'rappelVeilleEnvoye');

    if (reserve && debut - maintenant >= AVANCE_MIN_VEILLE_MS) {
      await envoyer(reserve, messageVeille(reserve, maintenant));
    }
  }

  // "C'est maintenant"
  if (!evenement.rappelDebutEnvoye && maintenant >= debut) {

    const reserve = await reserver(evenement, 'rappelDebutEnvoye');

    if (reserve && maintenant - debut <= RETARD_MAX_DEBUT_MS) {
      await envoyer(reserve, messageDebut(reserve));
    }
  }
};

let enCours = false;

const verifierRappels = async () => {

  if (enCours) {
    return;
  }
  enCours = true;

  try {

    const maintenant = Date.now();

    // Seuls les évènements d'hier à après-demain peuvent avoir un rappel à envoyer
    const evenements = await Evenement.find({
      date: {
        $gte: jourFuseau(maintenant - UN_JOUR_MS),
        $lte: jourFuseau(maintenant + 2 * UN_JOUR_MS)
      },
      $or: [{ rappelVeilleEnvoye: null }, { rappelDebutEnvoye: null }]
    });

    for (const evenement of evenements) {
      await traiterEvenement(evenement, maintenant);
    }

  } catch (error) {
    console.error('❌ Erreur rappels évènements :', error.message);
  } finally {
    enCours = false;
  }
};

let minuterie = null;

const demarrerRappelsEvenements = () => {

  if (minuterie) {
    return;
  }

  minuterie = setInterval(verifierRappels, INTERVALLE_MS);
  void verifierRappels();

  console.log(`⏰ Rappels des évènements activés (fuseau ${FUSEAU})`);
};

module.exports = {
  demarrerRappelsEvenements,
  verifierRappels,
  instantEvenement
};
