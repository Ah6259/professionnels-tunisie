// Tests du moteur d'annuaire (obligatoires avant toute publication) :  node tools/test_site.mjs
// Fichiers fabriqués, sécurité, liens, fiches retirées, crédit OpenStreetMap, comportement dans un faux navigateur (jsdom).
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createHash } from "crypto";
import { createRequire } from "module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lire = f => readFileSync(join(root, f), "utf8");
let ko = 0, ok = 0;
const check = (nom, cond) => { if (cond) { ok++; } else { ko++; console.log("ÉCHEC " + nom); } };
const C = JSON.parse(lire("config.json"));
const BASE = new URL(C.url).pathname;

// toutes les pages fabriquées
const pages = [];
(function parcourir(d) {
  for (const n of readdirSync(join(root, d))) {
    if (["node_modules", ".git", "tools", "donnees", "assets"].includes(n)) continue;
    const p = d ? d + "/" + n : n;
    if (statSync(join(root, p)).isDirectory()) parcourir(p); else if (n === "index.html") pages.push(p);
  }
})("");
const osm = JSON.parse(lire("donnees/osm.json")).fiches;
const retraits = existsSync(join(root, "donnees/retraits.json")) ? JSON.parse(lire("donnees/retraits.json")).ids : [];
const manuels = existsSync(join(root, "donnees/manuels.json")) ? JSON.parse(lire("donnees/manuels.json")).fiches : [];
const inscrits = existsSync(join(root, "donnees/inscrits.json")) ? JSON.parse(lire("donnees/inscrits.json")).fiches : [];
const prosIds = existsSync(join(root, "donnees/pros.json")) ? (JSON.parse(lire("donnees/pros.json")).pros || []).map(p => p.fiche) : [];
const contact = f => !!(f.tel || f.whatsapp || (f.adresse && String(f.adresse).trim().length > 5) || prosIds.includes(f.id));
const sansContact = [...osm, ...manuels, ...inscrits, ...(existsSync(join(root, "donnees/importes.json")) ? JSON.parse(lire("donnees/importes.json")).fiches : [])].filter(f => !retraits.includes(f.id) && !contact(f));
const importes = existsSync(join(root, "donnees/importes.json")) ? JSON.parse(lire("donnees/importes.json")).fiches : [];
const attendues = [...osm, ...manuels, ...inscrits, ...importes].filter(f => !retraits.includes(f.id) && contact(f));
const fichesPages = pages.filter(p => p.startsWith("fiche/"));

// -- structure
check("accueil, à propos, professionnels et 24 pages de gouvernorat", ["index.html", "a-propos/index.html", "inscription/index.html"].every(p => pages.includes(p)) && pages.filter(p => p.startsWith("gouvernorat/")).length === 24);
check(`une page par fiche (au plus ${attendues.length} : doublons fusionnés), aucune fiche retirée publiée`, fichesPages.length <= attendues.length && fichesPages.length >= attendues.length * 0.8 && retraits.every(id => !existsSync(join(root, "fiche", id))));
check("au moins une fiche (le relevé OpenStreetMap a fonctionné)", attendues.length > 0);
{
  const vides = fichesPages.filter(p => { const h = lire(p); return !/href="tel:\+216/.test(h) && !/wa\.me\/216/.test(h) && !/<dt><span data-l="fr">Adresse<\/span>/.test(h) && !/badge pro/.test(h); });
  check(`aucune fiche vide : chaque fiche publiée a un téléphone, un WhatsApp ou une adresse (règle d'Ahmed)${vides.length ? " — " + vides.slice(0, 3).join(", ") : ""}`, !vides.length);
}
check("fiches « web » (page publique de l'établissement) et « officiel » (liste d'une administration) : lien, date de relevé et bonne mention de la source sur la fiche",
  manuels.every(f => ["web", "officiel"].includes(f.source) && /^https?:\/\//.test(f.source_url || "") && f.releve && (!contact(f) || (existsSync(join(root, "fiche", f.id, "index.html")) &&
    lire(`fiche/${f.id}/index.html`).includes(f.source === "web" ? "sa page publique" : "la liste officielle publiée par")))));

