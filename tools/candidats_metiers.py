"""Liste des MÉTIERS qui existent en Tunisie dans OpenStreetMap, pour la routine « un nouveau métier par jour » (20/10/2026).

Pourquoi : la routine cloud `professionnels-nouveau-metier` interrogeait elle-même OpenStreetMap (Overpass), mais le réseau du
cloud de Claude bloque ces serveurs depuis le 08/10/2026 : aucun métier ajouté et « À VOIR PAR AHMED » chaque matin. Le robot
GitHub, lui, joint Overpass : il prépare chaque nuit cette liste (donnees/candidats-metiers.json), la routine la lit.

Pour chaque étiquette craft=… / office=… / shop=… présente en Tunisie : nombre de lieux, nombre de lieux JOIGNABLES (téléphone,
site ou e-mail), déjà dans l'annuaire ou non, santé (jamais proposée : règle de l'annuaire). Les plus joignables d'abord.
"""
import datetime as dt
import json
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
sys.path.insert(0, ICI)
import osm as O      # noqa: E402

CLES = ("craft", "office", "shop")
SANTE = {"shop=chemist", "shop=medical_supply", "shop=hearing_aids", "shop=herbalist", "shop=nutrition_supplements",
         "office=physician", "office=therapist", "craft=dental_technician", "office=medical", "shop=pharmacy"}
# pas des métiers qu'on appelle (administrations, ambassades, sociétés, associations, partis, lieux de culte)
PAS_UN_METIER = {"office=government", "office=diplomatic", "office=company", "office=ngo", "office=association", "office=political_party",
                 "office=religion", "office=educational_institution", "office=administrative", "office=yes", "office=quango", "office=union"}
CONTACT = ("phone", "contact:phone", "mobile", "contact:mobile", "website", "contact:website", "email", "contact:email",
           "contact:facebook", "facebook")
REQUETE = '[out:json][timeout:180];area["ISO3166-1"="TN"][admin_level=2]->.tn;(nwr["{cle}"](area.tn););out tags;'


def compter(elements, cle):
    """{"cle=valeur": [nombre, joignables]} (fonction pure, testée)."""
    c = {}
    for e in elements:
        t = e.get("tags") or {}
        v = (t.get(cle) or "").strip().lower()
        if not v or v in ("yes", "no") or ";" in v:
            continue
        x = c.setdefault(f"{cle}={v}", [0, 0])
        x[0] += 1
        x[1] += any(t.get(k) for k in CONTACT)
    return c


def main():
    config = json.load(open(os.path.join(RACINE, "config.json"), encoding="utf-8"))
    deja = {t for m in config["metiers"] for t in m.get("osm") or []}
    tout = {}
    for cle in CLES:
        d = O.requete(REQUETE.format(cle=cle), verifier=lambda d: "elements" in d)
        tout.update(compter(d["elements"], cle))
        print(f"{cle} : {len(d['elements'])} lieux en Tunisie")
    candidats = sorted(({"osm": t, "lieux": n, "joignables": j, "deja": t in deja, "sante": t in SANTE,
                         "pas_un_metier": t in PAS_UN_METIER} for t, (n, j) in tout.items()),
                       key=lambda x: (-x["joignables"], -x["lieux"], x["osm"]))
    sortie = {"maj": dt.date.today().isoformat(), "source": "© les contributeurs d'OpenStreetMap (ODbL)", "candidats": candidats}
    with open(os.path.join(RACINE, "donnees", "candidats-metiers.json"), "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(sortie, ensure_ascii=False, indent=0) + "\n")
    libres = [c for c in candidats if not c["deja"] and not c["sante"] and not c["pas_un_metier"] and c["joignables"] >= 5]
    print(f"{len(candidats)} métiers trouvés ; {len(libres)} absents de l'annuaire avec au moins 5 lieux joignables : "
          + ", ".join(f"{c['osm']} ({c['joignables']})" for c in libres[:8]))


if __name__ == "__main__":
    main()
