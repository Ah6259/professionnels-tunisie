// Moteur d'annuaire commun : fabrique toutes les pages du site à partir de config.json et des fiches.
//   node tools/construire.mjs        (depuis le dossier du site)
// Fiches : donnees/osm.json (robot OpenStreetMap) + manuels.json (pages publiques) + inscrits.json (inscriptions vérifiées)
//          + importes.json (fiches reprises de nos autres annuaires, pour l'annuaire qui les regroupe)
//          moins donnees/retraits.json (fiches retirées à la demande : jamais republiées).
// Ne pas modifier les pages à la main : modifier ce fichier (dans annuaires/moteur/) puis `python synchroniser.py`.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createHash } from "crypto";
import { TN_CONTOUR, TN_DJERBA, TN_POS } from "./carte_tunisie.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lire = (f, defaut) => existsSync(join(root, f)) ? JSON.parse(readFileSync(join(root, f), "utf8")) : defaut;
const C = lire("config.json");
const URL_SITE = C.url;
const BASE = new URL(URL_SITE).pathname;                     // ex. /auto-ecoles-tunisie/

export const GOUVERNORATS = [
  ["ariana", "Ariana", "أريانة"], ["beja", "Béja", "باجة"], ["ben-arous", "Ben Arous", "بن عروس"], ["bizerte", "Bizerte", "بنزرت"],
  ["gabes", "Gabès", "قابس"], ["gafsa", "Gafsa", "قفصة"], ["jendouba", "Jendouba", "جندوبة"], ["kairouan", "Kairouan", "القيروان"],
  ["kasserine", "Kasserine", "القصرين"], ["kebili", "Kébili", "قبلي"], ["le-kef", "Le Kef", "الكاف"], ["mahdia", "Mahdia", "المهدية"],
  ["la-manouba", "La Manouba", "منوبة"], ["medenine", "Médenine", "مدنين"], ["monastir", "Monastir", "المنستير"], ["nabeul", "Nabeul", "نابل"],
  ["sfax", "Sfax", "صفاقس"], ["sidi-bouzid", "Sidi Bouzid", "سيدي بوزيد"], ["siliana", "Siliana", "سليانة"], ["sousse", "Sousse", "سوسة"],
  ["tataouine", "Tataouine", "تطاوين"], ["tozeur", "Tozeur", "توزر"], ["tunis", "Tunis", "تونس"], ["zaghouan", "Zaghouan", "زغوان"],
];
const G = Object.fromEntries(GOUVERNORATS.map(g => [g[0], g]));
const M = Object.fromEntries(C.metiers.map(m => [m.id, m]));

/* ---------------- fiches ---------------- */
const retraits = new Set(lire("donnees/retraits.json", { ids: [] }).ids || []);
const toutes = [...(lire("donnees/osm.json", { fiches: [] }).fiches || []), ...(lire("donnees/manuels.json", { fiches: [] }).fiches || []), ...(lire("donnees/inscrits.json", { fiches: [] }).fiches || []), ...(lire("donnees/importes.json", { fiches: [] }).fiches || [])]
  .filter(f => f && f.id && f.nom && G[f.gouvernorat] && M[f.metier] && !retraits.has(f.id));
// doublons : même identifiant, ou même nom (sans accents ni casse) à moins de 300 m (point et bâtiment du même lieu dans OSM)
const vus = new Set(), gardees = [];
const nomN = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9؀-ۿ]+/g, " ").trim();
const distM = (a, b) => Math.hypot((a.lat - b.lat) * 111000, (a.lon - b.lon) * 111000 * Math.cos(a.lat * Math.PI / 180));
for (const f of toutes) {
  if (vus.has(f.id)) continue;
  const double = gardees.find(g => nomN(g.nom) === nomN(f.nom) && g.lat && f.lat && distM(g, f) < 300);
  if (double) { for (const k of ["tel", "site", "horaires", "adresse", "ville", "nom_ar"]) if (!double[k] && f[k]) double[k] = f[k]; continue; }
  vus.add(f.id); gardees.push(f);
}
/* ---------------- formule Pro (règles d'Ahmed du 06/10/2026) ----------------
   donnees/pros.json : { "pros": [ { "fiche": "<id>", "formule": "pro" | "gratuite", "debut": "AAAA-MM-JJ",
     "fin_paiement": "AAAA-MM-JJ" (incluse, après réception du virement), "verifiee": "AAAA-MM-JJ",
     "description": {"fr","ar"}, "specialites": ["…"], "whatsapp": "2xxxxxxx", "horaires": "…" } ] }
   - « gratuite » = fiche vérifiée par l'établissement (badge), pour toujours.
   - « pro » = 1er mois GRATUIT à partir de « debut », puis payé par virement jusqu'à « fin_paiement ».
     Sans paiement, la fiche redevient gratuite TOUTE SEULE à la reconstruction de nuit (jamais supprimée). */
const PRO = { mois_gratuits: 1, prix_premiere_annee: 29, prix_an: 59, devise: "DT", virement: {}, ...(C.pro || {}) };
const OUVERT = process.env.PRO_OUVERT === "1" || C.inscriptions_ouvertes === true;   // PRO_OUVERT=1 : aperçu et tests seulement
const AUJ = process.env.AUJOURDHUI || new Date().toISOString().slice(0, 10);
const jourPlus = (d, mois = 0, jours = 0) => { const x = new Date(d + "T00:00:00Z"); x.setUTCMonth(x.getUTCMonth() + mois); x.setUTCDate(x.getUTCDate() + jours); return x.toISOString().slice(0, 10); };
export const ETAT_PROS = {};
for (const p of lire("donnees/pros.json", { pros: [] }).pros || []) {
  if (!p || !p.fiche) continue;
  if (p.formule === "pro" && p.debut) {
    const finEssai = jourPlus(p.debut, PRO.mois_gratuits);                     // exclue
    const actif = AUJ >= p.debut && (AUJ < finEssai || (p.fin_paiement && AUJ <= p.fin_paiement));
    const fin = p.fin_paiement && p.fin_paiement >= finEssai ? p.fin_paiement : jourPlus(finEssai, 0, -1);
    ETAT_PROS[p.fiche] = { ...p, actif, fin, essai: actif && AUJ < finEssai && !p.fin_paiement };
    if (actif && jourPlus(AUJ, 0, 10) >= fin) console.log(`ÉCHÉANCE PROCHE : formule Pro de « ${p.fiche} » jusqu'au ${fin} (prévenir le professionnel)`);
    if (!actif && AUJ > fin) console.log(`(formule Pro de « ${p.fiche} » terminée le ${fin} : fiche redevenue gratuite)`);
  } else ETAT_PROS[p.fiche] = { ...p, actif: false };
}
for (const f of gardees) {
  const p = ETAT_PROS[f.id];
  if (!p) continue;
  f.verifiee = p.verifiee || p.debut || true;
  if (p.actif) {
    f.pro = true;
    for (const k of ["description", "specialites", "whatsapp", "horaires"]) if (p[k]) f[k] = p[k];
  }
}
// règle d'Ahmed (06/10/2026) : aucune fiche vide. Une fiche sans téléphone, sans WhatsApp et sans adresse
// de l'établissement n'est pas publiée (elle reste dans les données et revient toute seule dès qu'un contact est connu).
// règle renforcée (06/10/2026) : une fiche publiée a un TÉLÉPHONE, un WhatsApp ou une ADRESSE ; nom + lien seuls = fiche vide
export const aUnContact = f => !!(f.tel || f.whatsapp || (f.adresse && String(f.adresse).trim().length > 5) || ETAT_PROS[f.id]);
const vides = gardees.filter(f => !aUnContact(f)).length;
if (vides) console.log(`(${vides} fiche(s) sans aucun contact non publiées)`);
export const FICHES = gardees.filter(aUnContact)
  .sort((a, b) => (b.pro ? 1 : 0) - (a.pro ? 1 : 0) || a.nom.localeCompare(b.nom, "fr"));

/* ---------------- outils ---------------- */
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const bi = (fr, ar) => `<span data-l="fr">${fr}</span><span data-l="ar">${ar}</span>`;
const biO = o => bi(esc(o.fr), esc(o.ar));
const ISO = t => "⁦" + t + "⁩";
const telLisible = t => t ? t.replace(/(\d{2})(\d{3})(\d{3})/, "$1 $2 $3") : "";
const mobile = t => !!t && /^[2459]/.test(t);                   // portables tunisiens : 2x, 4x, 5x, 9x
const V = createHash("sha256").update(["assets/style.css", "assets/page.js", "assets/annuaire.js", "assets/avis.js"]
  .map(f => existsSync(join(root, f)) ? readFileSync(join(root, f), "utf8") : "").join("") + JSON.stringify(C)).digest("hex").slice(0, 10);
