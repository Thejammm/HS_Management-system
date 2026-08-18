// Deterministic fixture generator — writes the three report fixtures into
// public/reports/fixtures/ (demo data only; no client data in source).
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const out = path.join(here, '..', '..', 'public', 'reports', 'fixtures');

const CATS = ['Physical', 'Chemical', 'Fire', 'Electrical', 'Ergonomic', 'Psychosocial', 'Legal / Regulatory', 'Environmental'];
const LEVELS = ['remove', 'prevent', 'protect', 'ppe', 'admin'];
const OWNERS = ['A Steel', 'B Mason', 'C Wright'];

function mkRisk(i, opts = {}) {
  const sev = opts.sev != null ? opts.sev : (i % 5) + 1;
  const lik = opts.lik != null ? opts.lik : ((i * 2) % 5) + 1;
  return {
    id: 'fx_' + i,
    category: CATS[i % CATS.length],
    activity: 'Fixture activity ' + (i + 1),
    hazard: 'Fixture hazard ' + (i + 1),
    personsAtRisk: ['Employees'],
    controls: opts.noControls ? '' : 'Documented control set ' + (i + 1),
    controlLevel: opts.noControls ? '' : LEVELS[i % LEVELS.length],
    sif: sev === 5 ? 'yes' : '',
    inherentL: String(Math.min(5, lik + 1)), inherentS: String(sev),
    likelihood: opts.unrated ? '' : String(lik),
    severity: opts.unrated ? '' : String(sev),
    duty: i % 3 === 0 ? 'HSWA 1974; MHSWR 1999' : 'MHSWR 1999',
    trend: 'Stable',
    actions: opts.noActions ? [] : [{
      id: 'fxa_' + i, desc: 'Fixture action ' + (i + 1),
      owner: i % 4 === 3 ? '' : OWNERS[i % OWNERS.length],
      due: i % 5 === 0 ? '2026-07-01' : (i % 5 === 1 ? '' : '2026-12-01'),
      status: i % 6 === 0 ? 'Complete' : 'Not started', priority: '',
    }],
    linked: [],
  };
}

function maturity(vals) {
  // item ids across the six domain prefixes the report groups by
  const m = {};
  ['l_a', 'l_b'].forEach((k, i) => m[k] = vals[0]);
  ['c_a', 'c_b'].forEach(k => m[k] = vals[1]);
  ['oh_a', 'oh_b'].forEach(k => m[k] = vals[2]);
  ['op_a', 'op_b'].forEach(k => m[k] = vals[3]);
  ['a_a', 'a_b'].forEach(k => m[k] = vals[4]);
  ['r_a', 'r_b'].forEach(k => m[k] = vals[5]);
  return m;
}

const base = {
  company: { legalName: 'Fixture Fabrications Ltd', tradingName: 'Fixture Fabrications', employees: '24',
    personnel: [{ name: 'G Fixture', role: 'Managing Director' }] },
  riskConfig: { bands: { med: 5, high: 10, crit: 16 } },
};

const empty = { ...base, riskProfile: [mkRisk(0, { unrated: true }), mkRisk(1, { unrated: true })], profiler: { maturity: {} } };

const typical = { ...base,
  riskProfile: Array.from({ length: 16 }, (_, i) => mkRisk(i, i < 6 ? { sev: 5 } : i < 10 ? { sev: 4 } : {})),
  profiler: { maturity: maturity([3, 1, 2, 2, 2.5, 3]) },
};

const oversized = { ...base,
  riskProfile: Array.from({ length: 45 }, (_, i) => mkRisk(i, i < 18 ? { sev: 5, noControls: i < 3 } : i < 32 ? { sev: 4 } : {})),
  profiler: { maturity: maturity([2, 1, 1.5, 2, 2, 2.5]) },
};

fs.mkdirSync(out, { recursive: true });
for (const [name, data] of [['empty', empty], ['typical', typical], ['oversized', oversized]]) {
  fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(data, null, 1));
}
console.log('fixtures written to', out);