// -- chaque page
const ldOk = s => [...s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].every(m => { try { JSON.parse(m[1]); return true; } catch { return false; } });
let pbSecu = [], pbSeo = [], pbLiens = [];
for (const p of pages) {
  const s = lire(p);
  const scripts = [...s.matchAll(/<script(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)];
  if (!s.includes('http-equiv="Content-Security-Policy"') || scripts.some(m => m[1].trim()) || /\son[a-z]+=/i.test(s.replace(/<script[\s\S]*?<\/script>/g, "")) || /style="/.test(s)) pbSecu.push(p);
  if (!/<title>[^<]{10,}<\/title>/.test(s) || !/name="description" content="[^"]{30,}"/.test(s) || !s.includes('rel="canonical"') || !ldOk(s)) pbSeo.push(p);
  const dossier = p.replace(/index\.html$/, "");
  for (const m of s.matchAll(/href="([^"#?:]+)(?:[?#][^"]*)?"/g)) {
    const h = m[1]; if (h.startsWith("//")) continue;
    const cible = join(root, dossier, h.split("&amp;")[0]);
    if (!existsSync(cible) && !existsSync(join(cible, "index.html"))) pbLiens.push(`${p} → ${h}`);
  }
}
check(`sécurité : CSP, aucun script en ligne, aucun on…= ni style="" (${pbSecu.slice(0, 3).join(", ")})`, !pbSecu.length);
check(`référencement : titre, description, canonique, JSON-LD valide (${pbSeo.slice(0, 3).join(", ")})`, !pbSeo.length);
check(`liens internes vers des fichiers existants (${pbLiens.slice(0, 3).join(" ; ")})`, !pbLiens.length);

// -- fiches
const f0 = attendues[0];
const s0 = lire(`fiche/${f0.id}/index.html`);
check("fiche : crédit OpenStreetMap (ODbL) et liens corriger / retirer", /OpenStreetMap/.test(s0) && /ODbL/.test(s0) && s0.includes(`inscription/?fiche=${f0.id}&amp;action=retirer`) && s0.includes("action=corriger"));
check("fiche : téléphone en lien tel:+216 et WhatsApp seulement pour un portable", attendues.filter(f => f.tel).every(f => { const s = lire(`fiche/${f.id}/index.html`); return s.includes(`tel:+216${f.tel}`) && (s.includes(`wa.me/216${f.tel}`) === /^[2459]/.test(f.tel)); }));
check("fiche : JSON-LD du bon type (" + (C.schema || "LocalBusiness") + ")", s0.includes(`"@type":"${C.schema || "LocalBusiness"}"`));
check("« gratuit » dans le titre ou la description de l'accueil et des gouvernorats", [lire("index.html"), lire("gouvernorat/tunis/index.html")].every(s => /<title>[^<]*gratuit|name="description" content="[^"]*gratuit/i.test(s)));
check("à propos : sources OpenStreetMap / ODbL, retrait, statistiques sans cookies", /ODbL/.test(lire("a-propos/index.html")) && /retrait/i.test(lire("a-propos/index.html")) && /GoatCounter/.test(lire("a-propos/index.html")));
check("inscriptions : formulaire de demande (ajout / correction / retrait), envoi Formspree, mention des données", /value="retirer"/.test(lire("inscription/index.html")) && lire("inscription/index.html").includes(C.formspree) && /ne sont pas publiées/.test(lire("inscription/index.html")));

// -- checklist visuelle obligatoire (règle d'Ahmed du 05/10/2026 : aucun site « basique »)
const P = C.photo || {};
check("photo du bandeau : fichier présent (≤ 200 Ko), crédit complet (auteur, licence, lien Wikimedia) sur l'accueil",
  !!P.fichier && existsSync(join(root, P.fichier)) && statSync(join(root, P.fichier)).size <= 200 * 1024 && P.auteur && P.licence && P.licence_url && /commons\.wikimedia\.org/.test(P.source || "") &&
  lire("index.html").includes(P.fichier) && lire("index.html").includes(P.licence) && /Wikimedia Commons/.test(lire("index.html")));
check("image en couleur pour chaque métier (assets/metiers/<id>.svg), affichée sur les fiches",
  C.metiers.every(m => existsSync(join(root, "assets/metiers", m.id + ".svg")) && /<svg[\s\S]*viewBox/.test(lire("assets/metiers/" + m.id + ".svg"))) && s0.includes("assets/metiers/" + f0.metier + ".svg"));
const photosM = C.metiers.filter(m => m.photo);
check(`photos réelles par métier (${photosM.length}/${C.metiers.length}) : fichier ≤ 160 Ko, licence complète, crédit sur À propos, affichée sur la tuile du métier et les fiches`,
  photosM.every(m => existsSync(join(root, m.photo.fichier)) && statSync(join(root, m.photo.fichier)).size <= 160 * 1024 && m.photo.auteur && m.photo.licence && m.photo.licence_url && /commons\.wikimedia\.org/.test(m.photo.source || "") &&
    lire("a-propos/index.html").includes(m.photo.source.replace(/&/g, "&amp;")) && (C.metiers.length === 1 || lire("index.html").includes(`src="${m.photo.fichier}"`))) &&
  lire("a-propos/index.html").includes("Crédits des photos"));
check("image d'aperçu WhatsApp : fichier JPEG < 250 Ko déclaré dans les pages",
  !!C.og_image && existsSync(join(root, "assets", C.og_image)) && statSync(join(root, "assets", C.og_image)).size < 250 * 1024 && lire("index.html").includes("assets/" + C.og_image));

check("carte de la Tunisie EN HAUT (bandeau) : accueil (24 bulles cliquables) et page de gouvernorat (le sien en surbrillance)", /class="hero-carte"/.test(lire("index.html")) && /class="hero-carte petite"/.test(lire("gouvernorat/sfax/index.html")) &&
  (lire("index.html").match(/class="tn-b[^"]*" data-gouv=/g) || []).length === 24 && lire("index.html").includes('href="gouvernorat/tunis/" class="tn-b') &&
  /class="tn-b[^"]*actif[^"]*" data-gouv="sfax"/.test(lire("gouvernorat/sfax/index.html")));

// -- consigne sécurité commune
const rob = lire("robots.txt");
check("robots.txt : tous les robots d'IA et aspirateurs de la consigne refusés, moteurs de recherche autorisés",
  ["GPTBot", "OAI-SearchBot", "ClaudeBot", "Claude-Web", "anthropic-ai", "CCBot", "Google-Extended", "Applebot-Extended", "PerplexityBot", "Bytespider", "Amazonbot", "Meta-ExternalAgent", "FacebookBot", "Diffbot", "Omgilibot", "cohere-ai", "ImagesiftBot", "HTTrack", "WebCopier", "WebZIP", "Offline Explorer", "wget", "SiteSnagger"].every(b => rob.includes("User-agent: " + b + "\nDisallow: /")) && !rob.includes("User-agent: Googlebot\nDisallow"));
check("anti-copie : meta noai sur chaque page, script de protection (copie, clic droit), listes protégées", pages.every(p => lire(p).includes('content="noai, noimageai"')) && /addEventListener\("copy"/.test(lire("assets/page.js")) && /contextmenu/.test(lire("assets/page.js")) && lire("index.html").includes('class="liste protege"'));
const SECRETS = /(AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[0-9A-Za-z]{20,}|sk-[0-9A-Za-z]{20,}|[0-9a-z._%+-]+@(yahoo|gmail|hotmail|outlook)\.[a-z]+)/i;
check("aucun secret ni adresse e-mail privée dans le site", ![...pages, "config.json", "assets/page.js", "assets/annuaire.js", "assets/conf.js"].some(f => SECRETS.test(lire(f))));

check("arabe : le champ anti-robot des formulaires garde 1 px de large (sinon la page arabe est décalée à droite)", /\.formulaire input\.piege[^}]*width:1px/.test(lire("assets/style.css")));
check("un élément caché (attribut hidden) reste toujours caché, même avec un style d'affichage", /\[hidden\]\{display:none!important\}/.test(lire("assets/style.css")));
check("filtres : chaque bouton de métier d'une page de gouvernorat a au moins une fiche (jamais de bouton à 0 résultat)", pages.filter(p => p.startsWith("gouvernorat/")).every(p => { const h = lire(p); return [...h.matchAll(/class="puce" data-m="([^"]+)"/g)].every(m => h.includes(`data-m="${m[1]}">`) && new RegExp(`class="fiche-carte[^"]*"[^>]*data-m="${m[1]}"`).test(h)); }));
check("lien vedette vers notre site partenaire EN HAUT (bandeau de l'accueil et des gouvernorats), avec son logo", (C.liens || []).filter(l => l.vedette).every(l => { const a = lire("index.html"), g = lire("gouvernorat/tunis/index.html"); return a.indexOf('class="lien-vedette"') > 0 && a.indexOf('class="lien-vedette"') < a.indexOf("</section>") && g.includes('class="lien-vedette"') && (!l.logo || (existsSync(join(root, l.logo)) && a.includes(l.logo))); }));
check("liens vers nos autres sites : encadré « Gratuit aussi sur nos sites » sur l'accueil, clic compté", !C.liens || !C.liens.length || (/Gratuit aussi sur nos sites/.test(lire("index.html")) && C.liens.every(l => lire("index.html").includes(`href="${l.url}" data-lien=`))));
check("arabe : aucun élément placé loin hors de l'écran (sinon la page arabe s'affiche blanche sur téléphone)", !/(left|right)\s*:\s*-\d{3,}px/.test(lire("assets/style.css")));
check("doublons : pas deux fiches au même nom à moins de 300 m", (() => {
  const L = fichesPages.map(p => { const m = lire(p).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/); try { return JSON.parse(m[1]); } catch { return null; } }).filter(x => x && x.geo);
  for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) {
    const A = L[a], B = L[b];
    if (A.name.toLowerCase().trim() !== B.name.toLowerCase().trim()) continue;
    const d = Math.hypot((A.geo.latitude - B.geo.latitude) * 111000, (A.geo.longitude - B.geo.longitude) * 111000 * Math.cos(A.geo.latitude * Math.PI / 180));
    if (d < 300) return false;
  }
  return true; })());

// -- fichiers du site
const man = JSON.parse(lire("manifest.webmanifest"));
check("manifeste : id unique du site, icônes présentes", man.id === BASE && man.icons.every(i => existsSync(join(root, i.src))) && existsSync(join(root, "assets/icons/apple-touch-icon.png")) && existsSync(join(root, "assets/logo.svg")));
const sm = lire("sitemap.xml");
check("plan du site : toutes les pages", pages.every(p => sm.includes(C.url + p.replace(/index\.html$/, ""))));
check("robots.txt : moteurs autorisés, robots d'IA refusés, plan du site", /Allow: \//.test(lire("robots.txt")) && /GPTBot[\s\S]*Disallow: \//.test(lire("robots.txt")) && lire("robots.txt").includes("sitemap.xml"));
check("service worker : portée du site, caches propres au site", /PREFIXE/.test(lire("sw.js")) && /startsWith\(PREFIXE\)/.test(lire("sw.js")));

// -- aucun concurrent cité (empreintes, pour ne pas écrire leurs noms dans un dépôt public)
const INTERDITS = new Set("307804f8a9e7bd48 8b30fe9b5db7797d 04dcb0d6d0e1cf09 41203aefbaa81d72 bcdb95fe1947c378 9637c0327a8cede8 bab1c2c81c93ac98 bcf950015754248a e4a62b35a8e5d6c2 261d1c911c05f428 a60b2df220c8f10e 7a7fa591155e1ddf 0d27b5e9a89a7130 91566e9abbb02832 05f0fa025a3b026b 87838d7d30f0653a 5415e774c52855a1 5835225ddbea8004 e2cbdee30c0107da e907a5ee176e59be".split(" "));
const INTERDITS_DOM = new Set("5d2ae528dda2bff3 e7d3434bfa09866c bac2e4bd95794e67 f8b6c6201a5d83e5 d0b96f4152cb3bef 89209bfe25390a67".split(" "));
const emp = m => createHash("sha256").update(m).digest("hex").slice(0, 16);
const publics = [...pages, "config.json", "README.md", "CLAUDE.md", "assets/page.js", "assets/annuaire.js"].filter(f => existsSync(join(root, f)));
const cites = publics.filter(f => { const s = lire(f).toLowerCase(); return (s.match(/[a-z0-9-]+/g) || []).some(m => INTERDITS.has(emp(m))) || (s.match(/[a-z0-9-]+\.[a-z]{2,4}/g) || []).some(m => INTERDITS_DOM.has(emp(m))); });
check(`aucun nom de concurrent sur le site ni dans le dépôt${cites.length ? " — " + cites.join(", ") : ""}`, !cites.length);

// -- dans un faux navigateur
let JSDOM;
try { ({ JSDOM } = createRequire(import.meta.url)("jsdom")); } catch { try { ({ JSDOM } = await import("jsdom")); } catch { JSDOM = null; } }
if (!JSDOM) { console.log("(jsdom absent : npm install --no-save --no-package-lock jsdom) — tests navigateur sautés"); }
else {
  const ouvrir = async (p, query = "") => {
    const html = lire(p).replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, "");
    const dom = new JSDOM(html, { runScripts: "outside-only", url: C.url + p.replace(/index\.html$/, "") + query });
    const w = dom.window, envois = [];
    w.goatcounter = { count: o => envois.push(o.path) };
    for (const js of ["assets/conf.js", "assets/page.js", "assets/annuaire.js"]) w.eval(lire(js));
    await new Promise(r => setTimeout(r, 50));
    return { w, d: w.document, envois };
  };
  let { w, d } = await ouvrir("index.html");
  check("accueil : en-tête et pied fabriqués (nom du site, crédit OpenStreetMap)", d.getElementById("entete").textContent.includes(C.nom.fr) && /OpenStreetMap/.test(d.getElementById("pied").textContent));
  const visibles = () => [...d.querySelectorAll(".fiche-carte")].filter(c => !c.hidden).length;
  check("accueil : toutes les fiches visibles au départ", visibles() === fichesPages.length);
  const g = attendues[0].gouvernorat;
  d.getElementById("choix-g").value = g; d.getElementById("choix-g").dispatchEvent(new w.Event("change"));
  check("accueil : le filtre par gouvernorat ne garde que ce gouvernorat", visibles() > 0 && [...d.querySelectorAll(".fiche-carte")].filter(c => !c.hidden).every(c => c.dataset.g === g));
  const champ = d.getElementById("recherche"); champ.value = "zzzzqqq"; champ.dispatchEvent(new w.Event("input"));
  check("accueil : recherche sans résultat → message « Aucun résultat »", visibles() === 0 && !d.getElementById("aucun").hidden);
  d.querySelector(".langue").dispatchEvent(new w.Event("click"));
  check("accueil : bouton de langue → arabe, de droite à gauche", d.documentElement.lang === "ar" && d.documentElement.dir === "rtl");
  const fTel = attendues.find(f => f.tel) || attendues[0];
  ({ w, d } = await ouvrir(`fiche/${fTel.id}/index.html`));
  const r = await ouvrir(`fiche/${fTel.id}/index.html`);
  const bouton = r.d.querySelector("[data-clic]");
  if (bouton) { bouton.addEventListener("click", e => e.preventDefault()); bouton.dispatchEvent(new r.w.MouseEvent("click", { bubbles: true })); }
  check("fiche : un clic (appel / WhatsApp / itinéraire) est compté anonymement", !bouton || r.envois.some(e => e === `clic-${bouton.dataset.clic}/${fTel.id}`));
  const ins = await ouvrir("inscription/index.html", `?fiche=${f0.id}&action=retirer`);
  check("professionnels : fiche et action « retirer » pré-remplies depuis le lien d'une fiche", ins.d.getElementById("champ-fiche").value === f0.id && ins.d.querySelector('input[name="action"][value="retirer"]').checked);
  {
    const v = await ouvrir("inscription/index.html");
    v.w.fetch = async () => ({ ok: true });
    const fd = v.d.querySelector('form[data-envoi="demande"]');
    fd.dispatchEvent(new v.w.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 50));
    const ap = v.d.getElementById("apres-ajout");
    check("ajout gratuit envoyé : l'offre Pro (prix, avantages, sans engagement) et les modes de paiement s'affichent aussitôt", !!ap && !ap.hidden && /(Virement bancaire|D17|IZI|Wafacash)/.test(ap.textContent) && /sans engagement/.test(ap.textContent));
  }
  check("retrait : seul le message court est demandé (formulaire complet désactivé)", ins.d.getElementById("champs-ajout").disabled && !ins.d.getElementById("champs-autre").disabled);
  const aj = await ouvrir("inscription/index.html");
  const req = n => { const e = aj.d.querySelector(`#champs-ajout [name="${n}"]`); return !!e && e.required; };
  check("ajout d'une fiche : formulaire complet obligatoire (ville, adresse, téléphone, e-mail, autorisation), comme une inscription pro",
    !aj.d.getElementById("champs-ajout").disabled && aj.d.getElementById("champs-autre").disabled && ["ville", "adresse", "telephone", "email", "autorise"].every(req) && !!aj.d.querySelector('#champs-ajout [name="whatsapp"]') && !!aj.d.querySelector('#champs-ajout [name="horaires"]'));
}

// -- espace professionnels et formule Pro (règles d'Ahmed du 06/10/2026)
{
  const ins = lire("inscription/index.html");
  check("bouton « Inscription Pro » visible dans l'en-tête de chaque page, vers les prix et avantages", /class="entete-pro" href="\$\{racine\}inscription\/#offres"/.test(lire("assets/page.js")) && lire("index.html").includes('href="inscription/#offres"') && /class="appel-pro"><a class="btn btn-pro" href="inscription\/#offres"/.test(lire("index.html")));
  check("bouton « Paiement » : modes de paiement visibles d'un clic avant l'inscription (virement ou D17 / IZI / Wafacash + montant)", /<details class="paiement" id="paiement"><summary[^>]*>[\s\S]*Paiement[\s\S]*(Virement bancaire|D17|IZI|Wafacash)[\s\S]*Montant/.test(ins));
  check("page Inscription Pro : accroche « Gagnez en visibilité » + profil référencé en arabe et en français, dans le gouvernorat", /Gagnez en visibilité/.test(ins) && /Rendez votre profil accessible et référencé en ligne, en arabe et en français, dans votre gouvernorat/.test(ins));
  check("professionnels : offre gratuite + formule Pro avec 1er mois gratuit et prix affichés", /class="offre pro"/.test(ins) && /mois offert/.test(ins) && /pour toujours/.test(ins) && /jamais supprimée/.test(ins) && /Sans engagement au-delà d'un an/.test(ins));
  if (C.inscriptions_ouvertes !== true) check("inscriptions fermées (pas de déclaration INPDP) : ni formulaire Pro, ni coordonnées de paiement, ni page conditions",
    !/data-envoi="pro"/.test(ins) && !/id="apres-pro"/.test(ins) && !existsSync(join(root, "conditions", "index.html")));
  else check("inscriptions ouvertes : accord ou déclaration INPDP noté, au moins un moyen de paiement, WhatsApp pour la preuve", !!(C.pro && (C.pro.inpdp || C.pro.inpdp_accord) && ((C.pro.virement && C.pro.virement.rib) || (C.pro.autres_paiements || []).length) && C.pro.whatsapp_preuve));
  // simulation complète dans une copie temporaire : inscriptions ouvertes, un Pro en essai, un Pro expiré, une fiche vérifiée
  const { mkdtempSync, cpSync, writeFileSync, rmSync } = await import("fs");
  const { tmpdir } = await import("os");
  const { execFileSync } = await import("child_process");
  const tmp = mkdtempSync(join(tmpdir(), "annuaire-pro-"));
  try {
    cpSync(root, tmp, { recursive: true, filter: s => !/[\\/](node_modules|\.git)([\\/]|$)/.test(s.slice(root.length)) });
    const ids = attendues.filter(f => !retraits.includes(f.id)).slice(0, 3).map(f => f.id);
    const [idEssai, idFini, idVerif] = ids;
    const essaiNom = attendues.find(f => f.id === idEssai).nom;
    writeFileSync(join(tmp, "donnees/pros.json"), JSON.stringify({ pros: [
      { fiche: idEssai, formule: "pro", debut: "2026-10-01", description: { fr: "Présentation test", ar: "تقديم تجريبي" }, specialites: ["Spécialité test"], whatsapp: "98000000" },
      { fiche: idFini, formule: "pro", debut: "2026-06-01" },
      { fiche: idVerif, formule: "gratuite", verifiee: "2026-10-02" } ] }));
    const cfg = JSON.parse(readFileSync(join(tmp, "config.json"), "utf8"));
    cfg.pro = { ...(cfg.pro || {}), virement: { titulaire: "SUARL TEST", banque: "Banque test", rib: "00 000 0000000000000 00" }, autres_paiements: [{ nom: "D17", detail: "99 999 999" }] };
    writeFileSync(join(tmp, "config.json"), JSON.stringify(cfg));
    execFileSync(process.execPath, [join(tmp, "tools/construire.mjs")], { env: { ...process.env, PRO_OUVERT: "1", AUJOURDHUI: "2026-10-15" }, stdio: "pipe" });
    const L = f => readFileSync(join(tmp, f), "utf8");
    const accueil = L("index.html"), gEssai = attendues.find(f => f.id === idEssai).gouvernorat;
    const ordre = [...L(`gouvernorat/${gEssai}/index.html`).matchAll(/href="\.\.\/\.\.\/fiche\/([^/]+)\//g)].map(m => m[1]);
    check("Pro en mois gratuit : en tête de son gouvernorat, badge « Pro », note honnête sur l'ordre", ordre[0] === idEssai && /class="badge pro"/.test(accueil) && /note-pro/.test(L(`gouvernorat/${gEssai}/index.html`)));
    const fe = L(`fiche/${idEssai}/index.html`);
    check("fiche Pro : présentation, spécialités, WhatsApp de la formule", fe.includes("Présentation test") && fe.includes("Spécialité test") && fe.includes("wa.me/21698000000"));
    const ff = L(`fiche/${idFini}/index.html`);
    check("Pro non payé après le mois gratuit : redevient gratuite TOUTE SEULE, sans être supprimée", !/class="badge pro"/.test(ff) && accueil.includes(`class="fiche-carte" href="fiche/${idFini}/"`) && ff.includes(attendues.find(f => f.id === idFini).nom.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")));
    check("fiche vérifiée gratuite : badge « Vérifiée » et date", /badge verifiee/.test(L(`fiche/${idVerif}/index.html`)) && L(`fiche/${idVerif}/index.html`).includes("le 2026-10-02"));
    const io = L("inscription/index.html");
    check("inscriptions ouvertes : formulaire Pro (formule, cases d'autorisation et de conditions), page conditions sans renouvellement automatique",
      /data-envoi="pro"/.test(io) && /name="formule" value="pro"/.test(io) && /name="autorise"[^>]*required/.test(io) && /name="conditions"[^>]*required/.test(io) && /aucun renouvellement automatique/.test(L("conditions/index.html")));
    check("coordonnées de paiement (virement + D17) dans le bouton « Paiement » de l'offre Pro ET dans la confirmation après l'envoi", /<details class="paiement"[\s\S]*00 000 0000000000000 00[\s\S]*D17[\s\S]*99 999 999[\s\S]*<\/details>/.test(io) && /<div class="apres-pro" id="apres-pro" hidden>[\s\S]*00 000 0000000000000 00/.test(io) && /href="#pro"/.test(io));
    check("fiche non Pro : lien « Vérifiez votre fiche gratuitement » vers le formulaire Pro", L(`fiche/${idVerif}/index.html`).includes(`inscription/?fiche=${idVerif}&amp;nom=`));
    check("jamais « meilleur » dans l'espace professionnels", !/meilleur/i.test(io.replace(/n'écrivons jamais qu'un établissement est « le meilleur »/g, "")) && !/meilleur/i.test(L("conditions/index.html").replace(/« le meilleur »/g, "")));
    if (JSDOM) {
      const html = io.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, "");
      const dom = new JSDOM(html, { runScripts: "outside-only", url: C.url + `inscription/?fiche=${idEssai}&nom=${encodeURIComponent(essaiNom)}` });
      const w = dom.window, envois = [];
      w.goatcounter = { count: o => envois.push(o.path) };
      w.fetch = async () => ({ ok: true });
      for (const js of ["assets/conf.js", "assets/page.js", "assets/annuaire.js"]) w.eval(L(js));
      await new Promise(r => setTimeout(r, 50));
      const d = w.document, form = d.querySelector('form[data-envoi="pro"]');
      check("formulaire Pro : fiche et nom pré-remplis depuis le lien de la fiche", d.getElementById("p-fiche").value === idEssai && d.getElementById("p-nom").value === essaiNom);
      check("confirmation cachée avant l'envoi", d.getElementById("apres-pro").hidden);
      form.querySelector('input[value="pro"]').checked = true;
      form.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 50));
      check("après l'envoi : confirmation + coordonnées de paiement visibles, envoi compté (formule pro)", !d.getElementById("apres-pro").hidden && form.hidden && envois.includes("envoi-pro-pro"));
    }
  } catch (e) { check("simulation de la formule Pro : " + e.message, false); }
  finally { rmSync(tmp, { recursive: true, force: true }); }
}

console.log(ko ? `\n${ko} PROBLÈME(S) sur ${ok + ko} vérifications` : `\nTOUT PASSE (${ok} vérifications)`);
process.exit(ko ? 1 : 0);
