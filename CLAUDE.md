# Professionnels Tunisie — annuaire (professionnels-tunisie)

> **Ce site** : https://ah6259.github.io/professionnels-tunisie/ — annuaire gratuit qui REGROUPE les métiers de nos 4 annuaires
> spécialisés (auto-écoles, avocats/notaires/huissiers/traducteurs, comptables/conseillers fiscaux, mariage) et ajoute 13 métiers
> d'artisans et de services. Couleur vert sobre (#2E6B4E), icône mallette. Les 4 annuaires spécialisés continuent à vivre séparément.
> Pas de santé ni de cours particuliers.

Fichier lu par Claude Code au début de chaque session. **Dépôt PUBLIC : rien de personnel ni de secret, jamais le nom d'un concurrent.**
Répondre à Ahmed **en français**, simplement. Règles communes : `../../regles communes a tous les sites.md`.

## Métiers (config.json, une étiquette OpenStreetMap par ligne)
- Repris de nos annuaires (mêmes identifiants) : auto-ecole, avocat, notaire, huissier, traducteur, comptable, conseiller-fiscal,
  salle-des-fetes, photographe, traiteur, patisserie, coiffure-beaute.
- Ajoutés ici : plombier (`craft=plumber`), electricien (`craft=electrician`), menuisier (`craft=carpenter`, `craft=joiner`),
  aluminium-vitrerie (`craft=window_construction`, `craft=glaziery`), peintre (`craft=painter`), climatisation (`craft=hvac`,
  `shop=air_conditioning`), serrurier (`craft=locksmith`, `shop=locksmith`), mecanicien (`shop=car_repair`), pneus (`shop=tyres`),
  reparation-telephone (`craft=electronics_repair`, `shop=mobile_phone`), informatique (`shop=computer`, `office=it`),
  architecte (`office=architect`), demenagement (`office=moving_company`).
- Images des métiers : `assets/metiers/<id>.svg` (48 × 48, fond pastel, aplats, accent doré) ; celles des 12 métiers repris viennent
  des annuaires d'origine.

- **Catégories** (`config.json` → `categories`, 08/10/2026) : 5 boutons sur l'accueil (juridique et comptable, fêtes et beauté,
  maison et travaux, voiture et transport, téléphone et informatique). Chaque métier est dans UNE seule catégorie (testé) :
  tout nouveau métier doit être ajouté à une catégorie (ou à une nouvelle catégorie, nom FR + AR).
- **Un nouveau métier par jour** (demande d'Ahmed, 08/10/2026) : routine cloud `professionnels-nouveau-metier` (2h30, heure de
  Tunis, avant le relevé OpenStreetMap de 3h40). Elle choisit un métier absent, vérifie dans OpenStreetMap qu'il existe en Tunisie
  avec assez de fiches joignables, l'ajoute (étiquettes OSM, noms FR + AR, mots de recherche, catégorie, image SVG), teste et
  publie. Jamais de santé ni de cours particuliers.

## D'où viennent les fiches
1. `donnees/osm.json` : robot OpenStreetMap (`tools/releve_osm.py`, moteur commun).
2. `donnees/importes.json` : **reprise de NOS 4 annuaires** par `tools/importer_annuaires.py` (propre à ce site) : télécharge
   `manuels.json`, `osm.json` et `retraits.json` des dépôts publics Ah6259/<annuaire>, garde les métiers de config.json, préfixe
   les identifiants (`ae-`, `an-`, `co-`, `ma-`), ignore les fiches retirées là-bas, les objets OSM déjà relevés ici et les pages déjà
   dans manuels.json. Si un dépôt ne répond pas, ses anciennes fiches sont gardées. Le script complète aussi les sites OSM saisis
   sans « https:// ».
3. `donnees/manuels.json` : fiches « web » relevées le 06/10/2026 sur la **page publique de l'établissement lui-même** (Facebook,
   site) : nom, gouvernorat, lien de la page, date. Jamais d'annuaire concurrent ni d'agrégateur, ni RNE, ni Google Maps.
   Liste de travail gardée hors dépôt : `annuaires/preuves/2026-10-06/professionnels-tunisie__releve_pages_publiques.tsv`.
4. `donnees/retraits.json` : fiches retirées à la demande (jamais republiées).

## Couverture
`node tools/couverture.mjs` : tableau métier × gouvernorat (objectif : au moins 3 fiches partout). Les gouvernorats de l'intérieur
et du Sud (Béja, Jendouba, Kasserine, Kébili, Siliana, Sidi Bouzid, Tozeur, Zaghouan…) manquent encore de fiches d'artisans.

## Robots (sans PC)
- `maj.yml` chaque nuit (02h40 UTC) : relevé OSM → reprise des 4 annuaires (étape présente aussi dans le maj.yml du moteur, sans
  effet sur les sites qui n'ont pas `tools/importer_annuaires.py`) → pages → tests → publication. `tests.yml` à chaque modification.
- Le moteur commun (`annuaires/moteur/`) est copié ici par `python annuaires/synchroniser.py` (CLAUDE.md et README.md jamais écrasés).
  Ne pas modifier les fichiers du moteur dans ce dossier.

## Tests
`node tools/construire.mjs` puis `node tools/test_site.mjs` → **TOUT PASSE** (jsdom : `npm install --no-save --no-package-lock jsdom`).

## Professionnels
`inscriptions_ouvertes: false` tant que la déclaration INPDP n'est pas faite. Formule Pro : 29 DT la 1re année puis 59 DT/an
(`config.json` → `pro`), 1er mois offert, sans renouvellement automatique.

- **Vidéos de présentation** (06/10/2026) : `assets/video/presentation.mp4` (visiteurs) et `presentation-pro.mp4` (professionnels), 1080 × 1920, + couvertures et aperçus 1200 × 630 (`apercu-video*.jpg`). Musique de fond : J. S. Bach, Aria des Variations Goldberg (enregistrement Musopen, CC0, Wikimedia Commons ; preuve dans le dossier privé `videos (outil)/preuves musique/`). Pages **`video/`** et **`video-pro/`** fabriquées par `tools/page_video.mjs` (appelé par construire.mjs, à partir de À propos : mêmes en-tête, pied, CSP) avec og:video / og:image. Le bouton « Partager » envoie un LIEN : la page vidéo (video-pro/ sur inscription/) + l'adresse du site dans le texte, jamais le fichier. Tests dans test_site.mjs.
  Pour refaire les vidéos : `python fabriquer.py <id-du-site>` dans le dossier PRIVÉ du PC `videos (outil)/`.

- **Adresse depuis le 11/10/2026 : https://pros.clicvia.com/** (config.json « url » ; le moteur écrit le fichier CNAME, préfixe GoatCounter /professionnels-tunisie). Ligne DNS `CNAME pros → ah6259.github.io` nuage gris. L'ancienne adresse ah6259.github.io/professionnels-tunisie/ redirige seule.
