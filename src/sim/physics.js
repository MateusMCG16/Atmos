/**
 * Núcleo físico do Atmos.
 *
 * Usa o modelo de vento de Holland (1980), que é o perfil paramétrico
 * padrão para ciclones tropicais, acoplado a:
 *   - força de Coriolis dependente da latitude
 *   - balanço de vento gradiente (não só ciclostrófico)
 *   - camada limite com atrito -> ângulo de inflow
 *   - circulação secundária: convergência embaixo, subida na parede do olho,
 *     outflow anticiclônico na tropopausa
 *   - cisalhamento vertical do vento ambiente (inclina o vórtice)
 *
 * Unidades SI: metros, segundos, Pascal, kg/m^3.
 */

export const OMEGA = 7.292115e-5; // rotação da Terra, rad/s
export const RHO_AIR = 1.15;      // densidade do ar na superfície, kg/m^3
export const KM = 1000;

/** Parâmetro de Coriolis f = 2*omega*sin(lat). Negativo no hemisfério sul. */
export function coriolis(latDeg) {
  return 2 * OMEGA * Math.sin((latDeg * Math.PI) / 180);
}

/**
 * Parâmetro de forma B de Holland. Controla o quão "pontudo" é o perfil:
 * B alto = parede do olho estreita e violenta.
 */
export function hollandB(deltaP, rmax, latDeg) {
  // Relação empírica de Vickery & Wadhera: B cai com o raio e com a latitude.
  // O termo de deltaP é calibrado contra a relação pressão-vento de
  // Atkinson-Holliday, que o perfil segue dentro de ~4% de 995 a 900 hPa.
  const b = 1.881 - 0.00557 * (rmax / KM) - 0.01295 * Math.abs(latDeg);
  return Math.min(2.5, Math.max(0.8, b + deltaP / 20000));
}

/**
 * Pressão à superfície no raio r (m), perfil de Holland.
 * pc = pressão central (Pa), pn = pressão ambiente (Pa).
 */
export function pressureAt(r, pc, pn, rmax, B) {
  const x = Math.pow(rmax / Math.max(r, 1), B);
  return pc + (pn - pc) * Math.exp(-x);
}

/**
 * Velocidade tangencial do vento gradiente no raio r.
 * Resolve o balanço gradiente: V^2/r + fV = (1/rho) dp/dr
 */
export function tangentialWind(r, pc, pn, rmax, B, f) {
  const rr = Math.max(r, 1);
  const x = Math.pow(rmax / rr, B);
  const dP = pn - pc;
  // termo ciclostrófico de Holland
  const cyclo = (B * dP * x * Math.exp(-x)) / RHO_AIR;
  const fr = (Math.abs(f) * rr) / 2;
  // raiz do balanço gradiente (descarta a raiz anticiclônica)
  return Math.sqrt(Math.max(0, cyclo + fr * fr)) - fr;
}

/**
 * Fator de redução do vento gradiente para o vento sustentado a 10 m.
 * O atrito da camada limite tira cerca de 20% — é o número que a
 * escala Saffir-Simpson usa.
 */
export const SURFACE_FACTOR = 0.8;

/** Vento gradiente máximo do sistema (no raio de vento máximo). */
export function peakWind(pc, pn, rmax, B, f) {
  let best = 0;
  for (let i = 1; i <= 60; i++) {
    const r = (rmax * i) / 20;
    const v = tangentialWind(r, pc, pn, rmax, B, f);
    if (v > best) best = v;
  }
  return best;
}

/** Categoria Saffir-Simpson a partir do vento em m/s. */
export function saffirSimpson(ms) {
  if (ms < 17.5) return { cat: 'TD', label: 'Depressão tropical' };
  if (ms < 33) return { cat: 'TS', label: 'Tempestade tropical' };
  if (ms < 43) return { cat: '1', label: 'Categoria 1' };
  if (ms < 50) return { cat: '2', label: 'Categoria 2' };
  if (ms < 58) return { cat: '3', label: 'Categoria 3' };
  if (ms < 70) return { cat: '4', label: 'Categoria 4' };
  return { cat: '5', label: 'Categoria 5' };
}

