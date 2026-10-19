// Infográfico do post sobre o olhar da responsabilidade social: as quatro
// escalas da multi-escalaridade citadas no texto (Norman Long e Anthony
// Bebbington), em anéis que se contêm. As linhas pontilhadas atravessam todos
// os anéis: o desenvolvimento acontece nas quatro escalas ao mesmo tempo.

const ROTULO = "font-(family-name:--font-mono) text-[0.6875rem] font-medium uppercase tracking-[.08em]";

const ESCALAS = [
  { nome: "Doméstica", raio: 30 },
  { nome: "Comunitária", raio: 62 },
  { nome: "Institucional", raio: 96 },
  { nome: "Global", raio: 130 },
];

const C = 140; // centro do desenho
const DIAGONAL = -Math.PI / 4; // os números sobem em diagonal, um por anel

export default function InfograficoEscalas() {
  return (
    <figure className="my-12" aria-labelledby="info-escalas-titulo">
      <div className="grid items-center gap-8 rounded bg-[#F7F7F5] px-5 py-7 sm:grid-cols-[15rem_1fr] sm:px-8">
        <svg viewBox="0 0 280 280" className="mx-auto w-full max-w-[15rem]" role="img" aria-label="Quatro anéis, um dentro do outro: doméstica, comunitária, institucional e global.">
          <defs>
            <radialGradient id="escalas-casa">
              <stop offset="0" stopColor="#E08A3C" stopOpacity=".55" />
              <stop offset="1" stopColor="#E08A3C" stopOpacity="0" />
            </radialGradient>
          </defs>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i * Math.PI) / 3 + Math.PI / 6;
            return (
              <line key={i} x1={C} y1={C} x2={C + 134 * Math.cos(a)} y2={C + 134 * Math.sin(a)}
                className="stroke-[#282525]/20" strokeWidth={1} strokeDasharray="1 4" />
            );
          })}
          <circle cx={C} cy={C} r={30} fill="url(#escalas-casa)" />
          {ESCALAS.map((e, i) => (
            <circle key={e.nome} cx={C} cy={C} r={e.raio} fill="none"
              stroke={i === 3 ? "#4A6385" : "#282525"} strokeOpacity={i === 3 ? 0.6 : 0.25 + i * 0.08}
              strokeWidth={1} strokeDasharray={i === 3 ? "3 5" : undefined} />
          ))}
          <circle cx={C} cy={C} r={4} fill="#E08A3C" />
          {ESCALAS.map((e, i) => (
            <text key={e.nome} x={C + e.raio * Math.cos(DIAGONAL) + 4} y={C + e.raio * Math.sin(DIAGONAL) - 4}
              className="fill-[#282525]/55 font-(family-name:--font-mono) text-[11px] font-medium">
              {String(i + 1).padStart(2, "0")}
            </text>
          ))}
        </svg>

        <div>
          <p className={`${ROTULO} text-[#684DB0]`}>Multi-escalaridade</p>
          <p id="info-escalas-titulo" className="mt-2 text-lg leading-snug font-bold tracking-[-0.01em] text-balance text-[#282525]">
            O desenvolvimento acontece em quatro escalas ao mesmo tempo
          </p>
          <ol className="mt-5 flex flex-col gap-2">
            {ESCALAS.map((e, i) => (
              <li key={e.nome} className="flex items-baseline gap-3 border-t border-black/[.08] pt-2">
                <span className={`${ROTULO} text-black/45`}>{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[0.9375rem] font-medium text-[#282525]">{e.nome}</span>
              </li>
            ))}
          </ol>
          <figcaption className="mt-5 text-xs leading-relaxed text-black/50">
            Conceito central para Norman Long (Development Sociology, 2001) e Anthony Bebbington (Capitals and Capabilities, 1999).
          </figcaption>
        </div>
      </div>
    </figure>
  );
}
