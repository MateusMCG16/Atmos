import React from 'react';
import { PRESETS } from './presets.js';
import { EVENTS } from '../sim/events.js';

function Slider({ label, unit, min, max, step, value, onChange, locked }) {
  return (
    <label className={'ctl' + (locked ? ' locked' : '')}>
      <span className="ctl-head">
        <span>{label}</span>
        <b>{typeof value === 'number' ? value.toFixed(step < 1 ? 2 : 0) : value}{unit}</b>
      </span>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

export default function Controls({
  state, set, running, setRunning, onReset,
  onStartEvent, onStopEvent, activeEvent,
}) {
  // enquanto um evento roda, ele é quem manda nesses parâmetros
  const driven = !!activeEvent && !activeEvent.done;

  return (
    <aside className="panel">
      <h1>Atmos</h1>
      <p className="sub">Simulação de ciclone tropical — modelo de Holland + Coriolis</p>

      <div className="row">
        <button onClick={() => setRunning(!running)}>{running ? 'Pausar' : 'Rodar'}</button>
        <button onClick={onReset}>Reiniciar partículas</button>
      </div>

      <h2>Eventos</h2>
      {activeEvent && (
        <div className="event-active">
          <div className="event-top">
            <strong>{activeEvent.name}</strong>
            <span>{activeEvent.hours.toFixed(1)} / {activeEvent.total} h</span>
          </div>
          <div className="event-phase">{activeEvent.phase}</div>
          <div className="event-bar">
            <i style={{ width: `${Math.round(activeEvent.progress * 100)}%` }} />
          </div>
          <button className="event-stop" onClick={onStopEvent}>
            {activeEvent.done ? 'Evento concluído — fechar' : 'Encerrar evento'}
          </button>
        </div>
      )}
      <div className="presets">
        {EVENTS.map((ev) => (
          <button
            key={ev.id}
            className={'event' + (activeEvent?.id === ev.id ? ' on' : '')}
            onClick={() => onStartEvent(ev)}
            title={ev.blurb}
          >
            <span className="event-name">{ev.name}</span>
            <span className="event-blurb">{ev.blurb}</span>
          </button>
        ))}
      </div>

      <h2>Cenários estáticos</h2>
      <div className="presets">
        {Object.entries(PRESETS).map(([name, patch]) => (
          <button key={name} className="preset" onClick={() => { onStopEvent(); set(patch); }}>
            {name}
          </button>
        ))}
      </div>

      <h2>Intensidade {driven && <em>— dirigida pelo evento</em>}</h2>
      <Slider label="Pressão central" unit=" hPa" min={880} max={1010} step={1} locked={driven}
        value={state.centralPressure} onChange={(v) => set({ centralPressure: v })} />
      <Slider label="Pressão ambiente" unit=" hPa" min={1000} max={1025} step={1}
        value={state.ambientPressure} onChange={(v) => set({ ambientPressure: v })} />
      <Slider label="Raio de vento máximo" unit=" km" min={8} max={200} step={1} locked={driven}
        value={state.rmax} onChange={(v) => set({ rmax: v })} />
      <label className="ctl ctl-check">
        <input type="checkbox" checked={state.autoB}
          onChange={(e) => set({ autoB: e.target.checked })} />
        <span>Parâmetro B automático</span>
      </label>
      {!state.autoB && (
        <Slider label="Parâmetro B de Holland" unit="" min={0.8} max={2.5} step={0.05}
          value={state.B} onChange={(v) => set({ B: v })} />
      )}

      <h2>Ambiente {driven && <em>— dirigido pelo evento</em>}</h2>
      <Slider label="Latitude" unit="°" min={-45} max={55} step={1} locked={driven}
        value={state.latitude} onChange={(v) => set({ latitude: v })} />
      <Slider label="Temperatura do mar" unit=" °C" min={12} max={33} step={0.5} locked={driven}
        value={state.sst} onChange={(v) => set({ sst: v })} />
      <Slider label="Altura da tropopausa" unit=" km" min={8} max={18} step={0.5}
        value={state.tropopause} onChange={(v) => set({ tropopause: v })} />
      <Slider label="Ângulo de inflow" unit="°" min={0} max={45} step={1} locked={driven}
        value={state.inflowAngle} onChange={(v) => set({ inflowAngle: v })} />
      <Slider label="Cisalhamento vertical" unit="" min={0} max={1} step={0.01} locked={driven}
        value={state.shear} onChange={(v) => set({ shear: v })} />
      <Slider label="Direção do cisalhamento" unit="°" min={0} max={360} step={5} locked={driven}
        value={state.shearDir} onChange={(v) => set({ shearDir: v })} />

      <h2>Simulação</h2>
      <Slider label="Partículas" unit="" min={5000} max={120000} step={5000}
        value={state.particles} onChange={(v) => set({ particles: v })} />
      <Slider label="Aceleração do tempo" unit="×" min={1} max={1200} step={10}
        value={state.timeScale} onChange={(v) => set({ timeScale: v })} />
      <Slider label="Raio do domínio" unit=" km" min={150} max={800} step={10}
        value={state.domainRadius} onChange={(v) => set({ domainRadius: v })} />
    </aside>
  );
}
