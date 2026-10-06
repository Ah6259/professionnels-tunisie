/* Moteur d'annuaire — langue (français / arabe), en-tête et pied communs, protection légère, installation.
   Les textes propres au site viennent de assets/conf.js (fabriqué par tools/construire.mjs). */
(function () {
  if (window.top === window.self) return;                       // anti-cadre : pas d'affichage dans un autre site
  let meme = false;
  try { meme = window.top.location.hostname === window.location.hostname; } catch (e) { meme = false; }
  if (!meme) { try { window.top.location.href = window.location.href; } catch (e) { document.documentElement.hidden = true; } }
})();

(function () {
  const html = document.documentElement, racine = html.dataset.racine || "", C = window.CONF;
  let langue = "fr";
  try { langue = localStorage.getItem("langue") || ((navigator.language || "").startsWith("ar") ? "ar" : "fr"); } catch (e) {}
  const demande = new URLSearchParams(location.search).get("lang");
  if (demande === "ar" || demande === "fr") langue = demande;
  window.T = (fr, ar) => html.lang === "ar" ? ar : fr;
  const t = o => T(o.fr, o.ar);

  function cadre() {
    const e = document.getElementById("entete");
    if (e) e.innerHTML = `<div class="wrap">
      <a class="logo" href="${racine || "./"}"><img src="${racine}assets/logo.svg" alt="" width="34" height="34">
        <span>${t(C.nom)}<small>${t(C.sous_titre)}</small></span></a>
      <div class="entete-boutons"><button class="partager" type="button" aria-label="${T("Partager cette page", "شارك هذه الصفحة")}" title="${T("Partager", "شارك")}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg></button><a class="entete-pro" href="${racine}inscription/#offres">${T("Inscription Pro", "تسجيل Pro")}</a>
      <button class="langue" type="button">${T("العربية", "Français")}</button></div></div>`;
    const p = document.getElementById("pied");
    if (p) p.innerHTML = `<div class="wrap">
      <nav><a href="${racine || "./"}">${T("Accueil", "الرئيسية")}</a><a href="${racine}inscription/">${T("Professionnels", "المهنيون")}</a>
        <a href="${racine}a-propos/">${T("À propos et sources", "من نحن والمصادر")}</a><a href="${racine || "./"}#avis">${T("Votre avis", "رأيك")}</a>
        ${C.liens.slice(0, 1).map(l => `<a href="${l.url}">${t(l)}</a>`).join("")}</nav>
      <p>${T("Fiches : © les contributeurs d'OpenStreetMap (licence ODbL) et demandes des professionnels. Site gratuit et non officiel : appelez avant de vous déplacer.",
             "البطاقات: © المساهمون في OpenStreetMap (رخصة ODbL) وطلبات المهنيين. موقع مجاني وغير رسمي: اتصل قبل التنقل.")}</p>
      <p>© 2026 ${t(C.nom)} — ${T("tous droits réservés.", "جميع الحقوق محفوظة.")}</p></div>`;
    document.querySelectorAll(".langue").forEach(b => b.addEventListener("click", () => appliquer(html.lang === "ar" ? "fr" : "ar")));
    // bouton Partager (demande d'Ahmed) : la VIDÉO de présentation + le lien quand le téléphone sait partager un fichier
    // (Instagram, Facebook, TikTok, WhatsApp…), sinon le lien seul (menu de partage du téléphone, sinon WhatsApp).
    // Espace professionnels (inscription/) : la vidéo « professionnel ».
    document.querySelectorAll(".partager").forEach(b => b.addEventListener("click", () => {
      const url = location.href.split("#")[0].replace(/[?&]lang=(fr|ar)/, ""), titre = document.title.split(" | ")[0];
      try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "partage" + location.pathname.replace(C.base, "/"), title: "Partage", event: true }); } catch (e) {}
      const pro = location.pathname.indexOf(C.base + "inscription/") === 0, nom = C.base.replace(/\//g, "") + (pro ? "-pro" : "");
      return window.partagerVideo(C.base + "assets/video/presentation" + (pro ? "-pro" : "") + ".mp4", nom + ".mp4", titre, url);
    }));
    document.querySelectorAll("option[data-ar]").forEach(o => { o.dataset.fr = o.dataset.fr || o.textContent; o.textContent = T(o.dataset.fr, o.dataset.ar); });
    const tous = document.querySelector('#choix-g option[value=""]');
    if (tous) tous.textContent = T("Tous les gouvernorats", "كل الولايات");
  }
  function appliquer(l) {
    html.lang = l; html.dir = l === "ar" ? "rtl" : "ltr";
    try { localStorage.setItem("langue", l); } catch (e) {}
    cadre();
    document.dispatchEvent(new Event("langue"));
  }
  document.addEventListener("DOMContentLoaded", () => appliquer(langue));

  // installation sur le téléphone (https seulement)
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => {
      try { navigator.serviceWorker.register(C.base + "sw.js", { scope: C.base }).catch(() => {}); } catch (e) {}
    });
  }
})();

