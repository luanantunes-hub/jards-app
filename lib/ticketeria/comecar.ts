// O onboarding da Ticketeria ("Começar"): o produtor diz como trabalha, responde uma pergunta por tela (nome, lugar no mapa, quando
// e preço) e sai com o primeiro evento pronto, em rascunho. Quem cria tudo é o banco, numa só chamada (fn_ticketeria_comecar, migration ticketeria_comecar); aqui
// fica o que a tela precisa antes de chamar: as perguntas por perfil, a conferência dos campos, a divisão da meia-entrada
// (a mesma conta do banco), o auditório de lugares numerados e as mensagens de erro. Sem imports de servidor: roda nos testes (tests/ticketeria-comecar.test.ts).

import { MAX_FILEIRAS, MAX_LUGARES_NA_FILEIRA, MAX_LUGARES_NO_SETOR, comCorredor, proximoNomeDeFileira, resumoDoMapa, type FileiraDoMapa } from "@/lib/ticketeria/mapa";

export type PerfilDoProdutor = "espaco" | "turne" | "unico" | "festival";

export const PERFIS: readonly PerfilDoProdutor[] = ["espaco", "turne", "unico", "festival"];

/** As perguntas de cada perfil. Cada tela pergunta uma coisa só; o subtítulo, quando há, diz só o que é a resposta. */
export const PERFIL: Record<PerfilDoProdutor, {
  titulo: string; descricao: string;
  /** Ilustração do cartão (public/ilustracoes/ticketeria); sem ela, a tela usa um ícone. */
  ilustracao: string | null;
  nome: { pergunta: string; apoio: string; rotulo: string; exemplo: string };
  onde: { pergunta: string; apoio: string; rotuloDoLugar: string; exemploDoLugar: string };
  data: { pergunta: string };
}> = {
  espaco: {
    titulo: "Tenho um espaço", descricao: "Teatro, casa de show, galeria. Vários eventos no mesmo lugar.",
    ilustracao: "/ilustracoes/ticketeria/perfil-espaco.webp",
    nome: { pergunta: "Como se chama o seu espaço?", apoio: "O nome do lugar que aparece nos ingressos.", rotulo: "Nome do espaço", exemplo: "Teatro Municipal" },
    onde: { pergunta: "Onde fica o seu espaço?", apoio: "Escolha o estado no mapa e depois a cidade.", rotuloDoLugar: "", exemploDoLugar: "" },
    data: { pergunta: "Quando é o primeiro evento?" },
  },
  turne: {
    titulo: "Circulo com um espetáculo", descricao: "A mesma obra em várias cidades e datas.",
    ilustracao: "/ilustracoes/ticketeria/perfil-turne.webp",
    nome: { pergunta: "Qual é o espetáculo?", apoio: "O nome que as pessoas vão ver no ingresso.", rotulo: "Nome do espetáculo", exemplo: "O Auto da Compadecida" },
    onde: { pergunta: "Onde é a primeira data?", apoio: "Escolha o estado no mapa e depois a cidade.", rotuloDoLugar: "Nome do lugar (se quiser)", exemploDoLugar: "Teatro Guaíra" },
    data: { pergunta: "Quando é a primeira data?" },
  },
  unico: {
    titulo: "Faço um evento único", descricao: "Uma festa, um show, uma palestra.",
    ilustracao: "/ilustracoes/ticketeria/perfil-unico.webp",
    nome: { pergunta: "Como se chama o seu evento?", apoio: "O nome que as pessoas vão ver no ingresso.", rotulo: "Nome do evento", exemplo: "Show de lançamento" },
    onde: { pergunta: "Onde vai ser?", apoio: "Escolha o estado no mapa e depois a cidade.", rotuloDoLugar: "Nome do lugar (se quiser)", exemploDoLugar: "Casa de Cultura" },
    data: { pergunta: "Quando vai ser?" },
  },
  festival: {
    titulo: "Organizo um festival", descricao: "Vários dias ou atrações, no mesmo lugar.",
    ilustracao: "/ilustracoes/ticketeria/perfil-festival.webp",
    nome: { pergunta: "Como se chama o festival?", apoio: "O nome que as pessoas vão ver no ingresso.", rotulo: "Nome do festival", exemplo: "Festival de Inverno" },
    onde: { pergunta: "Onde vai ser?", apoio: "Escolha o estado no mapa e depois a cidade.", rotuloDoLugar: "Nome do lugar (se quiser)", exemploDoLugar: "Parque da Cidade" },
    data: { pergunta: "Quando começa?" },
  },
};

