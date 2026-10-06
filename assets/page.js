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
      <button class="langue" type="button">${T("العربية", "Français")}</button></div>`;
    const p = document.getElementById("pied");
    if (p) p.innerHTML = `<div class="wrap">
      <nav><a href="${racine || "./"}">${T("Accueil", "الرئيسية")}</a><a href="${racine}inscription/">${T("Professionnels", "المهنيون")}</a>
        <a href="${racine}a-propos/">${T("À propos et sources", "من نحن والمصادر")}</a><a href="${racine || "./"}#avis">${T("Votre avis", "رأيك")}</a>
        ${C.liens.map(l => `<a href="${l.url}">${t(l)}</a>`).join("")}</nav>
      <p>${T("Fiches : © les contributeurs d'OpenStreetMap (licence ODbL) et demandes des professionnels. Site gratuit et non officiel : appelez avant de vous déplacer.",
             "البطاقات: © المساهمون في OpenStreetMap (رخصة ODbL) وطلبات المهنيين. موقع مجاني وغير رسمي: اتصل قبل التنقل.")}</p>
      <p>© 2026 ${t(C.nom)} — ${T("tous droits réservés.", "جميع الحقوق محفوظة.")}</p></div>`;
    document.querySelectorAll(".langue").forEach(b => b.addEventListener("click", () => appliquer(html.lang === "ar" ? "fr" : "ar")));
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