/* Partage de la vidéo de présentation (fichier) + lien dans le texte ; retombe sur le lien seul si le partage de
   fichier est impossible ou échoue. « Préparation de la vidéo… » pendant le téléchargement. Si le téléphone refuse
   le partage après l'attente (geste trop ancien), la vidéo reste prête : un second toucher la partage tout de suite. */
window.partagerVideo = (function () {
  let pret = null;                                   // { cle, fichier } : vidéo déjà téléchargée
  function message(texte) {
    let m = document.getElementById("partage-msg");
    if (!texte) { if (m) m.hidden = true; return; }
    if (!m) { m = document.createElement("div"); m.id = "partage-msg"; m.className = "partage-msg"; m.setAttribute("role", "status"); document.body.appendChild(m); }
    m.textContent = texte; m.hidden = false;
  }
  const T2 = (fr, ar) => document.documentElement.lang === "ar" ? ar : fr;
  async function lienSeul(titre, url) {
    if (navigator.share) { try { await navigator.share({ title: titre, text: titre, url }); return "lien"; } catch (e) { if (e && e.name === "AbortError") return "annule"; } }
    window.open("https://wa.me/?text=" + encodeURIComponent(titre + " " + url), "_blank", "noopener");
    return "whatsapp";
  }
  return async function (video, nomFichier, titre, url) {
    let possible = false;
    try { possible = !!(navigator.share && navigator.canShare && window.File && window.fetch && navigator.canShare({ files: [new File([""], nomFichier, { type: "video/mp4" })] })); } catch (e) {}
    if (!possible) return lienSeul(titre, url);
    try {
      if (!pret || pret.cle !== video) {
        message(T2("Préparation de la vidéo…", "جارٍ تحضير الفيديو…"));
        const r = await fetch(video);
        if (!r.ok) throw new Error("vidéo absente");
        const f = new File([await r.blob()], nomFichier, { type: "video/mp4" });
        if (!navigator.canShare({ files: [f] })) throw new Error("fichier refusé");
        pret = { cle: video, fichier: f };
      }
      await navigator.share({ files: [pret.fichier], title: titre, text: titre + " " + url });
      message(""); return "video";
    } catch (e) {
      if (e && e.name === "AbortError") { message(""); return "annule"; }
      if (e && e.name === "NotAllowedError" && pret) {      // téléchargement trop long pour le téléphone : on redemande un toucher
        message(T2("Vidéo prête : touchez encore « Partager »", "الفيديو جاهز: المس « شارك » مرة أخرى"));
        setTimeout(() => message(""), 6000); return "pret";
      }
      message(""); return lienSeul(titre, url);
    }
  };
})();

/* Anti-copie légère (consigne sécurité commune) : images protégées, listes non sélectionnables, source ajoutée au texte copié.
   Restent libres : champs de formulaire, numéros de téléphone et adresses (le visiteur doit pouvoir les copier). */
document.addEventListener("contextmenu", e => { if (e.target.closest && e.target.closest("img, svg, .protege")) e.preventDefault(); });
document.addEventListener("dragstart", e => { if (e.target.closest && e.target.closest("img, .protege")) e.preventDefault(); });
document.addEventListener("copy", e => {
  const el = document.activeElement;
  if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
  const sel = String(window.getSelection ? window.getSelection() : "");
  if (!sel || !e.clipboardData) return;
  const nom = window.CONF ? window.CONF.nom.fr : "";
  e.clipboardData.setData("text/plain", sel + "\n\nSource : " + location.href.split("?")[0].split("#")[0] + " — © " + nom + ", tous droits réservés.");
  e.preventDefault();
});