/**
 * Potencial máximo de intensidade (Emanuel). Liga a temperatura da
 * superfície do mar ao vento máximo que o sistema consegue sustentar.
 * sst em °C, retorna m/s.
 */
export function potentialIntensity(sstC, outflowTempC = -70) {
  const ts = sstC + 273.15;
  const to = outflowTempC + 273.15;
  if (ts <= to) return 0;
  const ck_cd = 0.9;            // razão entre coef. de entalpia e de arrasto
  const efficiency = (ts - to) / to;
  // deltaK: disequilíbrio de entalpia ar-mar. A constante está calibrada para
  // reproduzir os valores observados: ~50 m/s a 26 °C, ~72 m/s a 29 °C.
  const deltaK = 5700 * Math.exp(0.21 * (sstC - 26));
  return Math.sqrt(Math.max(0, ck_cd * efficiency * deltaK));
}

/**
 * Campo de vento 3D no ponto (x, y, z) em metros, com o olho na origem.
 * z é altura. Retorna velocidade em m/s.
 */
export function windAt(x, y, z, p) {
  const { pc, pn, rmax, B, f, tropopause, inflowAngle, shear, shearDir } = p;

  // o vórtice inclina com o cisalhamento: desloca o centro conforme a altura
  const frac = Math.min(1, Math.max(0, z / tropopause));
  const tilt = shear * frac * 8000;
  const cx = Math.cos(shearDir) * tilt;
  const cy = Math.sin(shearDir) * tilt;
  const dx = x - cx;
  const dy = y - cy;

  const r = Math.hypot(dx, dy) || 1;
  const ux = dx / r;  // unitário radial
  const uy = dy / r;
  const sign = f >= 0 ? 1 : -1; // ciclônico: anti-horário no norte

  // o vento enfraquece com a altura acima da camada de vento máximo (~1 km)
  const vertDecay = z < 1000 ? 0.75 + (0.25 * z) / 1000 : Math.exp(-(z - 1000) / (0.55 * tropopause));
  const vt = tangentialWind(r, pc, pn, rmax, B, f) * vertDecay;

  // ângulo de inflow: máximo na superfície, zera na altura de saída
  const inflowFrac = Math.max(0, 1 - frac * 2.2);
  const phi = inflowAngle * inflowFrac;

  // acima do nível de equilíbrio a circulação vira outflow anticiclônico
  const outflow = frac > 0.72 ? (frac - 0.72) / 0.28 : 0;
  const radial = -vt * Math.tan(phi) * (1 - outflow) + outflow * 0.35 * vt;

  // tangencial: ciclônico embaixo, invertendo para anticiclônico no topo
  const tang = vt * (1 - 1.6 * outflow);

  // componente vertical da circulação secundária:
  //  - pico estreito e forte na parede do olho
  //  - ramo ascendente largo e fraco sobre todo o núcleo interno, que é por
  //    onde a convergência da camada limite força a subida
  //  - subsidência dentro do olho
  const profile = Math.sin(Math.PI * Math.min(1, frac + 0.02));
  const wallWidth = rmax * 0.55;
  const dR = (r - rmax) / wallWidth;
  const wall = 14 * Math.exp(-dR * dR);
  const broad = 2.2 * Math.exp(-r / (3 * rmax));
  let w = (wall + broad) * profile;
  if (r < rmax * 0.45) w = -2.5 * (1 - r / (rmax * 0.45)); // subsidência no olho

  return {
    vx: radial * ux - sign * tang * uy,
    vy: radial * uy + sign * tang * ux,
    vz: w,
    r,
    speed: Math.hypot(radial, tang),
    pressure: pressureAt(r, pc, pn, rmax, B),
  };
}

/** Monta o pacote de parâmetros derivados que windAt consome. */
export function buildField(state) {
  const pc = state.centralPressure * 100;  // hPa -> Pa
  const pn = state.ambientPressure * 100;
  const rmax = state.rmax * KM;
  const f = coriolis(state.latitude);
  const B = state.autoB ? hollandB(pn - pc, rmax, state.latitude) : state.B;
  return {
    pc, pn, rmax, B, f,
    tropopause: state.tropopause * KM,
    inflowAngle: (state.inflowAngle * Math.PI) / 180,
    shear: state.shear,
    shearDir: (state.shearDir * Math.PI) / 180,
  };
}
