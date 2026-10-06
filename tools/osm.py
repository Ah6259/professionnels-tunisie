"""Requêtes OpenStreetMap (Overpass) prudentes : plusieurs serveurs, nouvelles tentatives, pause entre les essais.
Données OSM sous licence ODbL : crédit « © les contributeurs d'OpenStreetMap » obligatoire sur le site."""
import json
import time
import urllib.parse
import urllib.request

SERVEURS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter",
            "https://overpass.private.coffee/api/interpreter"]
AGENT = "annuaires-tunisie/1.0 (sites gratuits pour la Tunisie ; robot de nuit)"


def requete(q, essais=6, verifier=None):
    derniere = None
    for i in range(essais):
        url = SERVEURS[i % len(SERVEURS)]
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({"data": q}).encode(),
                                         headers={"User-Agent": AGENT, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=180) as r:
                d = json.loads(r.read().decode("utf-8"))
            remarque = str(d.get("remark", ""))
            if "error" in remarque.lower() or "timed out" in remarque.lower():   # réponse tronquée par le serveur
                raise RuntimeError("réponse incomplète : " + remarque[:120])
            if verifier and not verifier(d):
                raise RuntimeError("réponse incomplète (contrôle du contenu)")
            return d
        except Exception as e:  # 429 / 504 / coupure : on attend puis on change de serveur
            derniere = e
            time.sleep(min(60, 8 * (i + 1)))
    raise RuntimeError(f"Overpass indisponible après {essais} essais : {derniere}")
