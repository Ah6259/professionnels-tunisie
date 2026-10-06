"""Robot de nuit (moteur d'annuaire commun) : relève dans OpenStreetMap les professionnels des métiers du site,
gouvernorat par gouvernorat, et écrit donnees/osm.json.
  python tools/releve_osm.py            (depuis le dossier du site)
Données OSM : licence ODbL, crédit « © les contributeurs d'OpenStreetMap » affiché sur chaque page.
Prudence : si le relevé ramène beaucoup moins de fiches que la fois précédente (panne du serveur), on garde
l'ancien fichier et on sort en erreur (le robot GitHub échoue et prévient Ahmed par e-mail)."""
import json
import pathlib
import re
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from osm import requete  # noqa: E402

RACINE = pathlib.Path(__file__).resolve().parent.parent
CONF = json.loads((RACINE / "config.json").read_text(encoding="utf-8"))
SORTIE = RACINE / "donnees" / "osm.json"

# les 24 gouvernorats (code ISO 3166-2, slug du site, nom FR, nom AR)
GOUVERNORATS = [
    ("TN-12", "ariana", "Ariana", "أريانة"), ("TN-31", "beja", "Béja", "باجة"), ("TN-13", "ben-arous", "Ben Arous", "بن عروس"),
    ("TN-23", "bizerte", "Bizerte", "بنزرت"), ("TN-81", "gabes", "Gabès", "قابس"), ("TN-71", "gafsa", "Gafsa", "قفصة"),
    ("TN-32", "jendouba", "Jendouba", "جندوبة"), ("TN-41", "kairouan", "Kairouan", "القيروان"), ("TN-42", "kasserine", "Kasserine", "القصرين"),
    ("TN-73", "kebili", "Kébili", "قبلي"), ("TN-33", "le-kef", "Le Kef", "الكاف"), ("TN-53", "mahdia", "Mahdia", "المهدية"),
    ("TN-14", "la-manouba", "La Manouba", "منوبة"), ("TN-82", "medenine", "Médenine", "مدنين"), ("TN-52", "monastir", "Monastir", "المنستير"),
    ("TN-21", "nabeul", "Nabeul", "نابل"), ("TN-61", "sfax", "Sfax", "صفاقس"), ("TN-43", "sidi-bouzid", "Sidi Bouzid", "سيدي بوزيد"),
    ("TN-34", "siliana", "Siliana", "سليانة"), ("TN-51", "sousse", "Sousse", "سوسة"), ("TN-83", "tataouine", "Tataouine", "تطاوين"),
    ("TN-72", "tozeur", "Tozeur", "توزر"), ("TN-11", "tunis", "Tunis", "تونس"), ("TN-22", "zaghouan", "Zaghouan", "زغوان"),
]
PAR_ISO = {g[0]: g for g in GOUVERNORATS}


def filtres():
    """Une ligne Overpass par étiquette OSM de chaque métier, ex. nwr["amenity"="driving_school"](area.g);"""
    lignes = []
    for m in CONF["metiers"]:
        for etiquette in m["osm"]:
            k, v = etiquette.split("=", 1)
            lignes.append((m["id"], k, v, f'nwr["{k}"="{v}"](area.g);'))
        if m.get("noms"):   # expression du nom (ex. « auto[ -]?[ée]cole|مدرسة سياقة ») : établissements mal étiquetés
            lignes.append((m["id"], "name", "~" + m["noms"], f'nwr["name"~"{m["noms"]}",i](area.g);'))
    return lignes


def telephone(t):
    """Garde un numéro tunisien lisible (8 chiffres), avec l'indicatif pour les liens. Sinon None."""
    if not t:
        return None
    t = t.split(";")[0]
    chiffres = re.sub(r"\D", "", t)
    if chiffres.startswith("00216"):
        chiffres = chiffres[5:]
    elif chiffres.startswith("216") and len(chiffres) == 11:
        chiffres = chiffres[3:]
    if len(chiffres) != 8:
        return None
    return chiffres


def releve():
    L = filtres()
    union = "".join(x[3] for x in L)
    q = ('[out:json][timeout:300];'
         'area["ISO3166-1"="TN"][admin_level=2]->.tn;'
         'rel(area.tn)["boundary"="administrative"]["admin_level"="4"]->.rs;'
         '.rs map_to_area->.gs;'
         'foreach.gs->.g(.g out tags;(' + union + ');out center tags;);')
    # les 24 gouvernorats doivent être présents dans la réponse, sinon on essaie un autre serveur
    d = requete(q, verifier=lambda d: sum(1 for e in d.get("elements", []) if e["type"] == "area") >= 24)
    fiches, courant = {}, None
    for e in d["elements"]:
        if e["type"] == "area":
            courant = PAR_ISO.get(e.get("tags", {}).get("ISO3166-2"))
            continue
        if not courant:
            continue
        t = e.get("tags", {})
        metier = next((m for m, k, val, _ in L if (t.get(k) == val) or (val.startswith("~") and re.search(val[1:], t.get(k) or "", re.I))), None)
        nom = (t.get("name:fr") or t.get("name") or "").strip()
        if not metier or not nom:
            continue                       # sans nom : pas de fiche (rien d'utile à montrer)
        lat = e.get("lat") or e.get("center", {}).get("lat")
        lon = e.get("lon") or e.get("center", {}).get("lon")
        ident = f"osm-{e['type'][0]}{e['id']}"
        fiches[ident] = {
            "id": ident, "source": "osm", "metier": metier,
            "nom": nom, "nom_ar": (t.get("name:ar") or "").strip() or None,
            "gouvernorat": courant[1],
            "ville": (t.get("addr:city") or t.get("addr:place") or t.get("addr:suburb") or "").strip() or None,
            "adresse": " ".join(x for x in [t.get("addr:housenumber"), t.get("addr:street")] if x) or None,
            "tel": telephone(t.get("phone") or t.get("contact:phone") or t.get("contact:mobile")),
            "site": (t.get("website") or t.get("contact:website") or "").strip() or None,
            "horaires": (t.get("opening_hours") or "").strip() or None,
            "lat": round(lat, 6) if lat else None, "lon": round(lon, 6) if lon else None,
            "osm": f"https://www.openstreetmap.org/{e['type']}/{e['id']}",
        }
    return sorted(fiches.values(), key=lambda f: (f["gouvernorat"], f["nom"].lower()))


def main():
    ancien = json.loads(SORTIE.read_text(encoding="utf-8")) if SORTIE.exists() else {"fiches": []}
    for essai in range(3):
        try:
            fiches = releve()
            break
        except Exception as e:  # serveur saturé : on réessaie un peu plus tard
            print("relevé impossible :", e)
            time.sleep(120)
    else:
        print("ÉCHEC : OpenStreetMap indisponible, ancien fichier gardé.")
        return 1
    avant = len(ancien.get("fiches", []))
    if avant >= 10 and len(fiches) < avant * 0.5:
        print(f"ÉCHEC : {len(fiches)} fiches au lieu de {avant} (chute suspecte), ancien fichier gardé.")
        return 1
    SORTIE.parent.mkdir(exist_ok=True)
    SORTIE.write_text(json.dumps({"source": "OpenStreetMap (ODbL)", "fiches": fiches}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    par_g = {}
    for f in fiches:
        par_g[f["gouvernorat"]] = par_g.get(f["gouvernorat"], 0) + 1
    print(f"{len(fiches)} fiches (avant : {avant}) :", ", ".join(f"{g} {n}" for g, n in sorted(par_g.items())))
    return 0


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    sys.exit(main())
