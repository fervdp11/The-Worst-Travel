import { getMap } from '../src/shared/maps';
import { validateMap } from '../src/shared/maps/validate';

let fail = false;
for (const id of ['train', 'ship', 'plane', 'lobby'] as const) {
  const t0 = Date.now();
  const rep = validateMap(getMap(id));
  console.log(`${id}: ${rep.ok ? 'OK' : 'ERRORES'} (${rep.reachableCells} celdas, ${Date.now() - t0} ms)`);
  for (const e of rep.errors) console.log('  - ' + e);
  if (!rep.ok) fail = true;
}
process.exit(fail ? 1 : 0);
