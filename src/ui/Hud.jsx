import React from 'react';

const f1 = (n) => n.toFixed(1);

export default function Hud({ d }) {
  // acima de ~35° a energia do sistema vem de gradientes térmicos horizontais,
  // não do oceano: o limite termodinâmico de Emanuel deixa de valer
  const baroclinic = Math.abs(d.lat) > 35;
  const over = d.peak > d.potential + 2 && !baroclinic;

  return (
    <div className="hud">
      {d.event && (
        <div className="hud-event">
          <div className="hud-event-top">
            <strong>{d.event.name}</strong>
            <span>{d.event.hours.toFixed(1)} h</span>
          </div>
          <div className="hud-event-phase">{d.event.phase}</div>
          <div className="event-bar">
            <i style={{ width: `${Math.round(d.event.progress * 100)}%` }} />
          </div>
        </div>
      )}

      <div className="hud-main">
        <span className="cat" data-cat={d.cat}>{d.cat}</span>
        <div>
          <strong>{d.label}</strong>
          <div className="hud-wind">{f1(d.peak)} m/s a 10 m · {f1(d.peak * 3.6)} km/h · {f1(d.peak * 1.944)} kt</div>
        </div>
      </div>
      <dl>
        <div><dt>Pressão central</dt><dd>{d.pc.toFixed(0)} hPa</dd></div>
        <div><dt>Δp</dt><dd>{d.dp.toFixed(0)} hPa</dd></div>
        <div><dt>Vento gradiente</dt><dd>{f1(d.gradient)} m/s</dd></div>
        <div><dt>Parâmetro B</dt><dd>{f1(d.B)}</dd></div>
        <div><dt>Coriolis f</dt><dd>{(d.f * 1e5).toFixed(2)}×10⁻⁵ s⁻¹</dd></div>
        <div><dt>Hemisfério</dt><dd>{d.f >= 0 ? 'Norte (anti-horário)' : 'Sul (horário)'}</dd></div>
        <div><dt>Intensidade potencial</dt><dd className={over ? 'warn' : ''}>{f1(d.potential)} m/s</dd></div>
        <div><dt>Tempo simulado</dt><dd>{d.hours}</dd></div>
        <div><dt>FPS</dt><dd>{d.fps}</dd></div>
      </dl>
      {over && (
        <p className="note">
          O vento excede o limite termodinâmico para essa temperatura do mar —
          um ciclone real não se sustentaria nessa intensidade.
        </p>
      )}
      {baroclinic && (
        <p className="note">
          Em latitude alta o sistema passa a se alimentar de gradientes térmicos
          horizontais, não do oceano — a intensidade potencial deixa de ser o
          limite que vale aqui.
        </p>
      )}
      {d.shear > 0.5 && (
        <p className="note">
          Cisalhamento forte: o vórtice está inclinado e desacoplado em altura.
        </p>
      )}
      {Math.abs(d.lat) < 5 && (
        <p className="note">
          Perto do equador Coriolis é quase nulo — ciclones tropicais não se
          formam nessa faixa.
        </p>
      )}
    </div>
  );
}
