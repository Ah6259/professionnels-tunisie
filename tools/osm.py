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
