/* Moteur d'annuaire — langue (français / arabe), en-tête et pied communs, protection légère, installation.
   Les textes propres au site viennent de assets/conf.js (fabriqué par tools/construire.mjs). */
// La mémoire du navigateur est PARTAGÉE par tous les sites d'ah6259.github.io : n'accepter que « fr » ou « ar »
// (le site des conférences gardait « en » → textes tous cachés)
(function () {
  if (window.top === window.self) return;                       // anti-cadre : pas d'affichage dans un autre site
  let meme = false;
  try { meme = window.top.location.hostname === window.location.hostname; } catch (e) { meme = false; }
  if (!meme) { try { window.top.location.href = window.location.href; } catch (e) { document.documentElement.hidden = true; } }
})();

(function () {
  const html = document.documentElement, racine = html.dataset.racine || "", C = window.CONF;
  let langue = "fr";
  try { langue = (/^(fr|ar)$/.test(localStorage.getItem("langue") || "") ? localStorage.getItem("langue") : "") || ((navigator.language || "").startsWith("ar") ? "ar" : "fr"); } catch (e) {}
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
    // bouton Partager (demande d'Ahmed) : un LIEN vers la page vidéo du site (+ l'adresse du site dans le texte) ;
    // sur l'espace professionnels : la page « video-pro/ » (voir window.partagerLien plus bas)
    document.querySelectorAll(".partager").forEach(b => b.addEventListener("click", () => {
      try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "partage" + location.pathname.replace(C.base, "/"), title: "Partage", event: true }); } catch (e) {}
      return window.partagerLien();
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

/* >>> vidéo de présentation : page video/ (et video-pro/ pour l'espace professionnels), partagée par le bouton « Partager » */
window.VIDEO_SITE = { base: (window.CONF || {}).base || "/", defaut: "fr", pro: ["inscription/", "video-pro/"], site_pro: "inscription/", ancre_pro: "#offres",
  nom: { fr: ((window.CONF || {}).nom || {}).fr ? window.CONF.nom.fr.split(" — ")[0] : "", ar: ((window.CONF || {}).nom || {}).ar ? window.CONF.nom.ar.split(" — ")[0] : "" },
  titre_pro: { fr: "Professionnels, soyez trouvés", ar: "أيها المهنيون، اجعلوا الحرفاء يجدونكم" } };
/* Bouton « Partager » (demande d'Ahmed, octobre 2026) : partage un LIEN vers la page vidéo du site (qui montre la vidéo
   de présentation, avec un gros bouton « Ouvrir le site ») + l'adresse du site dans le texte. WhatsApp et Facebook
   affichent l'aperçu de la page vidéo (grande image, vidéo lisible sur Facebook). Menu de partage du téléphone, sinon WhatsApp.
   Espace professionnels des annuaires : page « video-pro/ ». Réglages : window.VIDEO_SITE (juste au-dessus). */
(function () {
  var S = window.VIDEO_SITE, ORIGINE = "https://ah6259.github.io";
  function langue() { return document.documentElement.lang || S.defaut; }
  function M(o) { return o[langue()] || o[S.defaut] || o.fr; }
  // page vidéo à partager (et page du site correspondante) selon la page où l'on est
  window.pageVideo = function () {
    var chemin = location.pathname, pro = false;
    for (var i = 0; i < (S.pro || []).length; i++) if (chemin.indexOf(S.base + S.pro[i]) === 0) pro = true;
    var l = langue(), q = l !== S.defaut ? "?lang=" + l : "";
    return { page: ORIGINE + S.base + (pro ? "video-pro/" : "video/") + q, site: ORIGINE + S.base + (pro ? S.site_pro : "") + q + (pro ? (S.ancre_pro || "") : ""),
             titre: M(pro ? S.titre_pro : S.nom) };
  };
  window.partagerLien = function (titre, site) {
    var v = window.pageVideo(), t = titre || v.titre;
    if (site) v.site = site;
    var texte = t + "\n" + M({ fr: "Le site : ", ar: "الموقع: ", en: "The website: " }) + v.site + "\n" + M({ fr: "Regardez la vidéo :", ar: "شاهد الفيديو:", en: "Watch the video:" });
    function whatsapp() { window.open("https://wa.me/?text=" + encodeURIComponent(texte + " " + v.page), "_blank", "noopener"); return "whatsapp"; }
    if (navigator.share) {
      return navigator.share({ title: t, text: texte, url: v.page }).then(function () { return "lien"; }, function (e) {
        return e && e.name === "AbortError" ? "annule" : whatsapp();
      });
    }
    return Promise.resolve(whatsapp());
  };
  // page vidéo : textes dans la langue de la page (data-vfr / data-var / data-ven), vidéo de la langue (data-src-fr…)
  function traduire() {
    var l = langue();
    var el = document.querySelectorAll("[data-vfr]");
    for (var i = 0; i < el.length; i++) { var t = el[i].getAttribute("data-v" + l) || el[i].getAttribute("data-v" + S.defaut); if (t && el[i].textContent !== t) el[i].textContent = t; }
    var v = document.querySelector(".video-lecteur");
    if (v) {
      var s = v.getAttribute("data-src-" + l) || v.getAttribute("data-src-defaut") || v.getAttribute("src");
      if (!v.getAttribute("data-src-defaut")) v.setAttribute("data-src-defaut", v.getAttribute("src"));
      if (v.getAttribute("src") !== s) v.setAttribute("src", s);
      if (!v.getAttribute("data-poster-defaut")) v.setAttribute("data-poster-defaut", v.getAttribute("poster"));
      var po = v.getAttribute("data-poster-" + l) || v.getAttribute("data-poster-defaut");
      if (v.getAttribute("poster") !== po) v.setAttribute("poster", po);
    }
    // lien discret « Vidéo de présentation » en bas de l'accueil et de À propos -> la page vidéo
    var p = location.pathname.replace(/index\.html$/, "");
    if (p === S.base || p === S.base + "a-propos/") {
      var b = document.getElementById("lien-video");
      if (!b) {
        b = document.createElement("p"); b.id = "lien-video"; b.className = "lien-video"; b.appendChild(document.createElement("a"));
        var m = document.querySelector("main"); if (m) m.insertAdjacentElement("afterend", b); else document.body.appendChild(b);
      }
      b.firstChild.href = S.base + "video/" + (l !== S.defaut ? "?lang=" + l : "");
      b.firstChild.textContent = M({ fr: "Vidéo de présentation", ar: "الفيديو التقديمي", en: "Presentation video" });
    }
  }
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest && e.target.closest("[data-partager-video]");
    if (!b) return;
    e.preventDefault();
    try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: "partage" + location.pathname.replace(S.base, "/"), title: "Partage", event: true }); } catch (x) {}
    window.partagerLien();
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(traduire, 0); }); else setTimeout(traduire, 0);
  document.addEventListener("langue", function () { setTimeout(traduire, 0); });
  try { new MutationObserver(function () { setTimeout(traduire, 0); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] }); } catch (x) {}
})();
/* <<< vidéo de présentation */

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
