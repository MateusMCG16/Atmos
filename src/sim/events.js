/**
 * Eventos: roteiros que fazem os parâmetros do ciclone evoluírem ao longo do
 * tempo SIMULADO (não do tempo de relógio), passando por fases nomeadas.
 *
 * Cada evento é uma lista de keyframes ordenados por hora simulada. Entre dois
 * keyframes os parâmetros são interpolados com suavização, então a tempestade
 * se intensifica ou morre de forma contínua em vez de pular.
 *
 * As escalas de tempo são as observadas: intensificação rápida é definida como
 * ganhar 30 kt em 24 h, um ciclo de substituição da parede do olho leva de 12 a
 * 36 h, e o colapso depois do landfall é questão de horas.
 */

const smooth = (t) => t * t * (3 - 2 * t); // suavização nas pontas

/** Parâmetros que um evento pode dirigir. O resto continua com o usuário. */
export const DRIVEN = [
  'centralPressure', 'rmax', 'latitude', 'sst', 'shear', 'shearDir', 'inflowAngle',
];

export const EVENTS = [
  {
    id: 'ri',
    name: 'Intensificação rápida',
    blurb: 'Uma depressão desorganizada vira grande furacão em pouco mais de um dia: a pressão despenca e o olho se contrai.',
    timeScale: 900,
    keys: [
      { h: 0, phase: 'Depressão desorganizada', p: { centralPressure: 1000, rmax: 70, sst: 30, shear: 0.35, latitude: 14, inflowAngle: 26 } },
      { h: 8, phase: 'O olho se fecha', p: { centralPressure: 985, rmax: 50, sst: 30, shear: 0.12, latitude: 15, inflowAngle: 24 } },
      { h: 20, phase: 'Intensificação rápida', p: { centralPressure: 945, rmax: 32, sst: 30, shear: 0.04, latitude: 16, inflowAngle: 22 } },
      { h: 32, phase: 'Pico de intensidade', p: { centralPressure: 912, rmax: 20, sst: 30, shear: 0.02, latitude: 17, inflowAngle: 21 } },
      { h: 40, phase: 'Maduro e estável', p: { centralPressure: 918, rmax: 24, sst: 29.5, shear: 0.06, latitude: 18, inflowAngle: 22 } },
    ],
  },
  {
    id: 'erc',
    name: 'Substituição da parede do olho',
    blurb: 'Uma parede externa se forma, estrangula a interna e toma o lugar dela. O furacão enfraquece e volta — mais largo.',
    timeScale: 700,
    keys: [
      { h: 0, phase: 'Parede interna compacta', p: { centralPressure: 918, rmax: 17, sst: 30, shear: 0.03, latitude: 19, inflowAngle: 21 } },
      { h: 6, phase: 'Parede externa se forma', p: { centralPressure: 924, rmax: 26, sst: 30, shear: 0.05, latitude: 20, inflowAngle: 22 } },
      { h: 14, phase: 'Parede interna estrangulada', p: { centralPressure: 944, rmax: 52, sst: 30, shear: 0.06, latitude: 21, inflowAngle: 24 } },
      { h: 24, phase: 'Nova parede se contrai', p: { centralPressure: 930, rmax: 38, sst: 30, shear: 0.04, latitude: 22, inflowAngle: 22 } },
      { h: 34, phase: 'Reintensificado, mais largo', p: { centralPressure: 921, rmax: 33, sst: 29.5, shear: 0.04, latitude: 23, inflowAngle: 22 } },
    ],
  },
  {
    id: 'shear',
    name: 'Cisalhamento destrutivo',
    blurb: 'O sistema entra numa região de cisalhamento forte: o vórtice inclina, desacopla em altura e se desfaz.',
    timeScale: 800,
    keys: [
      { h: 0, phase: 'Furacão saudável', p: { centralPressure: 940, rmax: 33, sst: 29, shear: 0.02, shearDir: 240, latitude: 24, inflowAngle: 22 } },
      { h: 10, phase: 'O cisalhamento aumenta', p: { centralPressure: 948, rmax: 40, sst: 28.5, shear: 0.35, shearDir: 240, latitude: 26, inflowAngle: 24 } },
      { h: 22, phase: 'Vórtice inclinado', p: { centralPressure: 968, rmax: 58, sst: 27.5, shear: 0.68, shearDir: 240, latitude: 28, inflowAngle: 28 } },
      { h: 34, phase: 'Convecção deslocada do centro', p: { centralPressure: 990, rmax: 85, sst: 27, shear: 0.88, shearDir: 240, latitude: 30, inflowAngle: 32 } },
      { h: 44, phase: 'Remanescente aberto', p: { centralPressure: 1003, rmax: 120, sst: 26.5, shear: 0.95, shearDir: 240, latitude: 32, inflowAngle: 35 } },
    ],
  },
  {
    id: 'landfall',
    name: 'Landfall',
    blurb: 'O ciclone toca a costa: perde a fonte de calor do oceano e ganha o atrito do terreno. Colapsa em menos de um dia.',
    timeScale: 600,
    keys: [
      { h: 0, phase: 'Aproximação da costa', p: { centralPressure: 942, rmax: 30, sst: 29, shear: 0.08, latitude: 27, inflowAngle: 22 } },
      { h: 5, phase: 'Parede do olho em terra', p: { centralPressure: 948, rmax: 34, sst: 27, shear: 0.12, latitude: 28, inflowAngle: 30 } },
      { h: 12, phase: 'Centro sobre o continente', p: { centralPressure: 972, rmax: 52, sst: 24, shear: 0.2, latitude: 29, inflowAngle: 38 } },
      { h: 22, phase: 'Enfraquecimento rápido', p: { centralPressure: 994, rmax: 80, sst: 22, shear: 0.3, latitude: 31, inflowAngle: 42 } },
      { h: 32, phase: 'Baixa remanescente', p: { centralPressure: 1006, rmax: 110, sst: 21, shear: 0.35, latitude: 32, inflowAngle: 44 } },
    ],
  },
  {
    id: 'extratropical',
    name: 'Transição extratropical',
    blurb: 'Migrando para latitudes altas, o núcleo quente e compacto vira um ciclone frio, enorme e assimétrico.',
    timeScale: 1000,
    keys: [
      { h: 0, phase: 'Furacão tropical', p: { centralPressure: 948, rmax: 35, sst: 28, shear: 0.08, latitude: 28, inflowAngle: 22 } },
      { h: 14, phase: 'Sai da água quente', p: { centralPressure: 955, rmax: 55, sst: 24, shear: 0.25, latitude: 34, inflowAngle: 26 } },
      { h: 28, phase: 'Campo de vento se expande', p: { centralPressure: 962, rmax: 95, sst: 20, shear: 0.42, latitude: 40, inflowAngle: 30 } },
      { h: 42, phase: 'Núcleo frio assimétrico', p: { centralPressure: 968, rmax: 155, sst: 16, shear: 0.55, latitude: 46, inflowAngle: 34 } },
      { h: 54, phase: 'Ciclone extratropical', p: { centralPressure: 972, rmax: 200, sst: 14, shear: 0.6, latitude: 50, inflowAngle: 36 } },
    ],
  },
  {
    id: 'upwelling',
    name: 'Ressurgência de água fria',
    blurb: 'A própria tempestade revolve o oceano e traz água fria à superfície, cortando o combustível que a alimenta.',
    timeScale: 800,
    keys: [
      { h: 0, phase: 'Sobre água quente', p: { centralPressure: 932, rmax: 26, sst: 30.5, shear: 0.05, latitude: 20, inflowAngle: 21 } },
      { h: 12, phase: 'A esteira fria se abre', p: { centralPressure: 940, rmax: 32, sst: 28, shear: 0.08, latitude: 21, inflowAngle: 23 } },
      { h: 26, phase: 'Combustível cortado', p: { centralPressure: 962, rmax: 45, sst: 25.5, shear: 0.12, latitude: 22, inflowAngle: 26 } },
      { h: 38, phase: 'Enfraquecido', p: { centralPressure: 980, rmax: 60, sst: 24.5, shear: 0.15, latitude: 23, inflowAngle: 28 } },
    ],
  },
];

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

/** Duração total do evento, em horas simuladas. */
export const eventDuration = (ev) => ev.keys[ev.keys.length - 1].h;

/**
 * Amostra o evento no instante `hours` (horas simuladas desde o disparo).
 * Devolve os parâmetros interpolados, a fase atual e o progresso 0..1.
 */
export function sampleEvent(ev, hours) {
  const keys = ev.keys;
  const total = eventDuration(ev);
  const t = Math.max(0, Math.min(total, hours));

  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].h) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const span = b.h - a.h;
  const u = span > 0 ? smooth((t - a.h) / span) : 0;

  const p = {};
  for (const k of DRIVEN) {
    if (a.p[k] === undefined) continue;
    const bv = b.p[k] === undefined ? a.p[k] : b.p[k];
    p[k] = a.p[k] + (bv - a.p[k]) * u;
  }
  // a fase passa a ser a do próximo keyframe depois da metade do trecho
  const phase = u > 0.5 ? b.phase : a.phase;
  return { params: p, phase, progress: total > 0 ? t / total : 1, done: hours >= total };
}

/** Estado no instante do disparo. */
export const eventStart = (ev) => ({ ...ev.keys[0].p });
