import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createScene } from './sim/scene.js';
import { SimClient } from './sim/simClient.js';
import {
  buildField, peakWind, saffirSimpson, potentialIntensity, coriolis, SURFACE_FACTOR,
} from './sim/physics.js';
import { sampleEvent, eventStart, eventDuration } from './sim/events.js';
import Controls from './ui/Controls.jsx';
import Hud from './ui/Hud.jsx';
import { DEFAULTS } from './ui/presets.js';

const KM = 1000;

export default function App() {
  const [state, setState] = useState(DEFAULTS);
  const [running, setRunning] = useState(true);
  const [fps, setFps] = useState(0);
  const [simTime, setSimTime] = useState(0);
  // espelho do evento em curso, só para a interface
  const [eventView, setEventView] = useState(null);

  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const fieldRef = useRef(null);
  const stateRef = useRef(state);
  const spinupRef = useRef(0);
  const runRef = useRef(running);
  const simRef = useRef(0);      // tempo simulado acumulado, em segundos
  const eventRef = useRef(null); // { ev, startSec }
  stateRef.current = state;
  runRef.current = running;

  const set = (patch) => setState((s) => ({ ...s, ...patch }));

  /** Dispara um evento: salta para o estado inicial e passa a dirigir os parâmetros. */
  const startEvent = (ev) => {
    eventRef.current = { ev, startSec: simRef.current };
    set({ ...eventStart(ev), timeScale: ev.timeScale });
    spinupRef.current = 3 * 3600; // deixa a nova configuração se organizar
    setRunning(true);
    setEventView({
      id: ev.id, name: ev.name, phase: ev.keys[0].phase,
      progress: 0, hours: 0, total: eventDuration(ev), done: false,
    });
  };

  /** Encerra o evento, congelando os parâmetros onde estiverem. */
  const stopEvent = () => {
    eventRef.current = null;
    setEventView(null);
  };

  // monta cena e partículas uma vez; o loop lê stateRef, então mexer num
  // slider não recria nada
  useEffect(() => {
    const canvas = canvasRef.current;
    const s0 = stateRef.current;
    const ceiling = s0.tropopause * KM * 1.05;
    const scene = createScene(canvas, s0.domainRadius * KM, ceiling);
    sceneRef.current = scene;
    fieldRef.current = new SimClient(s0.particles, s0.domainRadius * KM, ceiling);

    spinupRef.current = 5 * 3600; // 5 h de spin-up

    const resize = () => {
      const r = canvas.parentElement.getBoundingClientRect();
      scene.resize(r.width, r.height);
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let frames = 0;
    let fpsClock = last;

    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dtReal = Math.min(0.05, (now - last) / 1000);
      last = now;

      const base = stateRef.current;
      const sim = fieldRef.current;
      const domain = base.domainRadius * KM;
      const ceil = base.tropopause * KM * 1.05;

      // o evento dirige os parâmetros a cada frame; a interface só é
      // sincronizada 2x por segundo, para não re-renderizar à toa
      let sample = null;
      let st = base;
      if (eventRef.current) {
        const { ev, startSec } = eventRef.current;
        sample = sampleEvent(ev, (simRef.current - startSec) / 3600);
        st = { ...base, ...sample.params };
      }

      const field = buildField(st);

      // passo fixo de 6 s simulado: grande o bastante pra não torrar CPU,
      // pequeno o bastante pra integração ficar estável no raio de vento máximo
      const DT = 6;
      const MAX_STEPS = 8;
      // no spin-up o passo é grosso de propósito: são só horas de condição
      // inicial, que a integração fina refina logo em seguida
      const spinning = spinupRef.current > 0;
      let dt = DT;
      let steps = 0;
      if (spinning) {
        dt = 120;
        steps = 6;
      } else if (runRef.current) {
        acc = Math.min(acc + dtReal * st.timeScale, MAX_STEPS * DT);
        steps = Math.floor(acc / DT);
      }

      // o tempo simulado só avança se o pedido foi aceito: quando o worker
      // ainda está ocupado, a simulação anda mais devagar em vez de acumular
      // uma fila e dessincronizar o relógio dos eventos
      if (steps > 0 && sim.step(dt, steps, field, base.particles, domain, ceil)) {
        const advanced = dt * steps;
        simRef.current += advanced;
        if (spinning) spinupRef.current -= advanced;
        else acc -= steps * DT;
      }

      sceneRef.current.setRmax(st.rmax * KM);
      sceneRef.current.sync(sim);
      sceneRef.current.render();

      frames++;
      if (now - fpsClock > 500) {
        setFps(Math.round((frames * 1000) / (now - fpsClock)));
        setSimTime(simRef.current);
        frames = 0;
        fpsClock = now;

        if (eventRef.current && sample) {
          const { ev, startSec } = eventRef.current;
          setState((s) => ({ ...s, ...sample.params }));
          setEventView({
            id: ev.id, name: ev.name, phase: sample.phase,
            progress: sample.progress,
            hours: (simRef.current - startSec) / 3600,
            total: eventDuration(ev), done: sample.done,
          });
          // chegou ao fim: devolve os controles ao usuário
          if (sample.done) eventRef.current = null;
        }
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      fieldRef.current.dispose();
      scene.dispose();
    };
  }, []);

  const diag = useMemo(() => {
    const f = buildField(state);
    const gradient = peakWind(f.pc, f.pn, f.rmax, f.B, f.f);
    // a categoria usa o vento a 10 m, não o gradiente
    const peak = gradient * SURFACE_FACTOR;
    const ss = saffirSimpson(peak);
    const h = Math.floor(simTime / 3600);
    const m = Math.floor((simTime % 3600) / 60);
    return {
      peak, gradient, ...ss, B: f.B, f: coriolis(state.latitude),
      pc: state.centralPressure,
      dp: state.ambientPressure - state.centralPressure,
      potential: potentialIntensity(state.sst),
      shear: state.shear, lat: state.latitude,
      hours: `${h}h ${String(m).padStart(2, '0')}min`,
      fps, event: eventView,
    };
  }, [state, fps, simTime, eventView]);

  const resetParticles = () => {
    fieldRef.current?.reset();
    spinupRef.current = 5 * 3600;
  };

  return (
    <div className="app">
      <Controls
        state={state} set={set}
        running={running} setRunning={setRunning}
        onReset={resetParticles}
        onStartEvent={startEvent}
        onStopEvent={stopEvent}
        activeEvent={eventView}
      />
      <main className="viewport">
        <canvas ref={canvasRef} />
        <Hud d={diag} />
        <div className="legend">
          <span>Cor = velocidade do vento</span>
          <i className="ramp" />
          <span>0 → 75 m/s</span>
        </div>
      </main>
    </div>
  );
}
