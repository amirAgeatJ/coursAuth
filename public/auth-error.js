const REASON_MESSAGES = {
  access_denied: "Vous avez annulé la connexion sur la page du fournisseur.",
  state_mismatch: "La requête a expiré ou semble invalide. Merci de réessayer.",
  token_exchange_failed: "Le fournisseur a refusé l'échange du jeton.",
  profile_fetch_failed: "Impossible de récupérer votre profil auprès du fournisseur.",
  server_error: "Une erreur interne est survenue.",
};

const reason = new URLSearchParams(window.location.search).get('reason');
document.getElementById('reasonText').textContent =
  REASON_MESSAGES[reason] || 'Une erreur est survenue pendant l\'authentification.';
