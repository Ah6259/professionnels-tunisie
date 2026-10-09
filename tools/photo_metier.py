"""Vraie photo d'un MÉTIER (règle d'Ahmed : une photo Wikimedia Commons par métier, crédit sur À propos).
Utilisé à la main ET par le robot « un nouveau métier par jour ».
  Chercher :  python tools/photo_metier.py chercher "architect drawing" [n]
  Ajouter  :  python tools/photo_metier.py ajouter <id-metier> "File:Nom.jpg" "texte alternatif FR" "texte alternatif AR"
Ajouter : vérifie la licence (CC0, CC BY, CC BY-SA, domaine public), recadre en 4:3, enregistre
assets/metiers-photos/<id>.webp (600 × 450, ≤ 120 Ko), garde la preuve de licence dans donnees/preuves-photos/<id>.json
et écrit le bloc « photo » du métier dans config.json. Wikimedia limite le nombre de demandes : on patiente et on réessaie."""
import datetime, io, json, pathlib, re, sys, time, urllib.parse, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
RACINE = pathlib.Path(__file__).resolve().parent.parent
UA = {"User-Agent": "annuaires-tunisie/1.0 (https://ah6259.github.io/professionnels-tunisie/)"}
API = "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|extmetadata"


def lire(url, essais=5):
    for i in range(essais):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504) or i == essais - 1: raise
            time.sleep(int(e.headers.get("Retry-After") or 0) or 20 * (i + 1))


def meta(ii):
    m = ii.get("extmetadata", {})
    val = lambda k: re.sub(r"<[^>]+>", "", m.get(k, {}).get("value", "")).strip()
    return val("LicenseShortName"), m.get("LicenseUrl", {}).get("value", ""), val("Artist") or "auteur inconnu"


def libre(licence): return bool(re.search(r"CC0|CC BY|Public domain|Domaine public", licence, re.I)) and not re.search(r"NC|ND", licence)


def chercher(q, n=15):
    url = API + "&iiurlwidth=600&generator=search&gsrnamespace=6&gsrlimit=%d&gsrsearch=%s" % (n, urllib.parse.quote(q + " filetype:bitmap"))
    for p in (json.loads(lire(url)).get("query", {}).get("pages", {}) or {}).values():
        ii = p["imageinfo"][0]; licence, _, auteur = meta(ii)
        if libre(licence) and ii["width"] >= 800:
            print(f"{p['title']} | {ii['width']}x{ii['height']} | {licence} | {auteur[:40]} | {ii['thumburl']}")


def ajouter(mid, titre, alt_fr, alt_ar):
    cfg_f = RACINE / "config.json"; cfg = json.loads(cfg_f.read_text(encoding="utf-8"))
    m = next((x for x in cfg["metiers"] if x["id"] == mid), None)
    if not m: sys.exit("métier inconnu dans config.json : " + mid)
    brut = lire(API + "&iiurlwidth=1200&titles=" + urllib.parse.quote(titre))
    p = next(iter(json.loads(brut)["query"]["pages"].values())); ii = p["imageinfo"][0]
    licence, licence_url, auteur = meta(ii)
    if not libre(licence): sys.exit("licence non libre : " + licence)
    if not licence_url: licence_url = "https://creativecommons.org/publicdomain/zero/1.0/" if "CC0" in licence else ii["descriptionurl"]
    from PIL import Image
    im = Image.open(io.BytesIO(lire(ii["thumburl"]))).convert("RGB")
    w, h = im.size; cible = 4 / 3
    if w / h > cible: nw = int(h * cible); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else: nh = int(w / cible); im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    im = im.resize((600, 450), Image.LANCZOS)
    dest = RACINE / "assets" / "metiers-photos" / (mid + ".webp"); dest.parent.mkdir(parents=True, exist_ok=True)
    for q in (80, 72, 64, 56):
        im.save(dest, quality=q, method=6)
        if dest.stat().st_size <= 120_000: break
    preuve = RACINE / "donnees" / "preuves-photos" / (mid + ".json"); preuve.parent.mkdir(parents=True, exist_ok=True)
    preuve.write_text(json.dumps({"date": datetime.date.today().isoformat(), "titre": titre, "page": ii["descriptionurl"],
                                  "reponse_api": json.loads(brut)}, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")
    photo = {"fichier": "assets/metiers-photos/%s.webp" % mid, "largeur": 600, "hauteur": 450,
             "alt": {"fr": alt_fr, "ar": alt_ar}, "auteur": auteur, "licence": licence, "licence_url": licence_url,
             "source": "https://commons.wikimedia.org/w/index.php?curid=%s" % p["pageid"]}
    # insertion ciblée (le reste de config.json garde sa mise en forme) : à la fin de l'objet du métier
    texte = cfg_f.read_text(encoding="utf-8")
    debut = re.search(r'\n(\s*)\{\s*\n\s*"id": "%s",' % re.escape(mid), texte)
    if not debut: sys.exit("métier introuvable dans le texte de config.json : " + mid)
    retrait = debut.group(1)
    fin = texte.index("\n" + retrait + "}", debut.end())
    objet = json.loads("{" + texte[debut.start():fin].split("{", 1)[1] + "}")
    if "photo" in objet:  # remplacer une photo existante : on repart de l'objet relu
        objet["photo"] = photo
        bloc = json.dumps(objet, ensure_ascii=False, indent=2).replace("\n", "\n" + retrait)
        texte = texte[:debut.start()] + "\n" + retrait + bloc + texte[fin + len("\n" + retrait + "}"):]
    else:
        ajout = ',\n' + retrait + '  "photo": ' + json.dumps(photo, ensure_ascii=False, indent=2).replace("\n", "\n" + retrait + "  ")
        texte = texte[:fin] + ajout + texte[fin:]
    json.loads(texte)  # toujours un JSON valide
    cfg_f.write_text(texte, encoding="utf-8", newline="\n")
    print(f"{mid} : {dest.stat().st_size // 1024} Ko, {licence}, {auteur}")


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "chercher": chercher(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 15)
    elif len(sys.argv) == 6 and sys.argv[1] == "ajouter": ajouter(*sys.argv[2:])
    else: sys.exit(__doc__)
