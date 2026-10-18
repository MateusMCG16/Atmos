# Atmos

Ambiente 3D no navegador para testar a física de ciclones tropicais.

## Rodar

```bash
npm install
npm run dev
```

## Eventos

Os eventos são roteiros que evoluem os parâmetros ao longo do **tempo simulado**,
passando por fases nomeadas. Enquanto um roda, ele assume os sliders que dirige
(marcados em amarelo) e o progresso aparece no painel e no HUD. Ao terminar, os
controles voltam para você.

| Evento | Duração simulada | O que acontece |
| --- | --- | --- |
| Intensificação rápida | 40 h | Depressão de 35 kt vira cat. 4 de 126 kt; o olho contrai de 70 para 20 km |
| Substituição da parede do olho | 34 h | Parede externa estrangula a interna: cai de 121 para 94 kt e volta mais larga |
| Cisalhamento destrutivo | 44 h | O vórtice inclina e se desfaz, de cat. 3 a remanescente aberto |
| Landfall | 32 h | Perde o oceano e ganha atrito: 96 kt para 17 kt em pouco mais de um dia |
| Transição extratropical | 54 h | Núcleo quente compacto vira ciclone frio de 200 km de raio |
| Ressurgência de água fria | 38 h | A tempestade esfria o próprio oceano e corta o combustível |

Cada evento também ajusta a aceleração do tempo para caber em cerca de 3 minutos
reais. As taxas foram conferidas contra o que se observa: a intensificação
rápida fica na faixa de 100-120 kt/24 h (o recorde do Patricia), e o colapso
pós-landfall, em ~120 kt/24 h.

## O que está modelado

O campo de vento não é inventado — é o **perfil de Holland (1980)**, o modelo
paramétrico que se usa de verdade em meteorologia operacional e em engenharia de
risco. Em cima dele:

- **Balanço de vento gradiente** com força de **Coriolis** (`f = 2Ω·senφ`), então
  a latitude importa de verdade: perto do equador o sistema não fecha, e no
  hemisfério sul a rotação inverte sozinha.
- **Camada limite com atrito**: o ar não gira em círculo, ele espirala para
  dentro com um ângulo de inflow que some com a altura.
- **Circulação secundária**: convergência embaixo → ascensão na parede do olho
  (mais um ramo largo sobre o núcleo) → **outflow anticiclônico** na tropopausa,
  com subsidência dentro do olho.
- **Cisalhamento vertical** do vento ambiente, que inclina e desacopla o vórtice.
- **Intensidade potencial de Emanuel**: o limite termodinâmico que a temperatura
  do mar impõe. Se você passar do limite, o HUD avisa.

O perfil pressão-vento resultante segue a relação observada de
Atkinson-Holliday dentro de ~4% entre 995 e 900 hPa, e o vento reportado é o de
10 m (gradiente × 0,8), que é o que a escala Saffir-Simpson usa.

As partículas são traçadores lagrangeanos advectados pelo campo, com inércia.
A vertical é exagerada 7× na tela — 400 km de largura por 15 km de altura seria
uma panqueca.

## Performance

Três mudanças, sem abrir mão de nada na física:

1. **O campo é separável.** Cada fator de `windAt` depende OU só do raio OU só
   da altura. Fatorando, dá para pré-calcular duas tabelas 1D e trocar todo o
   `pow`/`exp`/`tan` do laço interno por duas interpolações lineares. Não é
   simplificação: é a mesma expressão, reorganizada.
2. **Zero alocação por partícula.** `windAt` devolvia um objeto novo por
   partícula por passo — 240 mil objetos por frame. O amostrador agora escreve
   num buffer reaproveitado.
3. **A advecção saiu da thread principal** para um Web Worker, com os buffers
   fazendo ping-pong (sem cópia, sem alocação por frame). O próprio vaivém dos
   buffers serve de controle de fluxo: se o worker atrasa, a simulação anda mais
   devagar em vez de acumular fila — o relógio dos eventos continua honesto.

Medido com 30 mil partículas:

| | antes | depois |
| --- | --- | --- |
| Passo da simulação | 10,3 ms | 3,8 ms |
| Trabalho na thread principal por frame | 16,7 ms | 2,1 ms |

A qualidade foi verificada, não suposta: o campo tabelado difere do exato em
0,0002 m/s na média (pior caso 0,27% do pico), e trajetórias de 6 h integradas
pelos dois caminhos divergem 142 m sobre um percurso de 266 km — 0,25%.
`windAt` continua no código como implementação de referência, e é contra ela que
essa verificação roda.

## Dependências

Cinco, todas pinadas em versão exata, `ignore-scripts=true` no `.npmrc`:
`react`, `react-dom`, `three`, `vite`, `@vitejs/plugin-react`. `npm audit`
limpo. Nenhuma lib de UI, de estado ou de física de terceiros.
