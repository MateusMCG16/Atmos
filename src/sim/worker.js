/**
 * Worker de simulação: é dono das partículas e as integra fora da thread
 * principal, para que a advecção nunca engasgue o render.
 *
 * Os buffers de posição e velocidade fazem ping-pong: a thread principal manda
 * dois buffers vazios junto com o pedido, o worker preenche e devolve. Assim
 * não há cópia nem alocação por frame, e o próprio vaivém dos buffers serve de
 * controle de fluxo — enquanto o worker não devolve, ninguém pede mais nada.
 */

import { ParticleField } from './particles.js';
import { WindField } from './field.js';

let pf = null;
let wf = null;
let domainRadius = 0;
let ceiling = 0;

self.onmessage = (e) => {
  const m = e.data;

  switch (m.type) {
    case 'init':
      domainRadius = m.domainRadius;
      ceiling = m.ceiling;
      pf = new ParticleField(m.count, domainRadius, ceiling);
      wf = new WindField(domainRadius, ceiling);
      break;

    case 'reset':
      for (let i = 0; i < pf.count; i++) pf.respawn(i, true);
      break;

    case 'step': {
      domainRadius = m.domainRadius;
      ceiling = m.ceiling;
      pf.resize(m.count);
      pf.domainRadius = domainRadius;
      pf.ceiling = ceiling;
      wf.update(m.field, domainRadius, ceiling);

      for (let s = 0; s < m.steps; s++) pf.step(m.dt, wf);

      // devolve o estado nos buffers que vieram no pedido
      const n = pf.count;
      let { posBuf, speedBuf } = m;
      if (posBuf.length < n * 3) posBuf = new Float32Array(n * 3);
      if (speedBuf.length < n) speedBuf = new Float32Array(n);
      posBuf.set(pf.pos.subarray(0, n * 3));
      speedBuf.set(pf.speed.subarray(0, n));

      self.postMessage(
        { type: 'frame', posBuf, speedBuf, count: n },
        [posBuf.buffer, speedBuf.buffer]
      );
      break;
    }
  }
};
