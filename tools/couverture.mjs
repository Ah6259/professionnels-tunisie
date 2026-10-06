// Tableau métier × gouvernorat : nombre de fiches publiées (objectif : au moins 3 partout).
//   node tools/couverture.mjs          (après node tools/construire.mjs)
import { FICHES, GOUVERNORATS } from "./construire.mjs";
import { readFileSync } from "fs";
const C = JSON.parse(readFileSync(new URL("../config.json", import.meta.url), "utf8"));
let total = 0;
for (const m of C.metiers) {
  const n = GOUVERNORATS.map(g => FICHES.filter(f => f.metier === m.id && f.gouvernorat === g[0]).length);
  const ok = n.filter(x => x >= 3).length; total += ok;
  console.log(`${m.id.padEnd(22)} ${String(ok).padStart(2)}/24  ${n.join(" ")}`);
}
console.log(`cases à 3 fiches ou plus : ${total}/${C.metiers.length * 24} — ${FICHES.length} fiches`);
