import { ParticleField } from './particles.js';
import { WindField } from './field.js';

/**
 * Fachada da simulação para a thread principal.
 *
 * Expõe `pos`, `speed` e `count` como se fosse o ParticleField, para a cena
 * não precisar saber se o trabalho acontece num worker ou aqui mesmo.
 *
 * Com worker, o estado desenhado é o do pedido anterior — um frame de atraso,
 * invisível a 60 fps, em troca de a thread principal nunca ficar bloqueada.
 */
export class SimClient {
  constructor(count, domainRadius, ceiling) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.speed = new Float32Array(count);
    this.busy = false;

    // buffers livres para mandar ao worker
    this.freePos = new Float32Array(count * 3);
    this.freeSpeed = new Float32Array(count);

    try {
      this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => this._onFrame(e.data);
      this.worker.postMessage({ type: 'init', count, domainRadius, ceiling });
    } catch (err) {
      // sem worker (navegador antigo, contexto restrito): roda local
      console.warn('Worker indisponível, simulando na thread principal:', err);
      this.worker = null;
      this.local = new ParticleField(count, domainRadius, ceiling);
      this.localField = new WindField(domainRadius, ceiling);
    }
  }

  _onFrame(m) {
    if (m.type !== 'frame') return;
    // o que veio do worker vira o estado desenhado; o antigo volta a ser livre
    const oldPos = this.pos;
    const oldSpeed = this.speed;
    this.pos = m.posBuf;
    this.speed = m.speedBuf;
    this.count = m.count;
    this.freePos = oldPos;
    this.freeSpeed = oldSpeed;
    this.busy = false;
  }

  /**
   * Pede `steps` passos de `dt` segundos. Se o worker ainda está ocupado,
   * o pedido é descartado — a simulação acompanha o que a máquina aguenta
   * em vez de acumular uma fila.
   * Devolve true se o pedido foi realmente enviado.
   */
  step(dt, steps, field, count, domainRadius, ceiling) {
    if (steps <= 0) return false;

    if (!this.worker) {
      this.local.resize(count);
      this.local.domainRadius = domainRadius;
      this.local.ceiling = ceiling;
      this.localField.update(field, domainRadius, ceiling);
      for (let s = 0; s < steps; s++) this.local.step(dt, this.localField);
      this.pos = this.local.pos;
      this.speed = this.local.speed;
      this.count = this.local.count;
      return true;
    }

    if (this.busy) return false;

    // os buffers precisam caber a contagem pedida
    if (this.freePos.length < count * 3) this.freePos = new Float32Array(count * 3);
    if (this.freeSpeed.length < count) this.freeSpeed = new Float32Array(count);

    const posBuf = this.freePos;
    const speedBuf = this.freeSpeed;
    this.freePos = null;
    this.freeSpeed = null;
    this.busy = true;

    this.worker.postMessage(
      { type: 'step', dt, steps, field, count, domainRadius, ceiling, posBuf, speedBuf },
      [posBuf.buffer, speedBuf.buffer]
    );
    return true;
  }

  reset() {
    if (this.worker) this.worker.postMessage({ type: 'reset' });
    else for (let i = 0; i < this.local.count; i++) this.local.respawn(i, true);
  }

  dispose() {
    if (this.worker) this.worker.terminate();
  }
}
