/* Moteur d'annuaire — recherche et filtres, formulaires (envoi au clic), statistiques anonymes des clics.
   Statistiques : GoatCounter compte « clic-<type>/<fiche> » (appel, WhatsApp, itinéraire) : c'est ce qui permettra
   de montrer à un professionnel combien de clients l'ont contacté. Jamais de donnée personnelle. */
const sansAccent = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[إأآا]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
const compter = (path, title) => { try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path, title, event: true }); } catch (e) {} };

/* --- recherche et filtres --- */
document.addEventListener("DOMContentLoaded", () => {
  const liste = document.getElementById("liste");
  if (!liste) return;
  const cartes = [...liste.querySelectorAll(".fiche-carte")];
  const champ = document.getElementById("recherche"), choixG = document.getElementById("choix-g"), compte = document.getElementById("compte");
  let metier = "";
  const depart = new URLSearchParams(location.search);
  if (choixG && depart.get("g")) choixG.value = depart.get("g");
  function filtrer() {
    const mots = sansAccent(champ ? champ.value.trim() : "").split(/\s+/).filter(Boolean);
    const g = choixG ? choixG.value : "";
    let n = 0;
    for (const c of cartes) {
      const ok = (!g || c.dataset.g === g) && (!metier || c.dataset.m === metier) && mots.every(m => sansAccent(c.dataset.cherche).includes(m));
      c.hidden = !ok; if (ok) n++;
    }
    const vide = document.getElementById("aucun"); if (vide) vide.hidden = n > 0;
    if (compte) compte.textContent = T(`${n} résultat${n > 1 ? "s" : ""}`, `${n} نتيجة`);
  }
  if (champ) champ.addEventListener("input", filtrer);
  if (choixG) choixG.addEventListener("change", filtrer);
  const choisir = m => {
    metier = m;
    document.querySelectorAll(".puce").forEach(x => x.classList.toggle("on", x.dataset.m === metier));
    filtrer();
  };
  // petits boutons : un 2e clic retire le filtre ; grandes cartes de métier : filtrent puis descendent à la liste (#liste)
  // (correction du 06/10/2026, effacée par une synchronisation du moteur du PC le 07/10, remise le 07/10 : à reporter dans annuaires/moteur/)
  document.querySelectorAll(".puce").forEach(b => b.addEventListener("click", () => choisir(metier === b.dataset.m ? "" : b.dataset.m)));
  document.querySelectorAll("a.metier[data-m]").forEach(a => a.addEventListener("click", () => choisir(a.dataset.m)));
  const ph = () => { if (champ) champ.placeholder = T("Nom, ville, quartier…", "الاسم، المدينة، الحي…"); filtrer(); };
  document.addEventListener("langue", ph); ph();
});

/* --- statistiques des clics vers nos autres sites --- */
document.addEventListener("click", e => {
  const l = e.target.closest && e.target.closest("[data-lien]");
  if (l) compter(`lien-site/${l.dataset.lien}`, `Lien vers ${l.dataset.lien}`);
});
/* --- statistiques des clics sur une fiche --- */
document.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest("[data-clic]");
  if (!a) return;
  const fiche = a.closest("[data-fiche]");
  if (fiche) compter(`clic-${a.dataset.clic}/${fiche.dataset.fiche}`, `Clic ${a.dataset.clic} : ${document.title.split(" — ")[0]}`);
});

/* --- page Professionnels : fiche et action pré-remplies depuis le lien d'une fiche --- */
document.addEventListener("DOMContentLoaded", () => {
  const champ = document.getElementById("champ-fiche");
  if (!champ) return;
  const q = new URLSearchParams(location.search), id = (q.get("fiche") || "").replace(/[^a-z0-9-]/gi, "").slice(0, 40);
  const action = q.get("action"), nom = (q.get("nom") || "").slice(0, 120);
  if (id) { champ.value = id; const p = document.getElementById("fiche-choisie"); p.hidden = false; p.textContent = T("Fiche concernée : ", "البطاقة المعنية: ") + id; }
  // formulaire Pro (lien « Vérifiez votre fiche » d'une fiche) : même fiche, nom pré-rempli
  const pf = document.getElementById("p-fiche"), pn = document.getElementById("p-nom");
  if (pf && id) pf.value = id;
  if (pn && nom) pn.value = nom;
  const r = document.querySelector(`input[name="action"][value="${action === "retirer" ? "retirer" : action === "corriger" ? "corriger" : "ajouter"}"]`);
  if (r) r.checked = true;
  // ajout = formulaire complet ; correction / retrait = message court (un fieldset désactivé n'est ni vérifié ni envoyé)
  const ajout = document.getElementById("champs-ajout"), autre = document.getElementById("champs-autre");
  const basculer = () => {
    const a = (document.querySelector('input[name="action"]:checked') || {}).value === "ajouter";
    if (ajout) { ajout.disabled = !a; ajout.hidden = !a; }
    if (autre) { autre.disabled = a; autre.hidden = a; }
  };
  document.querySelectorAll('input[name="action"]').forEach(x => x.addEventListener("change", basculer));
  basculer();
  // spécialités : 5 au plus
  document.addEventListener("change", e => {
    if (!e.target.matches || !e.target.matches('input[name="specialites"][type="checkbox"]')) return;
    const cochees = document.querySelectorAll('input[name="specialites"][type="checkbox"]:checked');
    if (cochees.length > 5) e.target.checked = false;
  });
});

/* --- formulaires : envoi au clic seulement (Formspree), message clair --- */
document.addEventListener("submit", async e => {
  const f = e.target.closest && e.target.closest("form[data-envoi]");
  if (!f) return;
  e.preventDefault();
  const statut = f.querySelector(".statut"), bouton = f.querySelector("button[type=submit]");
  if (f._gotcha && f._gotcha.value) return;
  bouton.disabled = true; statut.textContent = T("Envoi…", "جارٍ الإرسال…");
  try {
    const rep = await fetch(f.action, { method: "POST", body: new FormData(f), headers: { Accept: "application/json" } });
    if (!rep.ok) throw new Error(rep.status);
    const formule = new FormData(f).get("formule") || "", action = new FormData(f).get("action") || "";
    f.reset(); statut.textContent = T("Merci, c'est envoyé. Nous lisons chaque message.", "شكرًا، تم الإرسال. نقرأ كل رسالة.");
    compter(`envoi-${f.dataset.envoi}${formule ? "-" + formule : ""}`, `Formulaire ${f.dataset.envoi} envoyé`);
    // inscription : confirmation et coordonnées du virement, montrées seulement après l'envoi
    // ajout gratuit : on montre aussitôt l'offre Pro et les modes de paiement (règle d'Ahmed du 06/10/2026)
    const apres = (f.dataset.envoi === "pro" && document.getElementById("apres-pro")) || (f.dataset.envoi === "demande" && action === "ajouter" && document.getElementById("apres-ajout"));
    if (apres) { f.hidden = true; apres.hidden = false; apres.scrollIntoView && apres.scrollIntoView({ block: "start" }); }
  } catch (err) {
    statut.textContent = T("Envoi impossible pour l'instant. Réessayez plus tard.", "تعذّر الإرسال حاليًا. أعد المحاولة لاحقًا.");
  } finally { bouton.disabled = false; }
});
