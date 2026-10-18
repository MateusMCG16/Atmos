/**
 * Sistema de partículas lagrangeano: cada partícula é um traçador de ar
 * advectado pelo campo de vento, com reciclagem quando sai do domínio.
 */
export class ParticleField {
  constructor(count, domainRadius, ceiling) {
    this.count = count;
    this.domainRadius = domainRadius;
    this.ceiling = ceiling;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.age = new Float32Array(count);
    this.life = new Float32Array(count);
    this.speed = new Float32Array(count);
    this._w = new Float64Array(4); // buffer de saída reaproveitado
    for (let i = 0; i < count; i++) this.respawn(i, true);
  }

  respawn(i, initial = false) {
    const i3 = i * 3;
    // nasce preferencialmente na periferia e perto da superfície,
    // que é por onde o ar realmente entra no sistema
    // distribuição pesada para o núcleo: semear uniforme na área joga quase
    // tudo na periferia, onde o campo é lento e nada acontece
    const u = Math.random();
    const r = this.domainRadius * (0.04 + 0.96 * Math.pow(u, 1.25));
    const th = Math.random() * Math.PI * 2;
    this.pos[i3] = Math.cos(th) * r;
    this.pos[i3 + 1] = Math.sin(th) * r;
    this.pos[i3 + 2] = initial
      ? Math.random() * this.ceiling
      : Math.random() * this.ceiling * 0.12;
    this.vel[i3] = this.vel[i3 + 1] = this.vel[i3 + 2] = 0;
    this.age[i] = 0;
    // horas de tempo simulado: uma parcela de ar leva horas para percorrer
    // o conveyor inflow -> parede do olho -> outflow
    this.life[i] = 3600 + Math.random() * 10800;
  }

  /**
   * Integra dt segundos de tempo simulado.
   * `wf` é um WindField já atualizado com os parâmetros atuais.
   */
  step(dt, wf) {
    const { pos, vel, count, speed, age } = this;
    const maxR = this.domainRadius * 1.25;
    const w = this._w;
    // relaxação para o campo: inércia da parcela de ar. Não depende da
    // partícula, então sai do laço.
    const k = 1 - Math.exp(-dt / 25);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      wf.sample(pos[i3], pos[i3 + 1], pos[i3 + 2], w);
      vel[i3] += (w[0] - vel[i3]) * k;
      vel[i3 + 1] += (w[1] - vel[i3 + 1]) * k;
      vel[i3 + 2] += (w[2] - vel[i3 + 2]) * k;
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;
      speed[i] = w[3];
      age[i] += dt;

      // o topo e a superfície são tampas, não sumidouros: a parcela que sobe
      // até a tropopausa espalha lateralmente como outflow, e isso precisa
      // ficar visível
      if (pos[i3 + 2] > this.ceiling) { pos[i3 + 2] = this.ceiling; vel[i3 + 2] = 0; }
      if (pos[i3 + 2] < 0) { pos[i3 + 2] = 0; vel[i3 + 2] = 0; }

      const rr = Math.hypot(pos[i3], pos[i3 + 1]);
      if (age[i] > this.life[i] || rr > maxR) this.respawn(i);
    }
  }

  resize(count) {
    if (count === this.count) return;
    const old = this;
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.age = new Float32Array(count);
    this.life = new Float32Array(count);
    this.speed = new Float32Array(count);
    const keep = Math.min(count, old.pos.length / 3);
    this.pos.set(old.pos.subarray(0, keep * 3));
    this.vel.set(old.vel.subarray(0, keep * 3));
    this.age.set(old.age.subarray(0, keep));
    this.life.set(old.life.subarray(0, keep));
    for (let i = keep; i < count; i++) this.respawn(i, true);
  }
}
