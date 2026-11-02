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
print("OK : règle de panne passagère d'OpenStreetMap (5 vérifications)")
