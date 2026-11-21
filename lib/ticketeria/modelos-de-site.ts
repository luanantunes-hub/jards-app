// Os modelos de site (a biblioteca de seções, passo 5; direção aprovada pelo dono em 20/11/2026): três jeitos prontos de começar um site, cada um com as páginas, as seções e os textos de
// exemplo já escritos, o tema, a cor sugerida, o menu e o rodapé. A pessoa escolhe um ao criar o site e troca os textos pelos seus. Só dados e regras: sem banco, sem tela e sem servidor.
// Os textos de exemplo não têm endereço de internet (as seções que pedem link ou imagem ficam por conta de quem monta) e dizem, com palavras claras, o que a pessoa deve trocar.

import { APARENCIA_PADRAO, type AparenciaDoSite } from "@/lib/ticketeria/aparencia";
import type { TemaDoSite } from "@/lib/ticketeria/estados";
import { lerBloco, type Bloco } from "@/lib/ticketeria/site";

export const IDS_DOS_MODELOS = ["em_branco", "companhia", "casa", "festival"] as const;
export type IdDoModelo = (typeof IDS_DOS_MODELOS)[number];

type PaginaDoModelo = { slug: string; titulo: string; blocos: (ctx: ContextoDoModelo) => unknown[] };
export type ContextoDoModelo = { nome: string; agora: number; espacoId: string | null };

export type ModeloDeSite = {
  id: IdDoModelo; nome: string; frase: string; tema: TemaDoSite; cor: string; aparencia: AparenciaDoSite;
  /** Para quem é, numa linha, e o que vem pronto. */
  contem: string;
  paginas: PaginaDoModelo[];
};

const titulo = (texto: string) => ({ tipo: "titulo", texto });
const texto = (t: string) => ({ tipo: "texto", texto: t });
const agenda = (layout: string, t = "") => ({ tipo: "agenda", titulo: t, layout });
const proximo = () => ({ tipo: "capa", layout: "proximo", titulo: "" });
const faq = (titulo: string, itens: [string, string][]) => ({ tipo: "faq", titulo, itens: itens.map(([pergunta, resposta]) => ({ pergunta, resposta })) });
const contato = () => ({ tipo: "contato", email: "contato@exemplo.com.br", telefone: "(00) 00000-0000", endereco: "Rua Exemplo, 100, Sua cidade/UF" });

const PERGUNTAS_DE_INGRESSO: [string, string][] = [
  ["Como compro os ingressos?", "Pelo botão Ingressos do menu ou em cada espetáculo. A compra é feita aqui mesmo e os ingressos chegam por e-mail, com um QR Code para mostrar na entrada."],
  ["Tem meia-entrada?", "Sim, para quem tem direito, com documento na entrada. Escolha o tipo de ingresso na hora da compra."],
  ["Posso pedir meu dinheiro de volta?", "Em até 7 dias da compra, desde que nenhum ingresso tenha sido usado. O pedido é feito na página do seu pedido."],
  ["Qual é a classificação indicativa?", "Cada espetáculo mostra a sua classificação na página dele. Menores devem seguir a classificação indicada."],
];

