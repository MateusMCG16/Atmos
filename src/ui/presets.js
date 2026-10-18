/** Cenários iniciais. Valores soltos de casos reais, não reconstruções exatas. */
export const DEFAULTS = {
  centralPressure: 938,   // hPa
  ambientPressure: 1013,  // hPa
  rmax: 30,               // km, raio de vento máximo
  latitude: 20,           // graus (negativo = hemisfério sul)
  sst: 29,                // °C
  tropopause: 15,         // km
  inflowAngle: 22,        // graus de inflow na superfície
  shear: 0.0,             // cisalhamento vertical normalizado (0-1)
  shearDir: 0,            // graus
  B: 1.4,
  autoB: true,
  particles: 30000,
  timeScale: 120,          // segundos simulados por segundo real
  domainRadius: 400,      // km
};

export const PRESETS = {
  'Tempestade tropical': { centralPressure: 995, rmax: 60, latitude: 15, sst: 28, shear: 0.2 },
  'Furacão cat. 3': { centralPressure: 938, rmax: 30, latitude: 20, sst: 29, shear: 0.05 },
  'Furacão cat. 5 compacto': { centralPressure: 885, rmax: 15, latitude: 18, sst: 31, shear: 0 },
  'Ciclone do hemisfério sul': { centralPressure: 940, rmax: 40, latitude: -22, sst: 29, shear: 0.1 },
  'Cisalhado / morrendo': { centralPressure: 985, rmax: 70, latitude: 28, sst: 26, shear: 0.75 },
  'Ciclone extratropical': { centralPressure: 975, rmax: 180, latitude: 45, sst: 18, shear: 0.4 },
};