/**
 * Uma praça: um lugar com as suas datas. Evento único, temporada, festival e espaço têm uma só; a turnê tem uma por cidade. As datas são as que a
 * pessoa marcou no calendário, seguidas ou alternadas. `outra` (só na turnê): "tem outra cidade?", null enquanto não respondeu.
 */
export type Praca = { uf: string; cidade: string; lugar: string; datas: string[]; outra: boolean | null };

export const praca = (): Praca => ({ uf: "", cidade: "", lugar: "", datas: [], outra: null });

export type RespostasDoComecar = {
  perfil: PerfilDoProdutor | null;
  evento: string;
  /** As praças. O nome do espaço (perfil "espaço") fica em `pracas[0].lugar`; nos outros perfis, `lugar` é o nome do lugar (opcional). */
  pracas: Praca[];
  lugares: string;
  hora: string; // HH:MM, o mesmo em todas as datas
  /** Lugares numerados: null enquanto a pessoa não respondeu. */
  numerada: boolean | null;
  /**
   * O mapa de assentos que a pessoa desenhou (só com lugares numerados; null até chegar no passo do auditório): o MESMO mapa do editor do setor, com fileiras,
   * lugares de cada uma e cadeiras bloqueadas. É o mapa final: o evento já nasce com ele. `mapaDeLugares` é o "quantos lugares" com que ele foi gerado
   * (se a pessoa voltar e mudar o número, o mapa é refeito).
   */
  mapa: FileiraDoMapa[] | null;
  mapaDeLugares: number;
  /** Lugares por fileira do último "refazer" (só para o controle de refazer a grade). */
  porFileira: string;
  corredor: boolean;
  /** O ingresso é gratuito? null enquanto a pessoa não respondeu. */
  gratuito: boolean | null;
  /** Por onde o ingresso vai ser vendido: só na porta, só online ou os dois. null enquanto a pessoa não respondeu. Não vai para o banco: decide o que a tela final oferece. */
  venda: VendaDoEvento | null;
  preco: string; // em reais, como digitado ("60" ou "59,90")
  /** Tem meia-entrada? null enquanto a pessoa não respondeu. */
  meia: boolean | null;
};

export const RESPOSTAS_VAZIAS: RespostasDoComecar = {
  perfil: null, evento: "", pracas: [praca()], lugares: "", hora: "20:00", numerada: null, mapa: null, mapaDeLugares: 0, porFileira: "", corredor: true, gratuito: null, venda: null, preco: "", meia: null,
};

export const MAX_PRACAS = 20;
export const MAX_DATAS_POR_PRACA = 60;
export const MAX_SESSOES = 200;

/** Os passos com perguntas, uma coisa por tela (depois vem o evento pronto). */
export type VendaDoEvento = "porta" | "online" | "os_dois";

/** As três respostas de "Como você vai vender?", com a frase de apoio de cada uma. */
export const VENDAS: { id: VendaDoEvento; rotulo: string; dica: string }[] = [
  { id: "porta", rotulo: "Na porta", dica: "Só no balcão, no dia do evento." },
  { id: "online", rotulo: "Online", dica: "Pelo site, com pagamento na hora." },
  { id: "os_dois", rotulo: "Os dois", dica: "Site e balcão ao mesmo tempo." },
];

export type PassoId = "perfil" | "nome" | "onde" | "evento" | "data" | "outra" | "horario" | "numerada" | "lugares" | "auditorio" | "gratuito" | "preco" | "meia" | "venda";
/** Um passo e, nos que se repetem por cidade (onde, data, outra), qual é a praça. */
export type Passo = { id: PassoId; praca: number };