const CSP = `default-src 'self'; script-src 'self' https://gc.zgo.at; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: ${C.goatcounter}; connect-src 'self' ${C.goatcounter} https://formspree.io; object-src 'none'; base-uri 'self'; form-action 'self' https://formspree.io; upgrade-insecure-requests`;
const ICO = {
  tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 19z"/><path d="M9 9.5c.5 2 2.5 4 4.5 4.5l1-1.5 2 1-.5 1.5c-3 0-7-4-7-7l1.5-.5 1 2z"/>',
  carte: '<path d="M12 21s-7-6.3-7-11.5a7 7 0 0 1 14 0C19 14.7 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  site: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  heure: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  loupe: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>',
  retirer: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  crayon: '<path d="M4 20h4L20 8l-4-4L4 16z"/>',
  ok: '<path d="M5 12l5 5 9-10"/>',
};
const svg = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICO[n]}</svg>`;
const imgMetier = (m, racine, taille = 40) => `<img class="ill-metier" src="${racine}assets/metiers/${m.id}.svg" alt="" width="${taille}" height="${taille}">`;
// photo du bandeau (Wikimedia, licence libre) et son crédit : obligatoires (checklist visuelle)
const P = C.photo;
// photo réelle par métier (config.metiers[].photo, Wikimedia, licence libre) : plus de sérieux ; crédits sur la page À propos
const photoDe = m => (m && m.photo) || P;
const fondPhoto = (ph, racine) => ph ? `<img class="hero-fond" src="${racine}${esc(ph.fichier)}" alt="" width="${ph.largeur || 900}" height="${ph.hauteur || 675}">` : "";
const creditPhoto = () => P && P.mosaique ? `<p class="credit">${bi("Mosaïque de photos", "فسيفساء صور")} : ${P.mosaique.map(c => `<bdi>${esc(c.auteur)}</bdi>`).join(", ")} — ${bi("licences libres", "رخص حرة")} (<a href="${esc(P.licence_url)}" rel="noopener license">${esc(P.licence)}</a>…), <a href="a-propos/">${bi("détail", "التفاصيل")}</a>, Wikimedia Commons</p>` : P ? `<p class="credit">${bi("Photo", "صورة")} : <bdi>${esc(P.auteur)}</bdi>, <a href="${esc(P.licence_url)}" rel="noopener license">${esc(P.licence)}</a>, <a href="${esc(P.source)}" rel="noopener">Wikimedia Commons</a></p>` : "";

function tete({ titre, desc, chemin, racine, jsonld = [] }) {
  return `<!doctype html>
<html translate="no" lang="fr" dir="ltr" data-racine="${racine}" data-base="${BASE}">
<head>
<meta charset="utf-8">
<meta name="google" content="notranslate">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="robots" content="noai, noimageai">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${URL_SITE}${chemin}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(C.nom.fr)}">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${URL_SITE}${chemin}">
<meta property="og:locale" content="fr_TN"><meta property="og:locale:alternate" content="ar_TN">
${C.og_image ? `<meta property="og:image" content="${URL_SITE}assets/${C.og_image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">` : ""}
<link rel="icon" href="${racine}assets/logo.svg" type="image/svg+xml">
<link rel="manifest" href="${racine}manifest.webmanifest">
<link rel="apple-touch-icon" href="${racine}assets/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${esc(C.court.fr)}">
<meta name="theme-color" content="${C.couleur}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700;800&amp;family=Noto+Kufi+Arabic:wght@400;600;700;800&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="${racine}assets/style.css?v=${V}">
<link rel="stylesheet" href="${racine}assets/couleurs.css?v=${V}">
<script defer src="${racine}assets/conf.js?v=${V}"></script>
<script defer src="${racine}assets/page.js?v=${V}"></script>
<script defer src="${racine}assets/annuaire.js?v=${V}"></script>
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("\n")}
<script data-goatcounter="${C.goatcounter}/count" async src="https://gc.zgo.at/count.js"></script>
</head>
<body>
<header class="entete" id="entete"></header>`;
}
const pied = `<footer id="pied"></footer>\n</body>\n</html>\n`;
const fil = (racine, ...etapes) => `<p class="fil"><a href="${racine || "./"}">${bi("Accueil", "الرئيسية")}</a>${etapes.map(e => " › " + e).join("")}</p>`;

// badges honnêtes : « Pro » = formule payante (affichée en premier), « Vérifiée » = l'établissement a confirmé sa fiche
const badges = f => f.pro || f.verifiee ? `<span class="badges">${f.pro ? `<span class="badge pro">Pro</span>` : ""}${f.verifiee ? `<span class="badge verifiee">${svg("ok")}${bi("Vérifiée", "موثّقة")}</span>` : ""}</span>` : "";
const notePro = liste => liste.some(f => f.pro) ? `<p class="note-pro">${bi("Les fiches « Pro » sont affichées en premier : leur abonnement finance l'annuaire gratuit. Les autres fiches sont triées par nom.", "تظهر بطاقات « Pro » أولًا: اشتراكها يموّل الدليل المجاني. البطاقات الأخرى مرتبة حسب الاسم.")}</p>` : "";
const prixTexte = () => PRO.prix_premiere_annee && PRO.prix_premiere_annee !== PRO.prix_an
  ? bi(`${PRO.prix_premiere_annee} ${PRO.devise} la 1re année, puis ${PRO.prix_an} ${PRO.devise}/an`, `${ISO(PRO.prix_premiere_annee)} د.ت السنة الأولى، ثم ${ISO(PRO.prix_an)} د.ت في السنة`)
  : bi(`${PRO.prix_an} ${PRO.devise}/an`, `${ISO(PRO.prix_an)} د.ت في السنة`);

function carte(f, racine) {
  const g = G[f.gouvernorat], m = M[f.metier];
  const cherche = [f.nom, f.nom_ar, f.ville, f.adresse, g[1], g[2], m.fr, m.ar, m.mots].filter(Boolean).join(" ");
  return `<a class="fiche-carte${f.pro ? " pro" : ""}" href="${racine}fiche/${f.id}/" data-cherche="${esc(cherche)}" data-g="${f.gouvernorat}" data-m="${f.metier}">
  ${imgMetier(m, racine, 34)}
  <span class="fc-nom">${esc(f.nom)}${f.nom_ar ? ` <span class="fc-ar" lang="ar">${esc(f.nom_ar)}</span>` : ""}</span>
  ${badges(f)}
  <span class="fc-lieu">${svg("carte")}${[f.ville, null].filter(Boolean).map(esc).join("")}${f.ville ? " · " : ""}${bi(esc(g[1]), esc(g[2]))}</span>
  ${C.metiers.length > 1 ? `<span class="fc-metier">${biO({ fr: m.fr, ar: m.ar })}</span>` : ""}
  ${f.tel ? `<span class="fc-tel">${svg("tel")}<bdi dir="ltr">${telLisible(f.tel)}</bdi></span>` : ""}
</a>`;
}

function filtres(racine, gouvernoratFixe, liste = FICHES) {
  const nb = Object.fromEntries(C.metiers.map(m => [m.id, liste.filter(f => f.metier === m.id).length]));
  const presents = C.metiers.filter(m => nb[m.id] > 0);
  return `<div class="filtres" id="filtres">
  <label class="recherche">${svg("loupe")}<input type="search" id="recherche" autocomplete="off" aria-label="Rechercher"></label>
  ${gouvernoratFixe ? "" : `<select id="choix-g" aria-label="Gouvernorat"><option value="">${esc("Tous les gouvernorats")}</option>${GOUVERNORATS.map(g => `<option value="${g[0]}" data-ar="${esc(g[2])}">${esc(g[1])}</option>`).join("")}</select>`}
  ${presents.length > 1 ? `<div class="puces">${presents.map(m => `<button type="button" class="puce" data-m="${m.id}">${imgMetier(m, racine, 22)}${biO({ fr: m.fr_pl, ar: m.ar_pl })}<span class="n">${nb[m.id]}</span></button>`).join("")}</div>` : ""}
