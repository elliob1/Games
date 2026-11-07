/* ============================================================
   CONFIGURATION DU SITE — le seul fichier à modifier pour les pubs
   ============================================================
   Pour activer Google AdSense :
   1. Une fois ton compte AdSense approuvé, mets enabled: true
   2. Remplace client par ton identifiant éditeur (ca-pub-XXXXXXXXXXXXXXXX)
   3. Crée des blocs d'annonces dans AdSense (Annonces > Par bloc d'annonces)
      et colle l'identifiant (slot) de chacun ci-dessous.
      Laisse "" pour désactiver un emplacement.
   4. Modifie aussi le fichier ads.txt (même identifiant, sans "ca-").
*/
window.SITE_CONFIG = {
  siteName: "PlayZone",
  ads: {
    enabled: false,
    client: "ca-pub-XXXXXXXXXXXXXXXX",
    slots: {
      top:    "",   // bannière en haut de la liste de jeux
      bottom: "",   // bannière en bas de la page
      player: ""    // bannière au-dessus du jeu
    }
  }
};
