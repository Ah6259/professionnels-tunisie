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
        p.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
        print(f"{n} adresse(s) de site OSM complétée(s) par https://")


AGENCES_IMMO = "https://immobilier.clicvia.com/donnees/agences.json"
METIER_AGENCE = "agence-immobiliere"


def _hote(u):
    import re
    return re.sub(r"^https?://(www\.)?", "", (u or "").lower()).split("/")[0]


def locaux_infos():
    """(sites, numéros) des fiches déjà présentes ici (OpenStreetMap, pages publiques) : pas de doublon."""
    sites, tels = set(), set()
    for nom in ("osm.json", "manuels.json"):
        p = RACINE / "donnees" / nom
        if p.exists():
            for f in json.loads(p.read_text(encoding="utf-8")).get("fiches", []):
                if f.get("site"):
                    sites.add(_hote(f["site"]))
                if f.get("tel"):
                    tels.add(str(f["tel"])[-8:])
    return sites, tels


GOUVS = [["ariana"], ["beja"], ["ben-arous"], ["bizerte"], ["gabes"], ["gafsa"], ["jendouba"], ["kairouan"], ["kasserine"], ["kebili"],
         ["le-kef"], ["mahdia"], ["la-manouba"], ["medenine"], ["monastir"], ["nabeul"], ["sfax"], ["sidi-bouzid"], ["siliana"],
         ["sousse"], ["tataouine"], ["tozeur"], ["tunis"], ["zaghouan"]]   # mêmes identifiants que tools/construire.mjs (liste de La Poste)


def agences_immobilier(locaux, ancien, lire=None):
    """Fiches des agences de la liste publique d'Immobilier Tunisie (fonction testée hors ligne avec `lire`)."""
    import re
    sites, tels = locaux
    try:
        if lire:
            d = lire()
        else:
            with urllib.request.urlopen(urllib.request.Request(AGENCES_IMMO, headers=AGENT), timeout=60) as r:
                d = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        gardees = [f for f in ancien.get("fiches", []) if f["id"].startswith("im-")]
        print(f"ATTENTION : liste des agences d'Immobilier Tunisie indisponible ({e}) : {len(gardees)} anciennes fiches gardées")
        return gardees
    out = []
    for a in d.get("agences", []):
        h = _hote(a.get("site"))
        tel = re.sub(r"\D", "", a.get("tel") or "")[-8:] or None
        # 27/10/2026 (Ahmed : « ajoute les agences Tecnocasa et Century 21 ») : une agence d'un RÉSEAU a son identifiant propre
        # (« id_reseau » : tecnocasa-tugm1, century21-century-21-alliance) ; plusieurs agences partagent le site du réseau, donc
        # ni l'identifiant ni le doublon ne se décident par le site (seulement par le numéro)
        # 27/10/2026 : le site immobilier écrit « manouba », l'annuaire « la-manouba » ; un gouvernorat inconnu de l'annuaire = fiche
        # sans page (test « toute fiche sans page est un doublon ») : jamais reprise
        g = {"manouba": "la-manouba"}.get(a.get("gouvernorat"), a.get("gouvernorat"))
        if g not in {x[0] for x in GOUVS}:
            continue
        a = {**a, "gouvernorat": g}
        reseau = re.sub(r"[^a-z0-9]+", "-", str(a.get("id_reseau") or "").lower()).strip("-")
        if not h or not a.get("gouvernorat") or (h in sites and not reseau) or (tel and tel in tels):
            continue
        ident = "im-" + (reseau or re.sub(r"[^a-z0-9]+", "-", h).strip("-"))
        if any(f["id"] == ident for f in out):
            continue
        out.append({"id": ident, "source": "web", "source_url": a["site"],
                    "releve": d.get("maj"), "metier": METIER_AGENCE, "nom": a.get("nom") or h, "nom_ar": None,
                    "gouvernorat": a["gouvernorat"], "ville": None, "adresse": a.get("adresse"), "tel": tel,
                    "site": a["site"], "facebook": a.get("facebook"), "horaires": None, "annuaire": "immobilier",
                    "annonces_immobilier": a.get("annonces") or 0})
    return out


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
    # 21/10/2026 (Ahmed, contrepartie des accords des agences) : les agences immobilières dont Immobilier Tunisie lit les annonces
    # (liste publique https://immobilier.clicvia.com/donnees/agences.json : nom, site, Facebook, adresse, numéro PROFESSIONNEL lus sur
    # le site de l'agence elle-même). Fiche « web » (informations publiées par l'établissement) ; jamais en double d'une fiche
    # OpenStreetMap (même site ou même numéro) ; agence sans gouvernorat connu : reprise au passage suivant.
    im = agences_immobilier(locaux_infos(), ancien)
    fiches += im
    bilan.append(f"immobilier {len(im)}")
    if not fiches:
        print("ÉCHEC : aucune fiche reprise, ancien fichier gardé.")
        return 1
    SORTIE.parent.mkdir(exist_ok=True)
    SORTIE.write_text(json.dumps({"source": "annuaires spécialisés du même éditeur (dépôts publics Ah6259)", "fiches": fiches},
                                 ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(fiches)} fiches reprises :", ", ".join(bilan))
    return 0   # une panne partielle n'empêche pas la mise à jour (anciennes fiches gardées)


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    sys.exit(main())
