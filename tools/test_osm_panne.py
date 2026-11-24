"""Test de la règle « panne passagère d'OpenStreetMap » (osm.decider) : vert 2 jours, rouge ensuite, retour au vert après réussite."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import osm as O  # noqa: E402

e, c, _ = O.decider({}, "maj", False, "2026-11-02")
assert c == 0 and e["maj"]["panne_depuis"] == "2026-11-02", "1er jour de panne : vert"
e, c, _ = O.decider(e, "maj", False, "2026-11-03")
assert c == 0 and e["maj"]["panne_depuis"] == "2026-11-02", "2e jour : vert, date de début gardée"
e, c, m = O.decider(e, "maj", False, "2026-11-04")
assert c == 1 and "ÉCHEC" in m, "panne depuis 2 jours : rouge"
e, c, _ = O.decider(e, "maj", True, "2026-11-05")
assert c == 0 and e["maj"]["panne_depuis"] is None and e["maj"]["reussi"] == "2026-11-05", "réussite : panne effacée"
e2, _, _ = O.decider(e, "candidats", False, "2026-11-05")
assert e2["maj"]["panne_depuis"] is None, "chaque robot a son propre état"
# 24/11/2026 : panne DU CÔTÉ des serveurs (502 / 504 / délai) = en sommeil 30 jours, sans rouge ; puis rouge
assert O.de_leur_cote("Overpass trop lent : budget de 20 min dépassé (HTTP Error 502: Bad Gateway)")
assert O.de_leur_cote("HTTP Error 504: Gateway Time-out") and O.de_leur_cote("The read operation timed out")
assert not O.de_leur_cote("HTTP Error 400: Bad Request") and not O.de_leur_cote("réponse incomplète (contrôle du contenu)")
e, c, _ = O.decider({}, "candidats", False, "2026-11-22", True)
e, c, m = O.decider(e, "candidats", False, "2026-11-24", True)
assert c == 0 and "SOMMEIL" in m and e["candidats"]["panne_depuis"] == "2026-11-22", "panne de leur côté, 2 jours : en sommeil, vert"
e, c, m = O.decider(e, "candidats", False, "2026-12-22", True)
assert c == 1 and "ÉCHEC" in m, "panne de leur côté depuis 30 jours : rouge"
e, c, m = O.decider({"candidats": {"panne_depuis": "2026-11-22"}}, "candidats", False, "2026-11-24", False)
assert c == 1, "autre erreur (de notre côté) : toujours rouge après 2 jours"
print("OK : règle de panne passagère d'OpenStreetMap (12 vérifications)")