</div>
<p class="compte" id="compte" aria-live="polite"></p>`;
}

const blocPro = racine => `<section class="carte pro-appel">
  <h2>${bi("Vous êtes un professionnel ?", "هل أنت مهني؟")}</h2>
  <p>${bi("Soyez trouvé par les Tunisiens qui vous cherchent. Votre fiche existe peut-être déjà : ajoutez-la, vérifiez-la ou corrigez-la gratuitement.", "اجعل التونسيين الذين يبحثون عنك يجدونك. ربما بطاقتك موجودة: أضفها أو وثّقها أو صحّحها مجانًا.")}</p>
  <div class="actions">
    <a class="btn btn-pro" href="${racine}inscription/#offres">${bi("Inscription Pro : 1er mois gratuit", "تسجيل Pro: الشهر الأول مجاني")}</a>
    <a class="btn clair" href="${racine}inscription/">${svg("crayon")}${bi("Fiche gratuite", "بطاقة مجانية")}</a>
  </div>
</section>`;

// liens vers nos autres sites gratuits (dans les deux sens : demande d'Ahmed), bien visibles, clics comptés anonymement
const liensAmis = () => C.liens && C.liens.length ? `<section class="carte liens-amis"><h2>${bi("Gratuit aussi sur nos sites", "مجانًا أيضًا على مواقعنا")}</h2>${C.liens.map(l => `<a href="${esc(l.url)}" data-lien="${esc(new URL(l.url).pathname.replace(/^\/|\/$/g, ""))}"><strong>${biO(l)} →</strong>${l.desc_fr ? `<small>${biO({ fr: l.desc_fr, ar: l.desc_ar || l.desc_fr })}</small>` : ""}</a>`).join("")}</section>` : "";

const AVIS = `<section class="carte avis" id="avis">
  <h2>${bi("Votre avis", "رأيك يهمّنا")}</h2>
  <p>${bi("Une remarque, une erreur, une idée ? Écrivez-nous : chaque message est lu.", "ملاحظة، خطأ، فكرة؟ اكتب لنا: كل رسالة تُقرأ.")}</p>
  <form class="formulaire" data-envoi="avis" action="${C.formspree}" method="POST">
    <label for="avis-message">${bi("Votre message", "رسالتك")}</label>
    <textarea id="avis-message" name="message" required maxlength="1000" rows="4"></textarea>
    <label for="avis-email">${bi("Votre e-mail (facultatif, pour vous répondre)", "بريدك الإلكتروني (اختياري، للرد عليك)")}</label>
    <input type="email" id="avis-email" name="email" maxlength="200" autocomplete="email">
    <input type="hidden" name="site" value="${esc(C.nom.fr)}"><input type="hidden" name="_subject" value="Avis — ${esc(C.nom.fr)}">
    <input type="text" name="_gotcha" class="piege" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button type="submit" class="btn">${bi("Envoyer", "إرسال")}</button>
    <p class="statut" role="status" aria-live="polite"></p>
  </form>
</section>`;

/* Carte de la Tunisie : une bulle par gouvernorat (taille selon le nombre de fiches), cliquable ; « actif » = gouvernorat de la page.
   Règle d'Ahmed (05/10/2026) : chaque moteur de recherche par gouvernorat a cette carte. */
function carteTunisie(racine, comptes, actif = "") {
  const bulles = GOUVERNORATS.map(([slug, fr, ar]) => {
    const [x, y] = TN_POS[slug], n = comptes[slug] || 0;
    const r = n ? Math.round(Math.min(18, 7.5 + 2.2 * Math.sqrt(n)) * 10) / 10 : 5;
    return `<a href="${racine}gouvernorat/${slug}/" class="tn-b${n ? "" : " vide"}${slug === actif ? " actif" : ""}" data-gouv="${slug}"><title>${esc(fr)} · ${esc(ar)} : ${n}</title><circle cx="${x}" cy="${y}" r="${slug === actif ? Math.max(r, 11) : r}"/>${n ? `<text x="${x}" y="${y}">${n}</text>` : ""}</a>`;
  }).join("");
  return `<svg class="carte-tn" viewBox="0 0 232 462" role="img" aria-label="Carte de la Tunisie par gouvernorat"><path class="tn-terre" d="${TN_CONTOUR}"/><ellipse class="tn-terre" cx="${TN_DJERBA[0]}" cy="${TN_DJERBA[1]}" rx="9" ry="6.5"/>${bulles}</svg>`;
}

/* ---------------- pages ---------------- */
const pages = {};
const compteG = Object.fromEntries(GOUVERNORATS.map(g => [g[0], FICHES.filter(f => f.gouvernorat === g[0]).length]));
const metierPl = C.metiers.length === 1 ? C.metiers[0] : { fr_pl: "professionnels", ar_pl: "مهنيين" };

// accueil
{
  const ld = [{ "@context": "https://schema.org", "@type": "WebSite", name: C.nom.fr, url: URL_SITE, inLanguage: ["fr", "ar"] }];
  pages[""] = tete({ titre: `${C.titre_accueil.fr} | ${C.nom.fr}`, desc: C.description, chemin: "", racine: "", jsonld: ld }) + `
<section class="hero hero-accueil">${P ? `<img class="hero-fond" src="${esc(P.fichier)}" alt="" width="${P.largeur}" height="${P.hauteur}">` : ""}<div class="wrap">
  <div class="hero-texte">
  <h1>${biO(C.titre_accueil)}</h1>
  <p class="intro">${biO(C.intro)}</p>
  <p class="chiffre">${bi(`${FICHES.length} ${esc(metierPl.fr_pl.toLowerCase())} dans ${Object.values(compteG).filter(Boolean).length} gouvernorats`, `${ISO(FICHES.length)} ${esc(metierPl.ar_pl)} في ${ISO(Object.values(compteG).filter(Boolean).length)} ولاية`)}</p>
  <p class="appel-pro"><a class="btn btn-pro" href="inscription/#offres">${bi("Professionnel ? Inscription Pro : 1er mois gratuit", "مهني؟ تسجيل Pro: الشهر الأول مجاني")}</a></p>
  </div>
  <figure class="hero-carte">${carteTunisie("", compteG)}<figcaption>${bi("Touchez un gouvernorat", "اضغط على ولاية")}</figcaption></figure>
</div>${P ? `<div class="wrap">${creditPhoto()}</div>` : ""}</section>
<main class="wrap">
  ${C.metiers.length > 1 ? `<div class="metiers">${C.metiers.filter(m => FICHES.some(f => f.metier === m.id)).map(m => `<a class="metier${m.photo ? " avec-photo" : ""}" href="#liste" data-m="${m.id}">${m.photo ? `<img class="photo-metier" src="${esc(m.photo.fichier)}" alt="${esc((m.photo.alt || {}).fr || m.fr_pl)}" width="300" height="225" loading="lazy">` : ""}${imgMetier(m, "", 44)}<span>${biO({ fr: m.fr_pl, ar: m.ar_pl })}</span><span class="n">${FICHES.filter(f => f.metier === m.id).length}</span></a>`).join("")}</div>` : ""}
  ${filtres("", false)}
  ${notePro(FICHES)}
  <div class="liste protege" id="liste">${FICHES.map(f => carte(f, "")).join("\n")}</div>
  <p class="vide" id="aucun" hidden>${bi("Aucun résultat. Essayez un autre mot ou un autre gouvernorat.", "لا توجد نتيجة. جرّب كلمة أو ولاية أخرى.")}</p>
  <h2 class="titre-section">${bi("Par gouvernorat", "حسب الولاية")}</h2>
  <section class="carte">
    <div class="gouvernorats">${GOUVERNORATS.map(g => `<a href="gouvernorat/${g[0]}/">${bi(esc(g[1]), esc(g[2]))}<span class="n">${compteG[g[0]]}</span></a>`).join("")}</div>
  </section>
  ${blocPro("")}
  ${liensAmis()}
  ${AVIS}
</main>
` + pied;
}

// une page par gouvernorat
for (const [slug, fr, ar] of GOUVERNORATS) {
  const liste = FICHES.filter(f => f.gouvernorat === slug);
  const titre = `${metierPl.fr_pl} à ${fr} (${liste.length}) — adresse et téléphone, gratuit | ${C.nom.fr}`;
  pages[`gouvernorat/${slug}/`] = tete({ titre, desc: `${metierPl.fr_pl} dans le gouvernorat de ${fr} : adresse, téléphone, WhatsApp et itinéraire. Annuaire gratuit en français et en arabe. ${metierPl.ar_pl} في ولاية ${ar}.`, chemin: `gouvernorat/${slug}/`, racine: "../../" }) + `