/** As praças que valem: só a primeira, ou, na turnê, a sequência em que cada cidade responde "tem outra cidade?" com sim. */
export function pracasEfetivas(perfil: PerfilDoProdutor | null, pracas: readonly Praca[]): Praca[] {
  if (perfil !== "turne") return pracas.slice(0, 1);
  const saida: Praca[] = [];
  for (const p of pracas) {
    saida.push(p);
    if (p.outra !== true) break;
  }
  return saida;
}

/**
 * A sequência de passos: o nome do primeiro evento só para quem tem espaço; onde e quais dias (e, na turnê, "tem outra cidade?") uma vez por cidade; o
 * auditório só com lugares numerados; e o preço e a meia-entrada só se o ingresso não for gratuito. Enquanto uma resposta não vem, vale o caminho mais
 * comum (uma cidade; sem auditório; ingresso pago).
 */
export function passosDoComecar(perfil: PerfilDoProdutor | null, pracas: readonly Praca[], numerada: boolean | null, gratuito: boolean | null): Passo[] {
  const lista: Passo[] = [{ id: "perfil", praca: 0 }, { id: "nome", praca: 0 }];
  const cidades = pracasEfetivas(perfil, pracas.length ? pracas : [praca()]);
  cidades.forEach((_, i) => {
    lista.push({ id: "onde", praca: i });
    if (i === 0 && perfil === "espaco") lista.push({ id: "evento", praca: 0 });
    lista.push({ id: "data", praca: i });
    if (perfil === "turne") lista.push({ id: "outra", praca: i });
  });
  for (const id of ["horario", "numerada", "lugares", ...(numerada ? ["auditorio"] : []), "gratuito", ...(gratuito === true ? [] : ["preco", "meia"]), "venda"] as PassoId[]) lista.push({ id, praca: 0 });
  return lista;
}

/** O mapa de assentos tem até 60 fileiras de 80 lugares: 4.800 (o banco ainda guarda um teto de 5.000 por setor, que o formato não deixa chegar). */
export const MAX_LUGARES_NUMERADOS = MAX_FILEIRAS * MAX_LUGARES_NA_FILEIRA;

export const UFS_DO_COMECAR = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

/** Data de hoje em Brasília (AAAA-MM-DD), a mesma conta do banco. */
export function hojeEmBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

/** Reais digitados ("59,90", "60", "1.200,50") em centavos; null se não for um valor. */
export function centavosDe(texto: string): number | null {
  const limpo = texto.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(limpo)) return null;
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const valor = Math.round(Number(normal) * 100);
  return Number.isFinite(valor) ? valor : null;
}

const inteiro = (texto: string) => (/^\d+$/.test(texto.trim()) ? Number(texto.trim()) : null);

