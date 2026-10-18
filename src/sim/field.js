import { tangentialWind, pressureAt } from './physics.js';

/**
 * Amostrador rápido do campo de vento.
 *
 * O campo de `windAt` é separável: cada fator depende OU só do raio OU só da
 * altura, nunca dos dois ao mesmo tempo. Escrevendo
 *
 *     v_tangencial(r, z) = VT(r) · decaimento(z)
 *     v_radial(r, z)     = VT(r) · decaimento(z) · RADF(z)
 *     w(r, z)            = WR(r) · perfil(z)
 *
 * dá para pré-calcular duas tabelas 1D — uma em r, outra em z — e trocar
 * todo o `pow`/`exp`/`tan` do laço interno por duas interpolações lineares.
 * Não é uma simplificação da física: é a mesma expressão, fatorada.
 *
 * As tabelas são reconstruídas só quando os parâmetros mudam.
 */

const NR = 4096; // amostras em raio
const NZ = 512;  // amostras em altura

export class WindField {
  constructor(domainRadius, ceiling) {
    this.resize(domainRadius, ceiling);

    // tabela em r
    this.vt = new Float64Array(NR + 1);    // vento tangencial gradiente
    this.wr = new Float64Array(NR + 1);    // parte radial da velocidade vertical
    this.pr = new Float64Array(NR + 1);    // pressão

    // tabela em z
    this.decay = new Float64Array(NZ + 1); // decaimento vertical do vento
    this.radf = new Float64Array(NZ + 1);  // fator radial (inflow / outflow)
    this.tangf = new Float64Array(NZ + 1); // fator tangencial (inverte no topo)
    this.spdf = new Float64Array(NZ + 1);  // módulo do fator horizontal
    this.prof = new Float64Array(NZ + 1);  // perfil vertical da ascensão
    this.tilt = new Float64Array(NZ + 1);  // deslocamento do centro pelo cisalhamento

    this.key = '';
  }

  resize(domainRadius, ceiling) {
    this.rMax = domainRadius * 1.35;
    this.zMax = ceiling;
    this.dr = this.rMax / NR;
    this.dz = this.zMax / NZ;
  }

  /** Reconstrói as tabelas se algum parâmetro relevante mudou. */
  update(p, domainRadius, ceiling) {
    if (domainRadius * 1.35 !== this.rMax || ceiling !== this.zMax) {
      this.resize(domainRadius, ceiling);
      this.key = '';
    }
    const key = `${p.pc}|${p.pn}|${p.rmax}|${p.B}|${p.f}|${p.tropopause}|${p.inflowAngle}|${p.shear}|${p.shearDir}`;
    if (key === this.key) return;
    this.key = key;

    this.sign = p.f >= 0 ? 1 : -1;
    this.shearCos = Math.cos(p.shearDir);
    this.shearSin = Math.sin(p.shearDir);
    this.eyeR = p.rmax * 0.45;

    const wallWidth = p.rmax * 0.55;
    for (let i = 0; i <= NR; i++) {
      const r = Math.max(i * this.dr, 1);
      this.vt[i] = tangentialWind(r, p.pc, p.pn, p.rmax, p.B, p.f);
      const dR = (r - p.rmax) / wallWidth;
      this.wr[i] = 14 * Math.exp(-dR * dR) + 2.2 * Math.exp(-r / (3 * p.rmax));
      this.pr[i] = pressureAt(r, p.pc, p.pn, p.rmax, p.B);
    }

    for (let j = 0; j <= NZ; j++) {
      const z = j * this.dz;
      const frac = Math.min(1, Math.max(0, z / p.tropopause));
      this.decay[j] = z < 1000
        ? 0.75 + (0.25 * z) / 1000
        : Math.exp(-(z - 1000) / (0.55 * p.tropopause));
      const outflow = frac > 0.72 ? (frac - 0.72) / 0.28 : 0;
      const phi = p.inflowAngle * Math.max(0, 1 - frac * 2.2);
      const radf = -Math.tan(phi) * (1 - outflow) + 0.35 * outflow;
      const tangf = 1 - 1.6 * outflow;
      this.radf[j] = radf;
      this.tangf[j] = tangf;
      this.spdf[j] = Math.sqrt(radf * radf + tangf * tangf);
      this.prof[j] = Math.sin(Math.PI * Math.min(1, frac + 0.02));
      this.tilt[j] = p.shear * frac * 8000;
    }
  }

  /**
   * Amostra o campo em (x, y, z) e escreve [vx, vy, vz, speed] em `out`.
   * Sem alocação: `out` é reaproveitado pelo chamador.
   */
  sample(x, y, z, out) {
    // índice em z (as tabelas de z saturam nas pontas)
    let zf = z / this.dz;
    if (zf < 0) zf = 0; else if (zf > NZ) zf = NZ;
    const j = zf | 0;
    const tz = zf - j;
    const j1 = j < NZ ? j + 1 : NZ;

    const tilt = this.tilt[j] + (this.tilt[j1] - this.tilt[j]) * tz;
    const dx = x - this.shearCos * tilt;
    const dy = y - this.shearSin * tilt;

    let r = Math.sqrt(dx * dx + dy * dy);
    if (r < 1) r = 1;

    let rf = r / this.dr;
    if (rf > NR) rf = NR;
    const i = rf | 0;
    const tr = rf - i;
    const i1 = i < NR ? i + 1 : NR;

    const vtR = this.vt[i] + (this.vt[i1] - this.vt[i]) * tr;
    const decay = this.decay[j] + (this.decay[j1] - this.decay[j]) * tz;
    const vt = vtR * decay;

    const radf = this.radf[j] + (this.radf[j1] - this.radf[j]) * tz;
    const tangf = this.tangf[j] + (this.tangf[j1] - this.tangf[j]) * tz;

    const radial = vt * radf;
    const tang = vt * tangf;

    const ux = dx / r;
    const uy = dy / r;
    const s = this.sign;

    let w;
    if (r < this.eyeR) {
      w = -2.5 * (1 - r / this.eyeR); // subsidência dentro do olho
    } else {
      const wr = this.wr[i] + (this.wr[i1] - this.wr[i]) * tr;
      w = wr * (this.prof[j] + (this.prof[j1] - this.prof[j]) * tz);
    }

    out[0] = radial * ux - s * tang * uy;
    out[1] = radial * uy + s * tang * ux;
    out[2] = w;
    out[3] = vt * (this.spdf[j] + (this.spdf[j1] - this.spdf[j]) * tz);
    return out;
  }

  /** Pressão à superfície no raio r, pela tabela. */
  pressure(r) {
    let rf = r / this.dr;
    if (rf < 0) rf = 0; else if (rf > NR) rf = NR;
    const i = rf | 0;
    const i1 = i < NR ? i + 1 : NR;
    return this.pr[i] + (this.pr[i1] - this.pr[i]) * (rf - i);
  }
}
