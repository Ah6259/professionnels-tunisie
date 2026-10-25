# Professionnels Tunisie — annuaire (professionnels-tunisie)

> **Ce site** : https://ah6259.github.io/professionnels-tunisie/ — annuaire gratuit qui REGROUPE les métiers de nos 4 annuaires
> spécialisés (auto-écoles, avocats/notaires/huissiers/traducteurs, comptables/conseillers fiscaux, mariage) et ajoute 13 métiers
> d'artisans et de services. Couleur vert sobre (#2E6B4E), icône mallette. Les 4 annuaires spécialisés continuent à vivre séparément.
> Pas de cours particuliers. **Santé ajoutée le 22/10/2026 (décision d'Ahmed)** : médecins, dentistes, cliniques et chirurgie,
> pharmacies (catégorie « Santé », avec les opticiens) ; liens vers l'Ordre et les sites médicaux connus en « Voir aussi ».
> Étape suivante prévue : notre propre liste de médecins classée par spécialité (les spécialités sont rarement dans OpenStreetMap).

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
  publie. Jamais de cours particuliers (la santé est permise depuis le 22/10/2026).
  Depuis le 22/10/2026, elle cherche aussi l'ORGANISME de la profession (lien `"organisme": true` ou `"organisme_aucun"`, voir le
  CLAUDE.md du moteur).

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
- `maj.yml` le 1er de chaque mois (02h40 UTC, décision d'Ahmed du 10/10/2026 ; aussi à chaque modification de `config.json` et à la main) : relevé OSM → reprise des 4 annuaires (étape présente aussi dans le maj.yml du moteur, sans
  effet sur les sites qui n'ont pas `tools/importer_annuaires.py`) → pages → tests → publication. `tests.yml` à chaque modification.
- **18/10/2026 (VS.8, règle commune du 15/10)** : `maj.yml` ENREGISTRE (commit + push avec 5 essais) `donnees/osm.json` (+ `importes.json`) juste après le relevé, AVANT les pages et les tests ; les pages ne sont publiées que si les tests passent. Tout dans le même robot (un seul robot en attente par groupe de concurrence). Le `maj.yml` n'est PAS copié par `synchroniser.py` : le même fichier est dans les 5 annuaires, à modifier partout pareil.
- Le moteur commun (`annuaires/moteur/`) est copié ici par `python annuaires/synchroniser.py` (CLAUDE.md et README.md jamais écrasés).
  Ne pas modifier les fichiers du moteur dans ce dossier.

## Tests
`node tools/construire.mjs` puis `node tools/test_site.mjs` → **TOUT PASSE** (jsdom : `npm install --no-save --no-package-lock jsdom`).

## Professionnels
`inscriptions_ouvertes: true` depuis le 06/10/2026 (accord de l'INPDP obtenu par Ahmed, `config.pro.inpdp_accord` ; paiement D17, IZI, Wafacash, preuve par WhatsApp). Formule Pro : 29 DT la 1re année puis 59 DT/an
(`config.json` → `pro`), 1er mois offert, sans renouvellement automatique.

- **Vidéos de présentation** (06/10/2026) : `assets/video/presentation.mp4` (visiteurs) et `presentation-pro.mp4` (professionnels), 1080 × 1920, + couvertures et aperçus 1200 × 630 (`apercu-video*.jpg`). Musique de fond : J. S. Bach, Aria des Variations Goldberg (enregistrement Musopen, CC0, Wikimedia Commons ; preuve dans le dossier privé `videos (outil)/preuves musique/`). Pages **`video/`** et **`video-pro/`** fabriquées par `tools/page_video.mjs` (appelé par construire.mjs, à partir de À propos : mêmes en-tête, pied, CSP) avec og:video / og:image. Le bouton « Partager » envoie un LIEN : la page vidéo (video-pro/ sur inscription/) + l'adresse du site dans le texte, jamais le fichier. Tests dans test_site.mjs.
  Pour refaire les vidéos : `python fabriquer.py <id-du-site>` dans le dossier PRIVÉ du PC `videos (outil)/`.

- **Adresse depuis le 11/10/2026 : https://pros.clicvia.com/** (config.json « url » ; le moteur écrit le fichier CNAME, préfixe GoatCounter /professionnels-tunisie). Ligne DNS `CNAME pros → ah6259.github.io` nuage gris. L'ancienne adresse ah6259.github.io/professionnels-tunisie/ redirige seule.

- **Visiteur simulé (18/10/2026, règle générale d'Ahmed : signaler les problèmes AVANT le visiteur réel)** : `python3 tools/visiteur_simule.py`
  (outil COMMUN à tous les sites, copie identique, ne pas le modifier ici) — liens/images internes morts, puis Chrome à 390 px : page plus
  large que l'écran, image cassée, « NaN / undefined », page vide. Scénarios `tools/scenarios-visiteur.json` FABRIQUÉS par construire.mjs
  à partir des vraies fiches : recherche par nom, par gouvernorat, par métier (un filtre de plus ne donne jamais plus de résultats), page
  d'un gouvernorat, fiche avec son bouton « Appeler », accueil en arabe. Lancé par `tests.yml` et `maj.yml` (étape « Visiteur simule »).
  1re anomalie trouvée : en-tête trop large sur téléphone (Mariage 395 px, Professionnels 417 px) → corrigé dans style.css du moteur.

- **Lieux officiels (18/10/2026, règle commune § 11.11)** : test_site.mjs vérifie dans les deux sens que la liste « Gouvernorat » (accueil, formulaires, pages, carte) = les 24 gouvernorats de La Poste, rien d'autre (les annuaires ne filtrent pas par délégation ; « ville » = texte libre) ; la carte de l'accueil entoure le gouvernorat choisi dans le filtre (annuaire.js).
- 18/10/2026 : recherche « au son » (Jerba = Djerba, Houmt = Houmet, Qairouan = Kairouan, lettres doublées…), même calcul pour ce qu'on tape et pour la liste ; test de paires d'écritures.

- **19/10/2026 — Visiteur simulé : contrôle des ESPACES (§ 29)** : cases gouvernorat / métier, le nombre était COLLÉ au nom (« Traducteurs66 ») ou SORTAIT de la case (« Photographes 46 ») → corrigé dans style.css du moteur (le nombre passe sous un nom trop long) ; 0 anomalie.

- **RÈGLE D'AHMED (25/10/2026, règle commune § 44) : la page « Comment fonctionne le site ? » (`a-propos/`, FR + AR) est mise à jour à CHAQUE
  modification visible, dans le même envoi.** Elle est fabriquée par le moteur commun (bloc « Comment fonctionne le site ? » de
  `tools/construire.mjs`, à modifier dans `annuaires/moteur/` du dépôt projets-ahmed) ; lien sur l'accueil (`.lien-comment`) et dans le pied
  de page de toutes les pages (`assets/page.js`). Test « FONCTIONS » dans `tools/test_site.mjs` : une fonction présente dans les pages mais
  absente de la page = test rouge = publication bloquée ; nouvelle fonction = une ligne dans `FONCTIONS` + son explication.
