"""Requêtes OpenStreetMap (Overpass) prudentes : plusieurs serveurs, nouvelles tentatives, pause entre les essais.
Données OSM sous licence ODbL : crédit « © les contributeurs d'OpenStreetMap » obligatoire sur le site."""
import json
import os
import time
import urllib.parse
import urllib.request

SERVEURS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter",
            "https://overpass.openstreetmap.fr/api/interpreter"]   # un serveur en panne est simplement sauté
AGENT = "annuaires-tunisie/1.0 (sites gratuits pour la Tunisie ; robot de nuit)"


# 21/10/2026 : serveurs lents -> jusqu'à 3 x 10 essais de 3 min = près de 2 h ; le robot était COUPÉ par GitHub à 30 min, sans
# message ni données gardées proprement. Budget TOTAL de temps (20 min par défaut, OSM_BUDGET_S) : ensuite on s'arrête et on le dit.
DEBUT = time.monotonic()
BUDGET = float(os.environ.get("OSM_BUDGET_S") or 1200)


def reste():
    """Secondes restantes du budget de temps des requêtes OpenStreetMap."""
    return BUDGET - (time.monotonic() - DEBUT)


def requete(q, essais=10, verifier=None):
    derniere = None
    for i in range(essais):
        if reste() < 30:
            raise RuntimeError(f"Overpass trop lent : budget de {int(BUDGET // 60)} min dépassé ({derniere})")
        url = SERVEURS[i % len(SERVEURS)]
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": q}).encode(),
                                         headers={"User-Agent": AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=min(180, max(10, reste()))) as r:
                d = json.loads(r.read().decode("utf-8"))
            remarque = str(d.get("remark", ""))
            if "error" in remarque.lower() or "timed out" in remarque.lower():   # réponse tronquée par le serveur
                raise RuntimeError("réponse incomplète : " + remarque[:120])
            if verifier and not verifier(d):
                raise RuntimeError("réponse incomplète (contrôle du contenu)")
            return d
        except Exception as e:  # 429 / 504 / coupure : on attend puis on change de serveur
            derniere = e
            print(f"  essai {i + 1} ({url.split('/')[2]}) : {str(e)[:120]}", flush=True)
            time.sleep(max(0, min(60, 8 * (i + 1), reste() - 30)))
    raise RuntimeError(f"Overpass indisponible après {essais} essais : {derniere}")


# ---------------------------------------------------------------------------------------------------------------------------
# Panne passagère d'OpenStreetMap (02/11/2026 : les 5 serveurs Overpass en panne en même temps, robot candidats-metiers rouge).
# Règle commune (source en panne) : une panne courte n'est PAS une alerte ; l'ancien fichier est gardé, la date du début de la
# panne est notée dans donnees/etat-osm.json (enregistré par le robot) et un nouvel essai a lieu au passage suivant ;
# le robot devient ROUGE seulement si la panne dure depuis plus de 2 jours (PANNE_MAX_JOURS).
PANNE_MAX_JOURS = 2


def decider(etat, robot, reussi, aujourdhui):
    """Fonction pure (testée). etat = contenu de etat-osm.json ; aujourdhui = date ISO.
    Renvoie (nouvel état, code de sortie 0/1, message)."""
    import datetime as _dt
    etat = {k: dict(v) for k, v in (etat or {}).items()}
    e = etat.setdefault(robot, {})
    if reussi:
        e["reussi"], e["panne_depuis"] = aujourdhui, None
        return etat, 0, "relevé réussi"
    debut = e.get("panne_depuis") or aujourdhui
    e["panne_depuis"] = debut
    jours = (_dt.date.fromisoformat(aujourdhui) - _dt.date.fromisoformat(debut)).days
    if jours >= PANNE_MAX_JOURS:
        return etat, 1, f"ÉCHEC : OpenStreetMap indisponible depuis le {debut} ({jours} jours) : à réparer"
    return etat, 0, (f"PANNE PASSAGÈRE d'OpenStreetMap (depuis le {debut}) : ancien fichier gardé, nouvel essai au prochain passage "
                     f"(rouge seulement après {PANNE_MAX_JOURS} jours)")


def noter(racine, robot, reussi):
    """Met à jour donnees/etat-osm.json et renvoie le code de sortie du robot (0 = vert)."""
    import datetime as _dt
    chemin = os.path.join(racine, "donnees", "etat-osm.json")
    try:
        with open(chemin, encoding="utf-8") as f:
            etat = json.load(f)
    except (OSError, ValueError):
        etat = {}
    etat, code, message = decider(etat, robot, reussi, _dt.date.today().isoformat())
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    with open(chemin, "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(etat, ensure_ascii=False, indent=1, sort_keys=True) + "\n")
    print(("::error::" if code else "::warning::" if not reussi else "") + message, flush=True)
    return code


def panne_en_cours(racine, robot):
    """Vrai si le dernier essai de ce robot a échoué (un nouvel essai est attendu)."""
    try:
        with open(os.path.join(racine, "donnees", "etat-osm.json"), encoding="utf-8") as f:
            return bool(json.load(f).get(robot, {}).get("panne_depuis"))
    except (OSError, ValueError):
        return False
