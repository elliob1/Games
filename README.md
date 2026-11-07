# PlayZone v2

Nouvelle interface (néon, navigation en pilule, thèmes) + onglet **Outils**.

## Mettre en ligne (Netlify)

1. Remplace le contenu du dépôt `elliob1/game` par ces fichiers (ou crée une branche `v2`).
2. Netlify > Site configuration > Environment variables : ajoute `ANTHROPIC_API_KEY` (clé créée sur console.anthropic.com).
   - Optionnel : `CHAT_MODEL` (par défaut `claude-haiku-5-5`, le moins cher).
3. Redéploie. Sans la clé, tout fonctionne sauf le tuteur IA (il affiche un message clair).

La clé reste côté serveur (`netlify/functions/chat.js`), jamais dans le navigateur. Limites : 12 messages/minute par visiteur, 2000 caractères par message.

## Essayer en local

`python3 -m http.server 8765` puis ouvre http://localhost:8765 (le tuteur IA ne marche qu'avec `netlify dev` ou une fois déployé).

## Onglet Outils

Tuteur IA (10 matières), calculatrice scientifique, minuteur Pomodoro, calculateur de moyenne / note visée, convertisseur d'unités, bloc-notes.
Pour ajouter un outil : crée `js/tool-monoutil.js` (voir l'en-tête de `js/tools.js`), ajoute son `<script>` dans `index.html` et son id dans `ORDER`.
Les matières du tuteur se modifient dans `netlify/functions/chat.js` (consignes) et `js/tools.js` (cartes).

## Images des jeux

Chaque jeu a une vignette emoji par défaut. Pour mettre de vraies images :

1. Crée (ou utilise) le dossier `image/` à la racine du site.
2. Mets-y une image par jeu, **nommée avec l'id du jeu** : `snake.jpg`, `2048.webp`, `drivemadsugarland.png`…
   Le titre exact marche aussi (`Snake Classic.png`) ; majuscules, accents et espaces sont tolérés.
   Pour voir tous les ids : `node tools/link-images.js --list`.
3. Format conseillé : carré **480 × 480 px**, JPG ou WebP, moins de 100 Ko. (Acceptés : jpg, jpeg, png, webp, gif, avif.)
4. Lance `node tools/link-images.js` (ou pousse simplement sur GitHub : **Netlify le lance à chaque déploiement**).

Le script met à jour `data/games.json` : jeu avec image → l'image s'affiche ; jeu sans image → l'emoji reste. Il ne touche jamais à tes fichiers, signale les noms qui ne correspondent à aucun jeu (avec le jeu le plus proche) et les images trop lourdes. `--dry-run` pour simuler.

Les 29 images déjà dans `image/` sont des captures d'écran de jeux (ids en nom de fichier) ; remplace-les librement par les tiennes (même nom = remplacée).
Outils facultatifs : `tools/screenshot-games.js` capture un jeu ouvert dans Chrome (Playwright), `tools/fetch-images.js` cherche des images libres sur Wikipédia ; tous deux écrivent dans `image/`.

## Tests

`node tests/calc.test.js` · `node tests/chat.test.js` · `node tests/link-images.test.js` · `node tests/behavior.js` (serveur local lancé + Playwright).