<section class="hero hero-accueil">${fondPhoto(P, "../../")}<div class="wrap">
  <div class="hero-texte">
  ${fil("../../", bi(esc(fr), esc(ar)))}
  <h1>${bi(`${esc(metierPl.fr_pl)} à ${esc(fr)}`, `${esc(metierPl.ar_pl)} في ولاية ${esc(ar)}`)}</h1>
  <p class="intro">${bi(`${liste.length} fiche(s), triées par nom. Annuaire gratuit.`, `${ISO(liste.length)} بطاقة، مرتبة حسب الاسم. دليل مجاني.`)}</p>
  </div>
  <figure class="hero-carte petite">${carteTunisie("../../", compteG, slug)}<figcaption>${bi("Autres gouvernorats : touchez la carte", "ولايات أخرى: اضغط على الخريطة")}</figcaption></figure>
</div></section>
<main class="wrap">
  ${liste.length ? filtres("../../", true, liste) + notePro(liste) + `<div class="liste protege" id="liste">${liste.map(f => carte(f, "../../")).join("\n")}</div><p class="vide" id="aucun" hidden>${bi("Aucun résultat.", "لا توجد نتيجة.")}</p>`
    : `<section class="carte appel-vide"><h2>${bi(`Soyez parmi les premiers à ${esc(fr)}`, `كن من الأوائل في ${esc(ar)}`)}</h2><p>${bi(`Aucune fiche pour l'instant dans le gouvernorat de ${esc(fr)}. Vous êtes un professionnel ici, ou vous en connaissez un ? L'ajout est gratuit.`, `لا توجد بطاقة حاليًا في ولاية ${esc(ar)}. هل أنت مهني هنا أو تعرف مهنيًا؟ الإضافة مجانية.`)}</p><a class="btn" href="../../inscription/">${bi("Ajouter une fiche gratuitement", "أضف بطاقة مجانًا")}</a></section>`}
  <section class="carte">
    <h2>${bi("Autres gouvernorats", "ولايات أخرى")}</h2>
    <div class="gouvernorats">${GOUVERNORATS.filter(g => g[0] !== slug).map(g => `<a href="../../gouvernorat/${g[0]}/">${bi(esc(g[1]), esc(g[2]))}<span class="n">${compteG[g[0]]}</span></a>`).join("")}</div>
  </section>
  ${blocPro("../../")}
  ${liensAmis()}
