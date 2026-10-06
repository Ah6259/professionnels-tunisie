"""Active un professionnel (formule Pro, mois gratuit, paiement reçu, fiche vérifiée) — sans PC.
Lancé par le bouton « Activer un Pro » de GitHub (.github/workflows/activer-pro.yml, depuis l'application GitHub du téléphone),
ou à la main :  python tools/activer_pro.py --action paye --fiche <id> [--mois 12]
Actions :
  essai     → formule Pro, 1er mois gratuit à partir d'aujourd'hui
  paye      → paiement reçu : Pro prolongé de N mois (12 par défaut) à partir de la fin actuelle (ou d'aujourd'hui)
  verifiee  → fiche gratuite vérifiée par l'établissement (badge « Vérifiée »)
  arret     → fin de la formule Pro (la fiche redevient gratuite, jamais supprimée)
Nouvelle fiche (le pro n'est pas encore dans l'annuaire) : laisser --fiche vide et donner --nom, --metier, --gouvernorat,
--ville, --telephone → la fiche est créée dans donnees/inscrits.json (source « inscrit »)."""
import argparse, datetime, json, pathlib, re, sys, unicodedata

sys.stdout.reconfigure(encoding="utf-8")
RACINE = pathlib.Path(__file__).resolve().parent.parent
CONF = json.loads((RACINE / "config.json").read_text(encoding="utf-8"))
GOUV = ["ariana", "beja", "ben-arous", "bizerte", "gabes", "gafsa", "jendouba", "kairouan", "kasserine", "kebili", "le-kef", "mahdia",
        "la-manouba", "medenine", "monastir", "nabeul", "sfax", "sidi-bouzid", "siliana", "sousse", "tataouine", "tozeur", "tunis", "zaghouan"]


def slug(t):
    t = unicodedata.normalize("NFD", str(t or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def lire(nom, defaut):
    p = RACINE / "donnees" / nom
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else defaut


def ecrire(nom, d):
    (RACINE / "donnees" / nom).write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def plus_mois(d, n):
    a, m = d.year + (d.month - 1 + n) // 12, (d.month - 1 + n) % 12 + 1
    jours = [31, 29 if a % 4 == 0 and (a % 100 or a % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
    return datetime.date(a, m, min(d.day, jours))


def toutes_fiches():
    ids = set()
    for f in ["osm.json", "manuels.json", "inscrits.json", "importes.json"]:
        ids |= {x.get("id") for x in lire(f, {"fiches": []}).get("fiches", [])}
    return ids


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--action", required=True, choices=["essai", "paye", "verifiee", "arret"])
    a.add_argument("--fiche", default="")
    a.add_argument("--mois", type=int, default=12)
    for k in ["nom", "metier", "gouvernorat", "ville", "telephone"]:
        a.add_argument("--" + k, default="")
    o = a.parse_args()
    auj = datetime.date.today()
    fiche = o.fiche.strip()

    if not fiche:  # nouvelle fiche donnée par le pro
        metiers = {m["id"]: m for m in CONF["metiers"]}
        met = next((i for i, m in metiers.items() if slug(o.metier) in (i, slug(m["fr"]), slug(m.get("fr_pl", "")))), None)
        gouv = slug(o.gouvernorat)
        tel = re.sub(r"\D", "", o.telephone)[-8:]
        manque = [n for n, v in [("nom", o.nom.strip()), ("métier", met), ("gouvernorat", gouv in GOUV), ("téléphone (8 chiffres)", len(tel) == 8)] if not v]
        if manque:
            sys.exit("Impossible de créer la fiche, il manque : " + ", ".join(manque) + f". Métiers possibles : {', '.join(metiers)}")
        fiche = f"ins-{gouv}-{slug(o.nom)[:40]}"
        ins = lire("inscrits.json", {"fiches": []})
        if not any(f["id"] == fiche for f in ins["fiches"]):
            ins["fiches"].append({"id": fiche, "source": "inscrit", "metier": met, "nom": o.nom.strip(), "nom_ar": None, "gouvernorat": gouv,
                                  "ville": o.ville.strip() or None, "adresse": None, "tel": tel, "site": None, "horaires": None,
                                  "lat": None, "lon": None, "releve": auj.strftime("%d/%m/%Y")})
            ecrire("inscrits.json", ins)
            print(f"Nouvelle fiche créée : {fiche}")
    elif fiche not in toutes_fiches():
        sys.exit(f"Fiche « {fiche} » introuvable. Copiez l'identifiant depuis l'adresse de la fiche (…/fiche/<identifiant>/).")

    pros = lire("pros.json", {"pros": []})
    p = next((x for x in pros["pros"] if x["fiche"] == fiche), None)
    if not p:
        p = {"fiche": fiche}; pros["pros"].append(p)
    p.setdefault("verifiee", auj.isoformat())
    if o.action == "verifiee":
        p.setdefault("formule", "gratuite")
    elif o.action == "essai":
        p.update({"formule": "pro", "debut": auj.isoformat()}); p.pop("fin_paiement", None)
    elif o.action == "paye":
        p["formule"] = "pro"; p.setdefault("debut", auj.isoformat())
        # les mois payés commencent après le mois gratuit en cours ou après la période déjà payée
        fin_essai = plus_mois(datetime.date.fromisoformat(p["debut"]), int((CONF.get("pro") or {}).get("mois_gratuits", 1)))
        fin = max([auj, fin_essai] + ([datetime.date.fromisoformat(p["fin_paiement"])] if p.get("fin_paiement") else []))
        p["fin_paiement"] = plus_mois(fin, o.mois).isoformat()
    elif o.action == "arret":
        p["formule"] = "gratuite"; p.pop("debut", None); p.pop("fin_paiement", None)
    ecrire("pros.json", pros)
    print(f"{o.action} → {json.dumps(p, ensure_ascii=False)}")


if __name__ == "__main__":
    main()
