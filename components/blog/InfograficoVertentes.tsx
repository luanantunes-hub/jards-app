// Infográfico do post "De onde vem o olhar de quem faz responsabilidade
// social?": as três vertentes cruzadas com as perguntas que a introdução faz
// (onde a mudança começa, quem conduz e com quais instrumentos, o que fica).
// Cada célula resume o que o próprio texto diz; nada aqui é informação nova.

const ROTULO = "font-(family-name:--font-mono) text-[0.6875rem] font-medium uppercase tracking-[.08em]";

type Vertente = { nome: string; teoria: string; Simbolo: () => React.ReactElement };

// Os símbolos repetem a capa: a grade do mapa (olhar de fora), as luzes das
// casas (olhar de dentro) e as linhas que ligam os dois (diálogo).
function Mapa() {
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden="true">
      <path d="M4 10H24M4 18H24M10 4V24M18 4V24" className="stroke-[#282525]/30" strokeWidth={1} fill="none" />
      <circle cx="14" cy="14" r="5.5" fill="none" stroke="#4A6385" strokeWidth={1.25} strokeDasharray="2 2" />
      <circle cx="14" cy="14" r="1.6" fill="#4A6385" />
    </svg>
  );
}
function Luzes() {
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden="true">
      <circle cx="9" cy="17" r="5" fill="#E08A3C" opacity=".18" />
      <circle cx="9" cy="17" r="2.2" fill="#E08A3C" />
      <circle cx="19" cy="10" r="2" fill="#E08A3C" opacity=".75" />
      <circle cx="20" cy="20" r="1.6" fill="#E08A3C" opacity=".55" />
      <circle cx="13" cy="6" r="1.2" fill="#E08A3C" opacity=".4" />
    </svg>
  );
}
function Dialogo() {
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden="true">
      <path d="M8.5 14H19.5" stroke="#684DB0" strokeWidth={1.25} />
      <circle cx="7" cy="14" r="4" fill="none" stroke="#4A6385" strokeWidth={1.25} />
      <circle cx="21" cy="14" r="4" fill="#E08A3C" opacity=".85" />
    </svg>
  );
}

const VERTENTES: Vertente[] = [
  { nome: "Pela falta", teoria: "Abordagem Baseada em Necessidades", Simbolo: Mapa },
  { nome: "Pelo território", teoria: "Desenvolvimento de Ativos e Capacidades", Simbolo: Luzes },
  { nome: "Pelo diálogo", teoria: "Vertente híbrida", Simbolo: Dialogo },
];

const LINHAS: { pergunta: string; respostas: [string, string, string] }[] = [
  {
    pergunta: "Onde a mudança começa",
    respostas: [
      "No diagnóstico do que falta: recursos, serviços, direitos e infraestrutura.",
      "No que já existe: saberes, lideranças, espaços, vínculos e formas de cooperação.",
      "No encontro entre as forças locais e as estruturas políticas, institucionais e econômicas.",
    ],
  },
  {
    pergunta: "Quem conduz",
    respostas: [
      "Especialistas e instituições. A comunidade é destinatária.",
      "A comunidade. A empresa facilita processos e articula redes.",
      "Empresa, Estado e comunidade, como coautores com papéis distintos.",
    ],
  },
  {
    pergunta: "Com quais instrumentos",
    respostas: [
      "Indicadores objetivos, programas específicos e mensuração de resultados.",
      "Descoberta e mobilização dos ativos locais; prioridade a quem já atua no território.",
      "Teoria da Mudança, indicadores de impacto e participação comunitária no mesmo desenho.",
    ],
  },
  {
    pergunta: "O que permanece",
    respostas: [
      "Condições mínimas de bem-estar, acesso e repertório.",
      "As capacidades que continuam no território quando o investimento acaba.",
      "Resultados tangíveis e os vínculos e aprendizados do processo.",
    ],
  },
  {
    pergunta: "Limite",
    respostas: [
      "Tende a tratar as comunidades como destinatárias, não como coautoras.",
      "Em vulnerabilidade extrema, os ativos locais podem não bastar.",
      "A complexidade: tempos e linguagens que nem sempre coincidem.",
    ],
  },
];

function Cabecalho({ v }: { v: Vertente }) {
  return (
    <div className="flex items-start gap-3">
      <v.Simbolo />
      <div>
        <p className="text-[0.9375rem] leading-tight font-bold text-[#282525]">{v.nome}</p>
        <p className="mt-1 text-xs leading-snug text-black/50">{v.teoria}</p>
      </div>
    </div>
  );
}

export default function InfograficoVertentes() {
  return (
    <figure className="my-12 lg:-mr-32 xl:-mr-48" aria-labelledby="info-vertentes-titulo">
      <div className="rounded bg-[#F7F7F5] px-5 py-7 sm:px-8">
        <p className={`${ROTULO} text-[#684DB0]`}>As três vertentes</p>
        <p id="info-vertentes-titulo" className="mt-2 text-xl leading-snug font-bold tracking-[-0.01em] text-[#282525]">
          Três respostas para as mesmas perguntas
        </p>

        {/* Tela larga: tabela com uma coluna por vertente */}
        <table className="mt-7 hidden w-full table-fixed border-collapse text-left sm:table">
          <caption className="sr-only">As três vertentes da responsabilidade social, comparadas</caption>
          <colgroup>
            <col className="w-[9.5rem]" />
            <col />
            <col />
            <col />
          </colgroup>
          {/* Cabeçalho das colunas no corpo da tabela: o globals.css estiliza
              "thead th" como cabeçalho de lista do app (caixa alta, 10px). */}
          <tbody>
            <tr>
              <td />
              {VERTENTES.map((v) => (
                <th key={v.nome} scope="col" className="px-3 pb-4 text-left align-top font-normal">
                  <Cabecalho v={v} />
                </th>
              ))}
            </tr>
            {LINHAS.map((linha) => (
              <tr key={linha.pergunta} className="border-t border-black/[.08]">
                <th scope="row" className={`${ROTULO} py-4 pr-3 align-top text-black/50`}>{linha.pergunta}</th>
                {linha.respostas.map((r, i) => (
                  <td key={i} className="px-3 py-4 align-top text-[0.8125rem] leading-relaxed text-black/70">{r}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Celular: uma vertente por vez */}
        <div className="mt-6 flex flex-col gap-6 sm:hidden">
          {VERTENTES.map((v, i) => (
            <section key={v.nome} className="border-t border-black/[.08] pt-5">
              <Cabecalho v={v} />
              <dl className="mt-4 flex flex-col gap-3">
                {LINHAS.map((linha) => (
                  <div key={linha.pergunta}>
                    <dt className={`${ROTULO} text-black/50`}>{linha.pergunta}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-black/70">{linha.respostas[i]}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </figure>
  );
}