/** A mensagem do primeiro campo a acertar no passo, ou null quando dá para seguir. */
export function conferirPasso(passo: Passo, r: RespostasDoComecar, hoje: string = hojeEmBrasilia()): string | null {
  const id = passo.id;
  if (id === "perfil") return r.perfil ? null : "Escolha uma opção para continuar";
  if (!r.perfil) return "Escolha como você trabalha";
  const cidade = r.pracas[passo.praca] ?? praca();
  if (id === "nome") {
    const nome = (r.perfil === "espaco" ? r.pracas[0]?.lugar ?? "" : r.evento).trim();
    if (!nome) return r.perfil === "espaco" ? "Diga o nome do espaço" : "Dê um nome ao evento";
    if (nome.length > 200) return "O nome pode ter até 200 caracteres";
    return null;
  }
  if (id === "onde") {
    if (!UFS_DO_COMECAR.includes(cidade.uf)) return "Escolha o estado no mapa";
    if (!cidade.cidade.trim()) return "Escolha ou digite a cidade";
    if (cidade.cidade.trim().length > 120) return "O nome da cidade pode ter até 120 caracteres";
    if (cidade.lugar.trim().length > 200) return "O nome do lugar pode ter até 200 caracteres";
    return null;
  }
  if (id === "evento") {
    if (!r.evento.trim()) return "Dê um nome ao primeiro evento";
    if (r.evento.trim().length > 200) return "O nome pode ter até 200 caracteres";
    return null;
  }
  if (id === "data") {
    if (cidade.datas.length === 0) return r.perfil === "turne" ? "Escolha pelo menos um dia nessa cidade" : "Escolha pelo menos um dia";
    if (cidade.datas.some(d => !/^\d{4}-\d{2}-\d{2}$/.test(d))) return "Escolha o dia";
    if (cidade.datas.some(d => d < hoje)) return "Esse dia já passou";
    if (cidade.datas.length > MAX_DATAS_POR_PRACA) return "São no máximo 60 dias por cidade";
    if (totalDeSessoes(r) > MAX_SESSOES) return "São no máximo 200 datas no total";
    return null;
  }
  if (id === "outra") return cidade.outra === null ? "Escolha sim ou não" : cidade.outra && passo.praca + 1 >= MAX_PRACAS ? "São no máximo 20 cidades" : null;
  if (id === "horario") return /^\d{2}:\d{2}$/.test(r.hora) ? null : "Escolha o horário";
  if (id === "numerada") return r.numerada === null ? "Escolha sim ou não" : null;
  if (id === "lugares") {
    const lugares = inteiro(r.lugares);
    if (!lugares || lugares < 1) return "Diga quantos lugares há";
    if (lugares > 200000) return "São no máximo 200.000 lugares";
    if (r.numerada && lugares > MAX_LUGARES_NUMERADOS) return "Com lugares numerados, o máximo são 4.800 lugares";
    return null;
  }
  if (id === "auditorio") {
    if (!r.mapa || r.mapa.length === 0) return "Monte pelo menos uma fileira";
    if (r.mapa.length > MAX_FILEIRAS) return "São no máximo 60 fileiras";
    const resumo = resumoDoMapa(r.mapa);
    if (resumo.lugares > MAX_LUGARES_NO_SETOR) return "São no máximo 5.000 lugares no setor";
    if (resumo.aVenda < 1) return "Deixe pelo menos um lugar à venda";
    return null;
  }
  if (id === "gratuito") return r.gratuito === null ? "Escolha sim ou não" : null;
  if (id === "meia") return r.meia === null ? "Escolha sim ou não" : null;
  if (id === "venda") return r.venda === null ? "Escolha uma opção" : null;
  const centavos = centavosDe(r.preco);
  if (centavos === null || centavos <= 0) return "Diga o preço da inteira";
  if (centavos > 10000000) return "O preço pode ir até R$ 100.000";
  return null;
}

/** Quantas sessões (datas em cidades) o evento vai ter. */
export const totalDeSessoes = (r: RespostasDoComecar) => pracasEfetivas(r.perfil, r.pracas).reduce((t, p) => t + p.datas.length, 0);

/** O nome do local que vai para o banco: o do espaço, o do lugar (se a pessoa disse) ou, na falta dele, a cidade. */
export const nomeDoLocal = (p: Praca) => p.lugar.trim() || p.cidade.trim();

/** "Teatro Municipal, Sorocaba, SP" para a tela final. */
export function ondeDaPraca(p: Praca): string {
  const lugar = p.lugar.trim();
  const cidade = [p.cidade.trim(), p.uf].filter(Boolean).join(", ");
  return lugar && lugar !== p.cidade.trim() ? `${lugar}, ${cidade}` : cidade;
}

/** Como o banco divide os lugares: 40% meia (Lei 12.933/2013) e o resto inteira; sem meia abaixo de 3 lugares ou no gratuito. */
export function divisaoDosLugares(lugares: number, meia: boolean, gratuito: boolean): { inteira: number; meia: number } {
  if (gratuito || !meia || lugares < 3) return { inteira: lugares, meia: 0 };
  const m = Math.floor(lugares * 0.4);
  return { inteira: lugares - m, meia: m };
}

/** O preço da meia: metade da inteira, arredondada, nunca abaixo de 1 centavo (a mesma conta do banco). */
export const precoDaMeia = (inteira: number) => Math.max(1, Math.round(inteira / 2));

/** Quantos lugares vão à venda: com lugares numerados, os do mapa desenhado (menos as cadeiras bloqueadas); sem eles, o número digitado. */
export const lugaresParaVender = (r: RespostasDoComecar) => (r.numerada && r.mapa ? resumoDoMapa(r.mapa).aVenda : Number(r.lugares.trim()));