export const MODELOS_DE_SITE: Record<IdDoModelo, ModeloDeSite> = {
  em_branco: {
    id: "em_branco", nome: "Em branco", frase: "Uma página de início com um título e um texto, para você montar do seu jeito.", tema: "classico", cor: "#282525", aparencia: APARENCIA_PADRAO, contem: "1 página",
    paginas: [{ slug: "inicio", titulo: "Início", blocos: c => [titulo(c.nome), texto("Escreva aqui uma apresentação: quem somos, o que fazemos e como chegar."), ...(c.espacoId ? [{ tipo: "programacao", titulo: "Programação", espaco_id: c.espacoId }] : [])] }],
  },
  companhia: {
    id: "companhia", nome: "Companhia de teatro", frase: "Para quem monta espetáculos: o que está em cartaz, a companhia, o elenco e as perguntas de quem vai comprar.", tema: "editorial", cor: "#2B1A4F",
    aparencia: { cabecalho: { layout: "centralizado", botao_rotulo: "Ingressos", botao_url: "", faixa: [] }, rodape: { ...APARENCIA_PADRAO.rodape, layout: "simples", contato: "contato@exemplo.com.br", endereco: "Rua Exemplo, 100, Sua cidade/UF" } },
    contem: "5 páginas: início, elenco, como chegar, perguntas e contato",
    paginas: [
      { slug: "inicio", titulo: "Início", blocos: () => [proximo(), titulo("Em cartaz"), agenda("grade"), titulo("A companhia"), texto("Conte aqui, em poucas linhas, quem vocês são: quando a companhia nasceu, o que ela monta e para quem. Troque este texto pelo seu.")] },
      { slug: "elenco", titulo: "Elenco", blocos: () => [titulo("Elenco e equipe"), texto("Apresente aqui as pessoas da companhia: atores, direção, cenário, figurino, luz e som. Um parágrafo para cada pessoa funciona bem.")] },
      { slug: "como-chegar", titulo: "Como chegar", blocos: () => [titulo("Como chegar"), texto("Escreva o endereço, as linhas de ônibus ou metrô que passam perto, onde estacionar e se o espaço tem acesso para cadeira de rodas.")] },
      { slug: "perguntas", titulo: "Perguntas", blocos: () => [faq("Perguntas frequentes", PERGUNTAS_DE_INGRESSO)] },
      { slug: "contato", titulo: "Contato", blocos: () => [titulo("Fale com a companhia"), contato()] },
    ],
  },
  casa: {
    id: "casa", nome: "Casa de espetáculo", frase: "Para teatros e casas de show: a programação do mês, a casa, como chegar com acessibilidade e as perguntas.", tema: "classico", cor: "#1C3A4F",
    aparencia: { cabecalho: { layout: "classico", botao_rotulo: "Ingressos", botao_url: "", faixa: [] }, rodape: { ...APARENCIA_PADRAO.rodape, layout: "colunas", contato: "contato@exemplo.com.br", endereco: "Rua Exemplo, 100, Sua cidade/UF", horario: "Bilheteria: terça a domingo, das 14h às 20h" } },
    contem: "6 páginas: início, programação, a casa, como chegar, perguntas e contato",
    paginas: [
      { slug: "inicio", titulo: "Início", blocos: () => [proximo(), titulo("Programação do mês"), agenda("calendario"), titulo("A casa"), texto("Apresente a casa: a sala, a capacidade, o que já passou por aqui. Troque este texto pelo seu.")] },
      { slug: "programacao", titulo: "Programação", blocos: () => [agenda("filtros", "Toda a programação")] },
      { slug: "a-casa", titulo: "A casa", blocos: () => [titulo("A casa"), texto("Conte a história do espaço e o que ele oferece ao público e aos artistas: salas, camarins, bar, bilheteria."), titulo("Aluguel e parcerias"), texto("Se a casa recebe eventos de terceiros, explique aqui como pedir um orçamento.")] },
      { slug: "como-chegar", titulo: "Como chegar", blocos: () => [titulo("Como chegar"), texto("Escreva o endereço, o transporte público mais próximo e as opções de estacionamento."), titulo("Acessibilidade"), texto("Diga o que a casa oferece: acesso para cadeira de rodas, banheiros adaptados, Libras, audiodescrição, lugares reservados.")] },
      { slug: "perguntas", titulo: "Perguntas", blocos: () => [faq("Perguntas frequentes", PERGUNTAS_DE_INGRESSO)] },
      { slug: "contato", titulo: "Contato", blocos: () => [titulo("Fale com a casa"), contato()] },
    ],
  },
  festival: {
    id: "festival", nome: "Festival", frase: "Para festivais e temporadas: uma capa forte, a contagem até a abertura, a programação por dia e o que o público precisa saber.", tema: "noite", cor: "#B4402E",
    aparencia: { cabecalho: { layout: "minimo", botao_rotulo: "Ingressos", botao_url: "", faixa: [] }, rodape: { ...APARENCIA_PADRAO.rodape, layout: "simples", contato: "contato@exemplo.com.br" } },
    contem: "4 páginas: início, programação, informações e contato",
    paginas: [
      { slug: "inicio", titulo: "Início", blocos: c => [
        { tipo: "capa", layout: "tela_cheia", titulo: c.nome, subtitulo: "Uma frase sobre o festival: quando acontece, onde e o que o público vai viver. Troque este texto pelo seu.", chamada: "Edição de exemplo", imagem: "", botao_rotulo: "", botao_url: "", botao2_rotulo: "", botao2_url: "" },
        { tipo: "contagem", titulo: "Faltam", ate: new Date(c.agora + 90 * 86_400_000).toISOString(), depois: "Já começou!" },
        titulo("Programação"), agenda("lista"),
      ] },
      { slug: "programacao", titulo: "Programação", blocos: () => [agenda("filtros", "Toda a programação")] },
      { slug: "informacoes", titulo: "Informações", blocos: () => [faq("O que você precisa saber", [
        ["Como chego ao festival?", "Escreva aqui o endereço, o transporte público e as opções de estacionamento ou de transporte por aplicativo."],
        ["O que posso levar?", "Liste o que é permitido e o que é proibido na entrada: bolsas, garrafas, câmeras, alimentos."],
        ["Crianças podem entrar?", "Diga a faixa etária permitida e se menores precisam estar acompanhados."],
        ...PERGUNTAS_DE_INGRESSO.slice(2, 3),
      ])] },
      { slug: "contato", titulo: "Contato", blocos: () => [titulo("Fale com a organização"), contato()] },
    ],
  },
};

/** As páginas de um modelo, com os blocos já lidos (cada bloco passa pela mesma conferência do editor). Bloco que não passa é um erro do modelo: lança. */
export function paginasDoModelo(id: IdDoModelo, contexto: ContextoDoModelo): { slug: string; titulo: string; ordem: number; blocos: Bloco[] }[] {
  const modelo = MODELOS_DE_SITE[id];
  return modelo.paginas.map((pagina, ordem) => ({
    slug: pagina.slug, titulo: pagina.titulo, ordem,
    blocos: pagina.blocos(contexto).map((bloco, i) => {
      const leitura = lerBloco(bloco);
      if (!leitura.ok) throw new Error(`modelo ${id}, página ${pagina.slug}, bloco ${i + 1}: ${leitura.erro}`);
      return leitura.bloco;
    }),
  }));
}

export const ehIdDeModelo = (v: unknown): v is IdDoModelo => typeof v === "string" && (IDS_DOS_MODELOS as readonly string[]).includes(v);