</main>
` + pied;
}

// une page par fiche
for (const f of FICHES) {
  const g = G[f.gouvernorat], m = M[f.metier];
  const ld = { "@context": "https://schema.org", "@type": C.schema || "LocalBusiness", name: f.nom, url: `${URL_SITE}fiche/${f.id}/`,
    address: { "@type": "PostalAddress", addressLocality: f.ville || g[1], addressRegion: g[1], addressCountry: "TN", ...(f.adresse ? { streetAddress: f.adresse } : {}) },
    ...(f.tel ? { telephone: "+216" + f.tel } : {}), ...(f.lat ? { geo: { "@type": "GeoCoordinates", latitude: f.lat, longitude: f.lon } } : {}) };
  const itin = f.lat ? `https://www.openstreetmap.org/directions?to=${f.lat}%2C${f.lon}#map=17/${f.lat}/${f.lon}` : null;
  const titre = `${f.nom} — ${m.fr} à ${f.ville || g[1]} : téléphone, adresse | ${C.nom.fr}`;
  pages[`fiche/${f.id}/`] = tete({ titre, desc: `${f.nom}, ${m.fr.toLowerCase()} à ${f.ville || g[1]} (gouvernorat de ${g[1]}) : ${f.tel ? "téléphone, " : ""}adresse et itinéraire. Annuaire gratuit.`, chemin: `fiche/${f.id}/`, racine: "../../", jsonld: [ld] }) + `
<section class="hero hero-photo">${fondPhoto(photoDe(m), "../../")}<div class="wrap">
  ${fil("../../", `<a href="../../gouvernorat/${g[0]}/">${bi(esc(g[1]), esc(g[2]))}</a>`)}
  <h1 class="titre-fiche">${imgMetier(m, "../../", 48)}<span>${esc(f.nom)}</span></h1>
  ${f.nom_ar ? `<p class="nom-ar" lang="ar" dir="rtl">${esc(f.nom_ar)}</p>` : ""}
  <p class="intro">${biO({ fr: m.fr, ar: m.ar })} · ${f.ville ? esc(f.ville) + " · " : ""}${bi(esc(g[1]), esc(g[2]))}</p>
  ${badges(f)}
</div></section>
<main class="wrap">
  <section class="carte fiche" data-fiche="${f.id}">
    ${f.pro && f.description ? `<p class="description">${biO({ fr: f.description.fr || f.description.ar || "", ar: f.description.ar || f.description.fr || "" })}</p>` : ""}
    ${f.pro && f.specialites && f.specialites.length ? `<ul class="specialites">${f.specialites.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
    <div class="actions">
      ${f.tel ? `<a class="btn" href="tel:+216${f.tel}" data-clic="tel">${svg("tel")}${bi("Appeler", "اتصال")} <bdi dir="ltr">${telLisible(f.tel)}</bdi></a>` : ""}
      ${mobile(f.whatsapp || f.tel) ? `<a class="btn vert" href="https://wa.me/216${f.whatsapp || f.tel}" rel="noopener" data-clic="whatsapp">${svg("wa")}WhatsApp</a>` : ""}
      ${itin ? `<a class="btn clair" href="${itin}" rel="noopener" data-clic="itineraire">${svg("carte")}${bi("Itinéraire", "الطريق")}</a>` : ""}
    </div>
    <dl class="infos">
      ${f.adresse ? `<dt>${bi("Adresse", "العنوان")}</dt><dd>${esc(f.adresse)}${f.ville ? ", " + esc(f.ville) : ""}</dd>` : ""}
      <dt>${bi("Gouvernorat", "الولاية")}</dt><dd>${bi(esc(g[1]), esc(g[2]))}</dd>
      ${f.horaires ? `<dt>${bi("Horaires", "التوقيت")}</dt><dd><bdi dir="ltr">${esc(f.horaires)}</bdi></dd>` : ""}
      ${f.site ? `<dt>${bi("Site", "الموقع")}</dt><dd><a href="${esc(f.site)}" rel="noopener nofollow">${esc(f.site.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a></dd>` : ""}
      ${!f.tel ? `<dt>${bi("Téléphone", "الهاتف")}</dt><dd>${bi("non renseigné", "غير متوفر")}</dd>` : ""}
    </dl>
    ${f.verifiee ? `<p class="source">${svg("ok")} ${bi(`Fiche vérifiée par l'établissement${typeof f.verifiee === "string" ? " le " + esc(f.verifiee) : ""}.`, `بطاقة وثّقتها المؤسسة${typeof f.verifiee === "string" ? " بتاريخ " + esc(f.verifiee) : ""}.`)}</p>` : ""}
    <p class="source">${f.source === "officiel" ? bi(`Informations issues de <a href="${esc(f.source_url)}" rel="noopener nofollow">la liste officielle publiée par ${esc((f.source_nom || {}).fr || "l'administration")}</a> (relevées le ${esc(f.releve || "")}), non vérifiées par l'établissement : appelez avant de vous déplacer.`, `معلومات مأخوذة من <a href="${esc(f.source_url)}" rel="noopener nofollow">القائمة الرسمية التي نشرتها ${esc((f.source_nom || {}).ar || "الإدارة")}</a> (بتاريخ ${esc(f.releve || "")})، لم تتحقق منها المؤسسة: اتصل قبل التنقل.`) : f.source === "web" ? bi(`Informations publiées par l'établissement lui-même sur <a href="${esc(f.source_url)}" rel="noopener nofollow">sa page publique</a> (relevées le ${esc(f.releve || "")}), non vérifiées par nous.`, `معلومات نشرتها المؤسسة بنفسها على <a href="${esc(f.source_url)}" rel="noopener nofollow">صفحتها العامة</a> (بتاريخ ${esc(f.releve || "")})، لم نتحقق منها.`) : f.source === "osm" ? bi(`Informations publiques issues d'<a href="${f.osm}" rel="noopener">OpenStreetMap</a> (© les contributeurs d'OpenStreetMap, licence ODbL), non vérifiées par l'établissement.`, `معلومات عامة مأخوذة من <a href="${f.osm}" rel="noopener">OpenStreetMap</a> (© المساهمون في OpenStreetMap، رخصة ODbL)، لم تتحقق منها المؤسسة.`) : bi("Fiche remplie par l'établissement et vérifiée.", "بطاقة عمّرتها المؤسسة وتم التثبت منها.")}</p>
    <div class="actions petites">
      ${OUVERT && !f.pro ? `<a href="../../inscription/?fiche=${f.id}&amp;nom=${encodeURIComponent(f.nom)}#pro" data-clic="reclamer">${svg("ok")}${bi("C'est votre établissement ? Vérifiez votre fiche gratuitement", "هذه مؤسستك؟ وثّق بطاقتك مجانًا")}</a>` : ""}
      <a href="../../inscription/?fiche=${f.id}&amp;action=corriger">${svg("crayon")}${bi("C'est votre établissement ? Compléter ou corriger", "هذه مؤسستك؟ أكمل البطاقة أو صحّحها")}</a>
      <a href="../../inscription/?fiche=${f.id}&amp;action=retirer">${svg("retirer")}${bi("Retirer cette fiche", "حذف هذه البطاقة")}</a>
    </div>
  </section>
  ${liensAmis()}
</main>
` + pied;
}

// inscription / correction / retrait
const VIR = PRO.virement || {};
const metierChoix = C.metiers.length > 1 ? `<label for="p-metier">${bi("Métier", "المهنة")}</label>
      <select id="p-metier" name="metier">${C.metiers.map(m => `<option value="${esc(m.fr)}" data-ar="${esc(m.ar)}">${esc(m.fr)}</option>`).join("")}</select>` : `<input type="hidden" name="metier" value="${esc(C.metiers[0].fr)}">`;
// modes de paiement (règle d'Ahmed du 06/10/2026 : visibles d'un clic sur « Paiement », avant l'inscription)
// preuve de paiement envoyée par WhatsApp (config.pro.whatsapp_preuve), sans attendre un e-mail
const WAP = PRO.whatsapp_preuve ? String(PRO.whatsapp_preuve).replace(/\D/g, "") : "";
const lienPreuve = () => WAP ? `<a class="btn vert" href="https://wa.me/216${WAP}?text=${encodeURIComponent("Bonjour, voici la preuve de paiement de la formule Pro pour : ")}" rel="noopener">${svg("wa")}${bi("Envoyer la preuve de paiement par WhatsApp", "أرسل إثبات الدفع عبر واتساب")}</a>` : "";
const listePaiements = () => `<dl class="infos rib">
        ${VIR.rib ? `<dt>${bi("Virement bancaire", "تحويل بنكي")}</dt><dd>${esc(VIR.titulaire || "")}${VIR.banque ? " — " + esc(VIR.banque) : ""}<br>RIB <bdi dir="ltr">${esc(VIR.rib)}</bdi></dd>` : ""}
        ${(PRO.autres_paiements || []).map(p => `<dt>${esc(p.nom)}</dt><dd><bdi dir="ltr">${esc(p.detail)}</bdi></dd>`).join("\n        ")}
        <dt>${bi("Montant", "المبلغ")}</dt><dd>${prixTexte()}</dd>
        <dt>${bi("Motif", "سبب الدفع")}</dt><dd>${bi("le nom de votre établissement", "اسم مؤسستك")}</dd>
      </dl>`;
const offres = `<section class="offres" id="offres">
    <div class="offre">
      <h2>${bi("Fiche gratuite", "بطاقة مجانية")}</h2>
      <p class="prix">0 ${PRO.devise} <small>${bi("pour toujours", "دائمًا")}</small></p>
      <ul class="avantages">
        <li>${bi("Nom, adresse, téléphone, itinéraire", "الاسم، العنوان، الهاتف، الطريق")}</li>
        <li>${bi("En français et en arabe, sur votre gouvernorat", "بالعربية والفرنسية، في ولايتك")}</li>
        <li>${bi("Badge « Vérifiée » quand vous confirmez votre fiche", "شارة « موثّقة » عند تأكيد بطاقتك")}</li>
        <li>${bi("Correction ou retrait à tout moment", "تصحيح أو حذف في أي وقت")}</li>
      </ul>
    </div>
    <div class="offre pro">
      <p class="ruban">${bi(`${PRO.mois_gratuits} mois offert`, `${ISO(PRO.mois_gratuits)} شهر مجاني`)}</p>
      <h2>${bi("Formule Pro", "صيغة Pro")}</h2>
      <p class="prix">${prixTexte()}</p>
      <ul class="avantages">
        <li>${bi("En tête de votre gouvernorat, avec la mention « Pro »", "في أعلى قائمة ولايتك، مع إشارة « Pro »")}</li>
        <li>${bi("Description en français et en arabe, spécialités, horaires", "تقديم بالعربية والفرنسية، الاختصاصات، التوقيت")}</li>
        <li>${bi("Bouton WhatsApp direct", "زر واتساب مباشر")}</li>
        <li>${bi("Le nombre de clients qui vous ont appelé ou écrit depuis le site", "عدد الحرفاء الذين اتصلوا بك أو راسلوك عبر الموقع")}</li>
        <li><strong>${bi("Sans engagement au-delà d'un an", "دون التزام بعد السنة")}</strong></li>
      </ul>
      <p class="petit">${bi(`Le 1er mois est gratuit. Ensuite, paiement par l'un des moyens indiqués (bouton « Paiement »). Pas de renouvellement automatique : sans paiement, votre fiche redevient gratuite, elle n'est jamais supprimée.`, `الشهر الأول مجاني. بعده، الدفع بإحدى الوسائل المذكورة (زر « الدفع »). لا تجديد آلي: دون دفع تعود بطاقتك مجانية ولا تُحذف أبدًا.`)}</p>
      <details class="paiement" id="paiement"><summary class="btn clair">${bi("Paiement : voir les modes de paiement", "الدفع: طرق الدفع")}</summary>
      ${listePaiements()}
      ${lienPreuve()}
      <p class="petit">${bi("Le paiement se fait seulement après le mois gratuit. Envoyez ensuite la preuve du paiement par WhatsApp ; une facture vous est adressée.", "يتم الدفع فقط بعد الشهر المجاني. أرسل بعد ذلك إثبات الدفع عبر واتساب؛ تُرسل إليك فاتورة.")}</p>
      </details>
      ${OUVERT ? `<a class="btn" href="#pro">${bi("Je m'inscris : 1er mois gratuit", "أسجّل: الشهر الأول مجاني")}</a>` : `<p class="petit"><strong>${bi("Inscriptions Pro : ouverture prochaine.", "تسجيل Pro: يُفتح قريبًا.")}</strong></p>`}
    </div>
  </section>`;
const formPro = `<section class="carte" id="pro">
    <h2>${bi("Inscrire ou vérifier votre établissement", "سجّل مؤسستك أو وثّقها")}</h2>
    <form class="formulaire" data-envoi="pro" action="${C.formspree}" method="POST">
      <fieldset class="choix-action">
        <legend>${bi("Formule choisie", "الصيغة المختارة")}</legend>
        <label><input type="radio" name="formule" value="gratuite" checked> ${bi("Fiche gratuite vérifiée", "بطاقة مجانية موثّقة")}</label>
        <label><input type="radio" name="formule" value="pro"> ${bi(`Formule Pro : 1er mois gratuit, puis `, `صيغة Pro: الشهر الأول مجاني، ثم `)}${prixTexte()}</label>
      </fieldset>
      <input type="hidden" name="fiche" id="p-fiche" value="">
      <label for="p-nom">${bi("Nom de l'établissement", "اسم المؤسسة")}</label>
      <input id="p-nom" name="etablissement" required maxlength="120">
      ${metierChoix}
      <label for="p-g">${bi("Gouvernorat", "الولاية")}</label>
      <select id="p-g" name="gouvernorat">${GOUVERNORATS.map(g => `<option value="${g[1]}" data-ar="${esc(g[2])}">${esc(g[1])}</option>`).join("")}</select>
      <label for="p-adresse">${bi("Adresse", "العنوان")}</label>
      <input id="p-adresse" name="adresse" required maxlength="200">
      <label for="p-tel">${bi("Téléphone (8 chiffres)", "الهاتف (8 أرقام)")}</label>
      <input id="p-tel" name="telephone" required inputmode="tel" pattern="[0-9 ]{8,11}" maxlength="11">
      <label for="p-wa">${bi("WhatsApp (facultatif)", "واتساب (اختياري)")}</label>
      <input id="p-wa" name="whatsapp" inputmode="tel" pattern="[0-9 ]{8,11}" maxlength="11">
      <label for="p-email">${bi("E-mail (pour vous envoyer la confirmation)", "البريد الإلكتروني (لإرسال التأكيد)")}</label>
      <input id="p-email" type="email" name="email" required maxlength="200" autocomplete="email">
      <label for="p-desc">${bi("Présentation et spécialités (facultatif, formule Pro)", "التقديم والاختصاصات (اختياري، صيغة Pro)")}</label>
      <textarea id="p-desc" name="presentation" maxlength="800" rows="4"></textarea>
      <label class="case"><input type="checkbox" name="autorise" value="oui" required> ${bi("Je suis le responsable de cet établissement, ou j'ai son autorisation.", "أنا المسؤول عن هذه المؤسسة أو لديّ ترخيص منه.")}</label>
      <label class="case"><input type="checkbox" name="conditions" value="oui" required> ${bi(`J'accepte les <a href="../conditions/">conditions</a>.`, `أوافق على <a href="../conditions/">الشروط</a>.`)}</label>
      <input type="hidden" name="site" value="${esc(C.nom.fr)}"><input type="hidden" name="_subject" value="Inscription professionnel — ${esc(C.nom.fr)}">
      <input type="text" name="_gotcha" class="piege" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button type="submit" class="btn">${bi("Envoyer mon inscription", "أرسل تسجيلي")}</button>
      <p class="statut" role="status" aria-live="polite"></p>
      <p class="mention">${bi(`Vos coordonnées servent seulement à vérifier et publier votre fiche professionnelle. Vous pouvez les faire corriger ou supprimer à tout moment.${PRO.inpdp ? ` Traitement déclaré à l'INPDP (${esc(PRO.inpdp)}).` : ""}`, `تُستعمل بياناتك فقط للتثبت من بطاقتك المهنية ونشرها. يمكنك طلب تصحيحها أو حذفها في أي وقت.${PRO.inpdp ? ` معالجة مصرّح بها لدى الهيئة الوطنية لحماية المعطيات الشخصية (${esc(PRO.inpdp)}).` : ""}`)}</p>
    </form>
    <div class="apres-pro" id="apres-pro" hidden>
      <h3>${bi("Merci, votre inscription est bien reçue", "شكرًا، وصلنا تسجيلك")}</h3>
      <p>${bi("Nous vérifions votre établissement puis publions votre fiche, en général sous 48 heures. Pour la formule Pro, votre mois gratuit commence à la mise en ligne.", "نتثبت من مؤسستك ثم ننشر بطاقتك، عادة في غضون 48 ساعة. بالنسبة لصيغة Pro، يبدأ شهرك المجاني عند النشر.")}</p>
      <p>${bi(`Pour continuer la formule Pro après le mois gratuit (`, `لمواصلة صيغة Pro بعد الشهر المجاني (`)}${prixTexte()}${bi(`), payez par le moyen de votre choix, avec pour motif le nom de votre établissement :`, `)، ادفع بالوسيلة التي تختارها، مع ذكر اسم مؤسستك كسبب للدفع:`)}</p>
      ${listePaiements()}
      ${lienPreuve()}
      <p>${bi("Après le mois gratuit, envoyez la preuve du paiement par WhatsApp. Une facture vous est adressée.", "بعد الشهر المجاني، أرسل إثبات الدفع عبر واتساب. تُرسل إليك فاتورة.")}</p>
    </div>
  </section>`;

pages["inscription/"] = tete({ titre: `Professionnels : fiche gratuite et formule Pro | ${C.nom.fr}`, desc: `Professionnel : soyez trouvé par les Tunisiens qui vous cherchent. Fiche gratuite sur ${C.nom.fr}, vérifiée par vous, en français et en arabe.`, chemin: "inscription/", racine: "../" }) + `
<section class="hero"><div class="wrap">
  ${fil("../", bi("Professionnels", "المهنيون"))}
  <h1>${bi("Gagnez en visibilité", "اكسب مزيدًا من الظهور")}</h1>
  <p class="intro accroche">${bi("Chaque jour, des Tunisiens recherchent un professionnel près de chez eux. Rendez votre profil accessible et référencé en ligne, en arabe et en français, dans votre gouvernorat, en quelques minutes.", "كل يوم، يبحث تونسيون عن مهني قريب منهم. اجعل ملفك متاحًا ومُدرجًا على الإنترنت، بالعربية والفرنسية، في ولايتك، في بضع دقائق.")}</p>
  <p class="intro">${bi(`Fiche gratuite, en français et en arabe. Déjà ${FICHES.length} établissements dans ${Object.values(compteG).filter(Boolean).length} gouvernorats.`, `بطاقة مجانية بالعربية والفرنسية. حاليًا ${ISO(FICHES.length)} مؤسسة في ${ISO(Object.values(compteG).filter(Boolean).length)} ولاية.`)}</p>
</div></section>
<main class="wrap">
  ${offres}
  ${OUVERT ? formPro : `<p class="note">${bi("La vérification des fiches et la formule Pro ouvriront bientôt. En attendant, vous pouvez déjà demander gratuitement l'ajout, la correction ou le retrait d'une fiche.", "توثيق البطاقات وصيغة Pro سيُفتحان قريبًا. في الأثناء يمكنك طلب إضافة بطاقة أو تصحيحها أو حذفها مجانًا.")}</p>`}
  <h2 class="titre-section">${bi("Ajouter, corriger ou retirer une fiche (gratuit)", "إضافة بطاقة أو تصحيحها أو حذفها (مجانًا)")}</h2>
  <section class="carte">
    <form class="formulaire" data-envoi="demande" action="${C.formspree}" method="POST">
      <fieldset class="choix-action">
        <legend>${bi("Votre demande", "طلبك")}</legend>
        <label><input type="radio" name="action" value="ajouter" checked> ${bi("Ajouter une fiche", "إضافة بطاقة")}</label>
        <label><input type="radio" name="action" value="corriger"> ${bi("Corriger une fiche", "تصحيح بطاقة")}</label>
        <label><input type="radio" name="action" value="retirer"> ${bi("Retirer une fiche", "حذف بطاقة")}</label>
      </fieldset>
      <input type="hidden" name="fiche" id="champ-fiche" value="">
      <p class="fiche-choisie" id="fiche-choisie" hidden></p>
      <label for="d-nom">${bi("Nom de l'établissement", "اسم المؤسسة")}</label>
      <input id="d-nom" name="etablissement" required maxlength="120">
      <label for="d-g">${bi("Gouvernorat", "الولاية")}</label>
      <select id="d-g" name="gouvernorat">${GOUVERNORATS.map(g => `<option value="${g[1]}" data-ar="${esc(g[2])}">${esc(g[1])}</option>`).join("")}</select>
      <fieldset class="champs-ajout" id="champs-ajout">
        <legend>${bi("Toutes les informations de la fiche (obligatoire pour un ajout : une fiche incomplète n'est pas publiée)", "كل معلومات البطاقة (إجبارية للإضافة: البطاقة الناقصة لا تُنشر)")}</legend>
        <label for="d-nom-ar">${bi("Nom en arabe (facultatif)", "الاسم بالعربية (اختياري)")}</label>
        <input id="d-nom-ar" name="nom_arabe" maxlength="120" lang="ar" dir="rtl">
        ${C.metiers.length > 1 ? `<label for="d-metier">${bi("Métier", "المهنة")}</label>
        <select id="d-metier" name="metier">${C.metiers.map(m => `<option value="${esc(m.fr)}" data-ar="${esc(m.ar)}">${esc(m.fr)}</option>`).join("")}</select>` : `<input type="hidden" name="metier" value="${esc(C.metiers[0].fr)}">`}
        <label for="d-ville">${bi("Ville / délégation", "المدينة / المعتمدية")}</label>
        <input id="d-ville" name="ville" required maxlength="80">
        <label for="d-adresse">${bi("Adresse complète", "العنوان الكامل")}</label>
        <input id="d-adresse" name="adresse" required maxlength="200">
        <label for="d-tel">${bi("Téléphone professionnel (8 chiffres)", "الهاتف المهني (8 أرقام)")}</label>
        <input id="d-tel" name="telephone" required inputmode="tel" pattern="[0-9 ]{8,11}" maxlength="11">
        <label for="d-wa">${bi("WhatsApp (facultatif)", "واتساب (اختياري)")}</label>
        <input id="d-wa" name="whatsapp" inputmode="tel" pattern="[0-9 ]{8,11}" maxlength="11">
        <label for="d-email">${bi("E-mail professionnel", "البريد الإلكتروني المهني")}</label>
        <input id="d-email" type="email" name="email" required maxlength="200" autocomplete="email">
        <label for="d-site">${bi("Site internet ou page Facebook (facultatif)", "موقع الواب أو صفحة فيسبوك (اختياري)")}</label>
        <input id="d-site" type="url" name="site_web" maxlength="200" placeholder="https://">
        <label for="d-horaires">${bi("Horaires (facultatif)", "التوقيت (اختياري)")}</label>
        <input id="d-horaires" name="horaires" maxlength="120">
        ${C.specialites && C.specialites.length ? `<fieldset class="specialites-choix"><legend>${bi("Spécialités (jusqu'à 5)", "الاختصاصات (حتى 5)")}</legend>
          ${C.specialites.map(s => `<label class="case"><input type="checkbox" name="specialites" value="${esc(s.fr)}"> ${biO(s)}</label>`).join("")}</fieldset>`
        : `<label for="d-spec">${bi("Spécialités (facultatif, jusqu'à 5)", "الاختصاصات (اختياري، حتى 5)")}</label><input id="d-spec" name="specialites" maxlength="200">`}
        <label class="case"><input type="checkbox" name="autorise" value="oui" required> ${bi("Je suis le responsable de cet établissement, ou j'ai son autorisation.", "أنا المسؤول عن هذه المؤسسة أو لديّ ترخيص منه.")}</label>
        <p class="petit">${bi(`Photo ou logo : envoyez-le par WhatsApp${WAP ? " au " + WAP.replace(/(\d{2})(\d{3})(\d{3})/, "$1 $2 $3") : ""}.`, `الصورة أو الشعار: أرسله عبر واتساب${WAP ? " على " + WAP : ""}.`)}</p>
      </fieldset>
      <fieldset class="champs-autre" id="champs-autre" disabled hidden>
        <label for="d-message">${bi("Votre demande en quelques mots (ce qu'il faut corriger, ou la raison du retrait)", "طلبك في بضع كلمات (ما يجب تصحيحه أو سبب الحذف)")}</label>
        <textarea id="d-message" name="message" required maxlength="1000" rows="4"></textarea>
        <label for="d-contact">${bi("Votre téléphone ou e-mail, pour vérifier la demande", "هاتفك أو بريدك الإلكتروني للتثبت من الطلب")}</label>
        <input id="d-contact" name="contact" required maxlength="120">
      </fieldset>
      <input type="hidden" name="site" value="${esc(C.nom.fr)}"><input type="hidden" name="_subject" value="Demande de fiche — ${esc(C.nom.fr)}">
      <input type="text" name="_gotcha" class="piege" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button type="submit" class="btn">${bi("Envoyer la demande", "إرسال الطلب")}</button>
      <p class="statut" role="status" aria-live="polite"></p>
      <p class="mention">${bi("Vos coordonnées servent seulement à vérifier la demande ; elles ne sont pas publiées sans votre accord. Un retrait demandé est définitif.", "تُستعمل بياناتك للتثبت من الطلب فقط ولا تُنشر دون موافقتك. الحذف المطلوب نهائي.")}</p>
    </form>
    <div class="apres-pro" id="apres-ajout" hidden>
      <h3>${bi("Merci, votre fiche gratuite est bien demandée", "شكرًا، وصلنا طلب بطاقتك المجانية")}</h3>
      <p>${bi("Nous la vérifions puis la publions, en général sous 48 heures. Une confirmation vous est envoyée.", "نتثبت منها ثم ننشرها، عادة في غضون 48 ساعة. يُرسل إليك تأكيد.")}</p>
      <h3>${bi("Et pour être vu en premier ? La formule Pro", "ولتظهر أولًا؟ صيغة Pro")}</h3>
      <p class="prix">${prixTexte()} <small>${bi(`· ${PRO.mois_gratuits} mois offert · sans engagement au-delà d'un an`, `· ${ISO(PRO.mois_gratuits)} شهر مجاني · دون التزام بعد السنة`)}</small></p>
      <ul class="avantages">
        <li>${bi("En tête de votre gouvernorat, avec la mention « Pro »", "في أعلى قائمة ولايتك، مع إشارة « Pro »")}</li>
        <li>${bi("Description en français et en arabe, spécialités, horaires, bouton WhatsApp", "تقديم بالعربية والفرنسية، الاختصاصات، التوقيت، زر واتساب")}</li>
        <li>${bi("Le nombre de clients qui vous ont appelé ou écrit depuis le site", "عدد الحرفاء الذين اتصلوا بك أو راسلوك عبر الموقع")}</li>
      </ul>
      <p><strong>${bi("Modes de paiement (après le mois gratuit) :", "طرق الدفع (بعد الشهر المجاني):")}</strong></p>
      ${listePaiements()}
      ${lienPreuve()}
      ${OUVERT ? `<a class="btn btn-pro" href="#pro">${bi("Passer à la formule Pro : 1er mois gratuit", "المرور إلى صيغة Pro: الشهر الأول مجاني")}</a>` : `<p class="petit">${bi("Inscriptions Pro : ouverture prochaine, nous vous préviendrons.", "تسجيل Pro: يُفتح قريبًا وسنعلمك.")}</p>`}
    </div>
  </section>
</main>
` + pied;

// à propos
pages["a-propos/"] = tete({ titre: `À propos et sources | ${C.nom.fr}`, desc: `D'où viennent les fiches de ${C.nom.fr} (OpenStreetMap, demandes des professionnels), données personnelles et retrait.`, chemin: "a-propos/", racine: "../" }) + `
<section class="hero"><div class="wrap">${fil("../", bi("À propos", "من نحن"))}<h1>${bi("À propos et sources", "من نحن والمصادر")}</h1></div></section>
<main class="wrap"><section class="carte texte">
  <h2>${bi("D'où viennent les fiches ?", "من أين تأتي البطاقات؟")}</h2>
  <p>${bi(`Les fiches viennent de la carte libre <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a> (© les contributeurs d'OpenStreetMap, licence ODbL), mise à jour chaque nuit, et des demandes des professionnels eux-mêmes. Les fiches OpenStreetMap ne sont pas vérifiées par les établissements : appelez avant de vous déplacer.`, `تأتي البطاقات من الخريطة الحرة <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a> (© المساهمون في OpenStreetMap، رخصة ODbL) التي تُحيَّن كل ليلة، ومن طلبات المهنيين أنفسهم. بطاقات OpenStreetMap لم تتحقق منها المؤسسات: اتصل قبل التنقل.`)}</p>
  <h2>${bi("Site gratuit et non officiel", "موقع مجاني وغير رسمي")}</h2>
  <p>${bi("Ce site n'est lié à aucune administration ni organisation professionnelle. La consultation est gratuite et sans inscription.", "هذا الموقع غير مرتبط بأي إدارة أو هيكل مهني. التصفح مجاني ودون تسجيل.")}</p>
  <h2>${bi("Crédits des photos", "حقوق الصور")}</h2>
  <ul class="credits">${[...(P && P.mosaique ? P.mosaique : [P]), ...C.metiers.map(m => m.photo)].filter(Boolean).filter((ph, i, t) => t.findIndex(x => x.source === ph.source) === i).map(ph => `<li><bdi>${esc(ph.auteur)}</bdi>, <a href="${esc(ph.licence_url)}" rel="noopener license">${esc(ph.licence)}</a>, <a href="${esc(ph.source)}" rel="noopener">Wikimedia Commons</a></li>`).join("")}</ul>
  <h2>${bi("Données personnelles et retrait", "المعطيات الشخصية والحذف")}</h2>
  <p>${bi(`Nous ne publions que des informations professionnelles déjà publiques ou données par l'établissement. Tout établissement peut demander la correction ou le retrait de sa fiche depuis la page <a href="../inscription/">Professionnels</a> ; un retrait est définitif. Statistiques de visite anonymes, sans cookies (GoatCounter).`, `لا ننشر إلا معلومات مهنية منشورة سابقًا أو قدّمتها المؤسسة. يمكن لكل مؤسسة طلب تصحيح بطاقتها أو حذفها من صفحة <a href="../inscription/">المهنيون</a>؛ والحذف نهائي. إحصائيات زيارة مجهولة دون ملفات تعريف الارتباط (GoatCounter).`)}</p>
</section></main>
` + pied;

// conditions de la formule Pro (publiées seulement quand les inscriptions sont ouvertes)
if (OUVERT) pages["conditions/"] = tete({ titre: `Conditions pour les professionnels | ${C.nom.fr}`, desc: `Conditions de la fiche gratuite et de la formule Pro de ${C.nom.fr} : prix, mois gratuit, paiement par virement, sans renouvellement automatique.`, chemin: "conditions/", racine: "../" }) + `
<section class="hero"><div class="wrap">${fil("../", `<a href="../inscription/">${bi("Professionnels", "المهنيون")}</a>`)}<h1>${bi("Conditions pour les professionnels", "شروط المهنيين")}</h1></div></section>
<main class="wrap"><section class="carte texte">
  <h2>${bi("1. Qui vend", "1. البائع")}</h2>
  <p>${bi(`${esc(PRO.vendeur || VIR.titulaire || "L'éditeur du site")}, éditeur de ${esc(C.nom.fr)}${WAP ? ` (WhatsApp <bdi dir="ltr">${WAP}</bdi>)` : ""}.`, `${esc(PRO.vendeur || VIR.titulaire || "ناشر الموقع")}، ناشر ${esc(C.nom.ar)}.`)}</p>
  <h2>${bi("2. Fiche gratuite", "2. البطاقة المجانية")}</h2>
  <p>${bi("La fiche de base (nom, adresse, téléphone, itinéraire) est gratuite, sans limite de durée. L'établissement peut la vérifier, la corriger ou la faire retirer à tout moment, gratuitement.", "البطاقة الأساسية (الاسم، العنوان، الهاتف، الطريق) مجانية دون حدّ زمني. يمكن للمؤسسة توثيقها أو تصحيحها أو طلب حذفها في أي وقت مجانًا.")}</p>
  <h2>${bi("3. Formule Pro", "3. صيغة Pro")}</h2>
  <p>${bi(`Prix : `, `السعر: `)}${prixTexte()}${bi(`, pour 12 mois. Le ${PRO.mois_gratuits === 1 ? "1er mois est gratuit" : PRO.mois_gratuits + " premiers mois sont gratuits"} et commence à la mise en ligne de la fiche Pro. La formule Pro affiche la fiche en tête de son gouvernorat avec la mention « Pro », une présentation, des spécialités, un bouton WhatsApp et le nombre de contacts reçus depuis le site.`, `، لمدة 12 شهرًا. ${PRO.mois_gratuits === 1 ? "الشهر الأول مجاني" : "الأشهر الأولى مجانية"} ويبدأ عند نشر بطاقة Pro. تُظهر صيغة Pro البطاقة في أعلى ولايتها مع إشارة « Pro »، وتقديمًا واختصاصات وزر واتساب وعدد الاتصالات الواردة عبر الموقع.`)}</p>
  <h2>${bi("4. Paiement et renouvellement", "4. الدفع والتجديد")}</h2>
  <p>${bi("Paiement par l'un des moyens indiqués sur la page Professionnels, après le mois gratuit. Une facture est envoyée. Sans engagement au-delà d'un an : il n'y a aucun renouvellement automatique, nous vous prévenons avant la fin ; sans nouveau paiement, la fiche redevient simplement gratuite, sans être supprimée.", "الدفع بإحدى الوسائل المذكورة في صفحة المهنيين بعد الشهر المجاني. تُرسل فاتورة. دون التزام بعد السنة: لا يوجد أي تجديد آلي، نعلمك قبل النهاية؛ ودون دفع جديد تعود البطاقة مجانية ببساطة دون حذف.")}</p>
  <h2>${bi("5. Ce que nous ne promettons pas", "5. ما لا نعد به")}</h2>
  <p>${bi("Nous ne garantissons pas un nombre de clients. Nous ne classons pas les professionnels et n'écrivons jamais qu'un établissement est « le meilleur ». Les professions réglementées restent responsables du respect des règles de leur ordre ; nous pouvons refuser ou modifier un texte qui ne les respecte pas.", "لا نضمن عددًا من الحرفاء. لا نرتّب المهنيين ولا نكتب أبدًا أن مؤسسة هي « الأفضل ». تبقى المهن المنظمة مسؤولة عن احترام قواعد هيئتها؛ ويمكننا رفض أو تعديل نص لا يحترمها.")}</p>
  <h2>${bi("6. Données personnelles", "6. المعطيات الشخصية")}</h2>
  <p>${bi(`Les coordonnées envoyées servent seulement à vérifier, publier et facturer la fiche. Accès, correction et suppression sur simple demande depuis la page <a href="../inscription/">Professionnels</a>.${PRO.inpdp ? ` Traitement déclaré à l'INPDP (${esc(PRO.inpdp)}).` : ""}`, `تُستعمل البيانات المرسلة فقط للتثبت من البطاقة ونشرها وفوترتها. النفاذ والتصحيح والحذف بمجرد طلب من صفحة <a href="../inscription/">المهنيون</a>.${PRO.inpdp ? ` معالجة مصرّح بها لدى الهيئة الوطنية لحماية المعطيات الشخصية (${esc(PRO.inpdp)}).` : ""}`)}</p>
</section></main>
` + pied;

/* ---------------- écriture ---------------- */
// on efface les anciennes pages de fiches (une fiche retirée ne doit plus exister)
for (const dossier of ["fiche", "gouvernorat", "conditions"]) if (existsSync(join(root, dossier))) rmSync(join(root, dossier), { recursive: true, force: true });
for (const [chemin, html] of Object.entries(pages)) {
  const d = join(root, chemin); mkdirSync(d, { recursive: true });
  writeFileSync(join(d, "index.html"), html, "utf8");
}
// conf.js (lu par page.js : pas de script dans les pages, la CSP l'interdit)
writeFileSync(join(root, "assets", "conf.js"), `/* FABRIQUÉ par tools/construire.mjs à partir de config.json — ne pas modifier */
window.CONF = ${JSON.stringify({ nom: C.nom, sous_titre: C.sous_titre, base: BASE, liens: C.liens || [], gouvernorats: GOUVERNORATS })};
`, "utf8");
writeFileSync(join(root, "assets", "couleurs.css"), `/* FABRIQUÉ par tools/construire.mjs à partir de config.json */
:root{--p:${C.couleur};--p-fonce:${C.couleur_fonce};--p-clair:${C.couleur_claire}}
`, "utf8");
writeFileSync(join(root, "manifest.webmanifest"), JSON.stringify({ id: BASE, name: C.nom.fr, short_name: C.court.fr, description: C.description,
  start_url: "./", scope: "./", display: "standalone", lang: "fr", dir: "auto", theme_color: C.couleur, background_color: "#F4F7FA",
  icons: [{ src: "assets/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "assets/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "assets/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] }, null, 2) + "\n", "utf8");
writeFileSync(join(root, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Object.keys(pages).map(p => `  <url><loc>${URL_SITE}${p}</loc></url>`).join("\n")}
</urlset>
`, "utf8");
writeFileSync(join(root, "robots.txt"), `User-agent: *
Allow: /
Sitemap: ${URL_SITE}sitemap.xml

# Robots d'intelligence artificielle et aspirateurs : non
${["GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-Web", "anthropic-ai", "CCBot", "Google-Extended", "Applebot-Extended", "PerplexityBot", "Bytespider", "Amazonbot", "Meta-ExternalAgent", "FacebookBot", "Diffbot", "Omgilibot", "cohere-ai", "ImagesiftBot", "HTTrack", "WebCopier", "WebZIP", "Offline Explorer", "wget", "SiteSnagger"].map(b => `User-agent: ${b}\nDisallow: /`).join("\n\n")}
`, "utf8");
console.log(`${Object.keys(pages).length} pages (${FICHES.length} fiches, ${retraits.size} retirée(s)), version ${V}`);