/** O mapa de partida do auditório (grade uniforme com a sugestão de lugares por fileira, corredor no meio), que a pessoa então edita. */
export function auditorioInicial(lugares: number): FileiraDoMapa[] {
  return mapaDoAuditorio(lugares, sugestaoPorFileira(lugares), true);
}

/** Os argumentos de fn_ticketeria_comecar_pracas. Chamar só depois de conferirPasso devolver null em todos os passos. */
export function argumentosDoComecar(organizationId: string, r: RespostasDoComecar) {
  return {
    p_org: organizationId,
    p_perfil: r.perfil as PerfilDoProdutor,
    p_evento: r.evento.trim(),
    p_pracas: pracasEfetivas(r.perfil, r.pracas).map(p => ({ local: nomeDoLocal(p), cidade: p.cidade.trim(), uf: p.uf, datas: [...new Set(p.datas)].sort() })),
    p_lugares: lugaresParaVender(r),
    p_hora: r.hora,
    p_preco_centavos: r.gratuito === true ? 0 : (centavosDe(r.preco) ?? 0),
    p_meia: r.gratuito === false && r.meia === true,
  };
}

/** Quantos lugares por fileira propor: mais largo que fundo, como um auditório (100 lugares: 16 por fileira). */
export function sugestaoPorFileira(lugares: number): number {
  if (lugares <= 6) return Math.max(1, lugares);
  const largo = Math.max(6, Math.round(Math.sqrt(lugares * 2.5)));
  return Math.min(MAX_LUGARES_NA_FILEIRA, Math.max(largo, Math.ceil(lugares / MAX_FILEIRAS)));
}

/** O auditório que a pessoa montou: fileiras A, B, C... com `porFileira` lugares; a última leva o que sobra, para o total ser exatamente `lugares`. */
export function mapaDoAuditorio(lugares: number, porFileira: number, corredor: boolean): FileiraDoMapa[] {
  const fileiras: FileiraDoMapa[] = [];
  let nome = "";
  for (let restante = lugares; restante > 0; restante -= porFileira) {
    nome = proximoNomeDeFileira(nome);
    const quantos = Math.min(porFileira, restante);
    fileiras.push({ nome, assentos: Array.from({ length: quantos }, (_, i) => ({ numero: i + 1, estado: "livre" as const })) });
  }
  return comCorredor(fileiras, corredor);
}

/** O que a função do banco devolve: o evento, e por praça o local, o setor "Geral" (para montar o mapa de assentos) e quantas sessões saíram. */
export type PracaCriada = { local_id: string; setor_id: string; setor_lugares: number; setor_numerado: boolean; sessoes: number; inteira: number; meia: number };
export type ResultadoDoComecar = { loja_id: string; evento_id: string; sessoes: number; pracas: PracaCriada[] };

const ERROS: Record<string, string> = {
  sem_permissao: "Só quem edita a Ticketeria pode criar eventos. Peça a quem administra a organização.",
  data_no_passado: "A data já passou. Escolha outra.",
  perfil_invalido: "Escolha como você trabalha.",
  evento_sem_nome: "Dê um nome ao evento.",
  local_sem_nome: "Diga onde vai ser.",
  lugares_invalidos: "Diga quantos lugares há.",
  sem_data: "Escolha a data e o horário.",
  preco_invalido: "Confira o preço.",
  cidade_sem_nome: "Escolha ou digite a cidade.",
  uf_invalida: "Escolha o estado no mapa.",
  data_repetida: "Tem um dia marcado duas vezes na mesma cidade.",
  praca_repetida: "O mesmo lugar aparece duas vezes na turnê.",
  datas_demais: "São no máximo 60 dias por cidade.",
  sessoes_demais: "São no máximo 200 datas no total.",
  pracas_invalidas: "Escolha pelo menos uma cidade (no máximo 20).",
};

export function mensagemDoErroDoComecar(erro: { message?: string } | null | undefined): string {
  const codigo = Object.keys(ERROS).find(chave => erro?.message?.includes(chave));
  return codigo ? ERROS[codigo] : "Não foi possível criar o evento. Tente de novo.";
}
