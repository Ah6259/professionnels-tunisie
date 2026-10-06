"""Reprend les fiches de NOS 4 annuaires spécialisés (dépôts publics GitHub d'Ahmed) pour cet annuaire qui les regroupe.
  python tools/importer_annuaires.py            (depuis le dossier du site ; lancé chaque nuit par .github/workflows/maj.yml)
Pour chaque annuaire : donnees/manuels.json (pages publiques des établissements) + donnees/osm.json (OpenStreetMap),
moins ses fiches retirées (donnees/retraits.json : un retrait demandé là-bas vaut aussi ici).
On garde seulement les métiers présents dans config.json (mêmes identifiants), on préfixe les identifiants
(« ae-… », « an-… », « co-… », « ma-… ») et on écrit donnees/importes.json (lu par tools/construire.mjs).
Une fiche OpenStreetMap déjà relevée ici (même objet OSM dans donnees/osm.json) ou une page publique déjà dans
donnees/manuels.json n'est pas reprise une 2e fois.
Avant cela : les sites saisis sans « https:// » dans donnees/osm.json sont complétés (liens de fiche valides).
Prudence : si un annuaire ne répond pas, on garde ses anciennes fiches (le site n'est jamais vidé)."""
import json
import pathlib
import sys
import time
import urllib.error
import urllib.request

RACINE = pathlib.Path(__file__).resolve().parent.parent
CONF = json.loads((RACINE / "config.json").read_text(encoding="utf-8"))
SORTIE = RACINE / "donnees" / "importes.json"
ANNUAIRES = {"auto-ecoles-tunisie": "ae", "avocats-notaires-tunisie": "an", "comptables-tunisie": "co", "mariage-tunisie": "ma"}
BRUT = "https://raw.githubusercontent.com/Ah6259/{depot}/main/donnees/{fichier}"
AGENT = {"User-Agent": "annuaires-tunisie/1.0 (reprise de nos propres annuaires)"}


def telecharger(depot, fichier, obligatoire=True):
    for essai in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(BRUT.format(depot=depot, fichier=fichier), headers=AGENT), timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 404 and not obligatoire:
                return None
            erreur = e
        except Exception as e:  # coupure réseau : on réessaie
            erreur = e
        time.sleep(5 * (essai + 1))
    raise RuntimeError(f"{depot}/{fichier} : {erreur}")


def corriger_sites_osm():
    """Adresse de site saisie sans « https:// » dans OpenStreetMap (ex. www.exemple.tn) : sinon le lien de la fiche est cassé."""
    p = RACINE / "donnees" / "osm.json"
    if not p.exists():
        return
    d = json.loads(p.read_text(encoding="utf-8"))
    n = 0
    for f in d.get("fiches", []):
        s = (f.get("site") or "").strip()
        if s and not s.lower().startswith(("http://", "https://")):
            f["site"] = "https://" + s.lstrip("/"); n += 1
    if n:
        p.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"{n} adresse(s) de site OSM complétée(s) par https://")


def main():
    corriger_sites_osm()
    metiers = {m["id"] for m in CONF["metiers"]}
    locaux = {f["id"] for f in json.loads((RACINE / "donnees" / "osm.json").read_text(encoding="utf-8")).get("fiches", [])} \
        if (RACINE / "donnees" / "osm.json").exists() else set()
    page = lambda u: (u or "").lower().replace("://facebook.com", "://www.facebook.com").rstrip("/#")
    nos_pages = {page(f.get("source_url")) for f in json.loads((RACINE / "donnees" / "manuels.json").read_text(encoding="utf-8")).get("fiches", [])}         if (RACINE / "donnees" / "manuels.json").exists() else set()
    nos_pages.discard("")
    ancien = json.loads(SORTIE.read_text(encoding="utf-8")) if SORTIE.exists() else {"fiches": []}
    fiches, bilan, panne = [], [], False
    for depot, prefixe in ANNUAIRES.items():
        try:
            retraits = set((telecharger(depot, "retraits.json", obligatoire=False) or {}).get("ids", []))
            source = (telecharger(depot, "manuels.json", obligatoire=False) or {}).get("fiches", []) + telecharger(depot, "osm.json").get("fiches", [])
            if not source:
                raise RuntimeError("aucune fiche (réponse vide)")
        except Exception as e:
            panne = True
            gardees = [f for f in ancien.get("fiches", []) if f["id"].startswith(prefixe + "-")]
            print(f"ATTENTION : {depot} indisponible ({e}) : {len(gardees)} anciennes fiches gardées")
            fiches += gardees
            continue
        n = 0
        for f in source:
            if not f or not f.get("id") or f.get("metier") not in metiers or f["id"] in retraits:
                continue
            if f.get("source") == "osm" and f["id"] in locaux:   # même objet OpenStreetMap déjà relevé ici
                continue
            if f.get("source_url") and page(f["source_url"]) in nos_pages:   # même page publique déjà dans nos fiches « web »
                continue
            fiches.append({**f, "id": f"{prefixe}-{f['id']}", "annuaire": depot})
            n += 1
        bilan.append(f"{depot} {n}")
    if not fiches:
        print("ÉCHEC : aucune fiche reprise, ancien fichier gardé.")
        return 1
    SORTIE.parent.mkdir(exist_ok=True)
    SORTIE.write_text(json.dumps({"source": "annuaires spécialisés du même éditeur (dépôts publics Ah6259)", "fiches": fiches},
                                 ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(fiches)} fiches reprises :", ", ".join(bilan))
    return 0   # une panne partielle n'empêche pas la mise à jour (anciennes fiches gardées)


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    sys.exit(main())
