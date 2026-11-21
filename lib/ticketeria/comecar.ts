// O onboarding da Ticketeria ("Começar"): o produtor diz como trabalha, responde uma pergunta por tela (nome, lugar no mapa, quando
// e preço) e sai com o primeiro evento pronto, em rascunho. Quem cria tudo é o banco, numa só chamada (fn_ticketeria_comecar, migration ticketeria_comecar); aqui
// fica o que a tela precisa antes de chamar: as perguntas por perfil, a conferência dos campos, a divisão da meia-entrada
// (a mesma conta do banco) e as mensagens de erro. Sem imports de servidor: roda nos testes (tests/ticketeria-comecar.test.ts).

export type PerfilDoProdutor = "espaco" | "turne" | "unico" | "festival";

export const PERFIS: readonly PerfilDoProdutor[] = ["espaco", "turne", "unico", "festival"];

/** As perguntas de cada perfil, passo a passo: o nome, o lugar e o quando. Cada tela pergunta uma coisa só. */
export const PERFIL: Record<PerfilDoProdutor, {
  titulo: string; descricao: string;
  /** Ilustração do cartão (public/ilustracoes/ticketeria); sem ela, a tela usa um ícone. */
  ilustracao: string | null;
  nome: { pergunta: string; apoio: string; rotulo: string; exemplo: string };
  onde: { pergunta: string; apoio: string; rotuloDoLugar: string; exemploDoLugar: string };
  quando: { pergunta: string; apoio: string; rotuloDaData: string };
}> = {
  espaco: {
    titulo: "Tenho um espaço", descricao: "Teatro, casa de show, galeria. Vários eventos no mesmo lugar.",
    ilustracao: "/ilustracoes/ticketeria/perfil-espaco.webp",
    nome: { pergunta: "Como se chama o seu espaço?", apoio: "O nome do lugar que aparece nos ingressos.", rotulo: "Nome do espaço", exemplo: "Teatro Municipal" },
    onde: { pergunta: "Onde fica o seu espaço?", apoio: "Escolha o estado no mapa e depois a cidade.", rotuloDoLugar: "", exemploDoLugar: "" },
    quando: { pergunta: "Qual é o primeiro evento?", apoio: "Nome, data e quantos lugares. O resto você ajusta depois.", rotuloDaData: "Primeira data" },
  },
  turne: {
    titulo: "Circulo com um espetáculo", descricao: "A mesma obra em várias cidades e datas.",
    ilustracao: "/ilustracoes/ticketeria/perfil-turne.webp",
    nome: { pergunta: "Qual é o espetáculo?", apoio: "O nome que as pessoas vão ver no ingresso.", rotulo: "Nome do espetáculo", exemplo: "O Auto da Compadecida" },
    onde: { pergunta: "Onde é a primeira data?", apoio: "Escolha o estado no mapa e depois a cidade.", rotuloDoLugar: "Nome do lugar (se quiser)", exemploDoLugar: "Teatro Guaíra" },
    quando: { pergunta: "Quando é a primeira data?", apoio: "Data, horário e quantos lugares.", rotuloDaData: "Primeira data" },
  },
  unico: {
    titulo: "Faço um evento único", descricao: "Uma festa, um show, uma palestra.",
    ilustracao: "/ilustracoes/ticketeria/perfil-unico.webp",
    nome: { pergunta: "Como se chama o seu evento?", apoio: "O nome que as pessoas vão ver no ingresso.", rotulo: "Nome do evento", exemplo: "Show de lançamento" },
    onde: { pergunta: "Onde vai ser?", apoio: "Escolha o estado no mapa e depois a cidade.", rotuloDoLugar: "Nome do lugar (se quiser)", exemploDoLugar: "Casa de Cultura" },
    quando: { pergunta: "Quando vai ser?", apoio: "Data, horário e quantos lugares.", rotuloDaData: "Quando" },
  },
  festival: {
    titulo: "Organizo um festival", descricao: "Vários dias ou atrações, no mesmo lugar.",
    ilustracao: "/ilustracoes/ticketeria/perfil-festival.webp",
    nome: { pergunta: "Como se chama o festival?", apoio: "O nome que as pessoas vão ver no ingresso.", rotulo: "Nome do festival", exemplo: "Festival de Inverno" },
    onde: { pergunta: "Onde vai ser?", apoio: "Escolha o estado no mapa e depois a cidade.", rotuloDoLugar: "Nome do lugar (se quiser)", exemploDoLugar: "Parque da Cidade" },
    quando: { pergunta: "Quando começa?", apoio: "Primeiro dia, horário, quantos dias e quantos lugares.", rotuloDaData: "Primeiro dia" },
  },
};

export type RespostasDoComecar = {
  perfil: PerfilDoProdutor | null;
  evento: string;
  /** O nome do espaço (perfil "espaço") ou do lugar do evento (os outros, opcional). */
  lugar: string;
  uf: string;
  cidade: string;
  lugares: string;
  data: string; // AAAA-MM-DD
  hora: string; // HH:MM
  dias: string;
  gratuito: boolean;
  preco: string; // em reais, como digitado ("60" ou "59,90")
  meia: boolean;
};

export const RESPOSTAS_VAZIAS: RespostasDoComecar = {
  perfil: null, evento: "", lugar: "", uf: "", cidade: "", lugares: "", data: "", hora: "20:00", dias: "2", gratuito: false, preco: "", meia: true,
};

/** Os cinco passos com perguntas, uma coisa por tela (depois vem o evento pronto). */
export type PassoDoComecar = "perfil" | "nome" | "onde" | "quando" | "ingresso";
export const PASSOS_DO_COMECAR: readonly PassoDoComecar[] = ["perfil", "nome", "onde", "quando", "ingresso"];

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
export function conferirPasso(passo: PassoDoComecar, r: RespostasDoComecar, hoje: string = hojeEmBrasilia()): string | null {
  if (passo === "perfil") return r.perfil ? null : "Escolha uma opção para continuar";
  if (!r.perfil) return "Escolha como você trabalha";
  if (passo === "nome") {
    const nome = (r.perfil === "espaco" ? r.lugar : r.evento).trim();
    if (!nome) return r.perfil === "espaco" ? "Diga o nome do espaço" : "Dê um nome ao evento";
    if (nome.length > 200) return "O nome pode ter até 200 caracteres";
    return null;
  }
  if (passo === "onde") {
    if (!UFS_DO_COMECAR.includes(r.uf)) return "Escolha o estado no mapa";
    if (!r.cidade.trim()) return "Escolha ou digite a cidade";
    if (r.cidade.trim().length > 120) return "O nome da cidade pode ter até 120 caracteres";
    if (r.lugar.trim().length > 200) return "O nome do lugar pode ter até 200 caracteres";
    return null;
  }
  if (passo === "quando") {
    if (r.perfil === "espaco") {
      if (!r.evento.trim()) return "Dê um nome ao primeiro evento";
      if (r.evento.trim().length > 200) return "O nome pode ter até 200 caracteres";
    }
    const lugares = inteiro(r.lugares);
    if (!lugares || lugares < 1) return "Diga quantos lugares há";
    if (lugares > 200000) return "São no máximo 200.000 lugares";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data)) return "Escolha a data";
    if (r.data < hoje) return "A data já passou";
    if (!/^\d{2}:\d{2}$/.test(r.hora)) return "Escolha o horário";
    if (r.perfil === "festival") {
      const dias = inteiro(r.dias);
      if (!dias || dias < 1 || dias > 31) return "O festival pode ter de 1 a 31 dias";
    }
    return null;
  }
  if (r.gratuito) return null;
  const centavos = centavosDe(r.preco);
  if (centavos === null || centavos <= 0) return "Diga o preço da inteira, ou marque gratuito";
  if (centavos > 10000000) return "O preço pode ir até R$ 100.000";
  return null;
}

/** O nome do local que vai para o banco: o do espaço, o do lugar (se a pessoa disse) ou, na falta dele, a cidade. */
export const nomeDoLocal = (r: RespostasDoComecar) => r.lugar.trim() || r.cidade.trim();

/** "Teatro Municipal, Sorocaba, SP" para a tela final. */
export function ondeDoEvento(r: RespostasDoComecar): string {
  const lugar = r.lugar.trim();
  const cidade = [r.cidade.trim(), r.uf].filter(Boolean).join(", ");
  return lugar && lugar !== r.cidade.trim() ? `${lugar}, ${cidade}` : cidade;
}

/** Como o banco divide os lugares: 40% meia (Lei 12.933/2013) e o resto inteira; sem meia abaixo de 3 lugares ou no gratuito. */
export function divisaoDosLugares(lugares: number, meia: boolean, gratuito: boolean): { inteira: number; meia: number } {
  if (gratuito || !meia || lugares < 3) return { inteira: lugares, meia: 0 };
  const m = Math.floor(lugares * 0.4);
  return { inteira: lugares - m, meia: m };
}

/** O preço da meia: metade da inteira, arredondada, nunca abaixo de 1 centavo (a mesma conta do banco). */
export const precoDaMeia = (inteira: number) => Math.max(1, Math.round(inteira / 2));

/** Os argumentos de fn_ticketeria_comecar. Chamar só depois de conferirPasso devolver null nos cinco passos. O estado (uf) não vai: o banco não o recebe, a tela o grava no local depois. */
export function argumentosDoComecar(organizationId: string, r: RespostasDoComecar) {
  return {
    p_org: organizationId,
    p_perfil: r.perfil as PerfilDoProdutor,
    p_evento: r.evento.trim(),
    p_local: nomeDoLocal(r),
    p_cidade: r.cidade.trim() || null,
    p_lugares: Number(r.lugares.trim()),
    p_data: r.data,
    p_hora: r.hora,
    p_dias: r.perfil === "festival" ? Number(r.dias.trim()) : null,
    p_preco_centavos: r.gratuito ? 0 : (centavosDe(r.preco) ?? 0),
    p_meia: !r.gratuito && r.meia,
  };
}

export type ResultadoDoComecar = { loja_id: string; evento_id: string; local_id: string; sessoes: number; meia: number; inteira: number };

const ERROS: Record<string, string> = {
  sem_permissao: "Só quem edita a Ticketeria pode criar eventos. Peça a quem administra a organização.",
  data_no_passado: "A data já passou. Escolha outra.",
  perfil_invalido: "Escolha como você trabalha.",
  evento_sem_nome: "Dê um nome ao evento.",
  local_sem_nome: "Diga onde vai ser.",
  lugares_invalidos: "Diga quantos lugares há.",
  sem_data: "Escolha a data e o horário.",
  dias_invalidos: "O festival pode ter de 1 a 31 dias.",
  preco_invalido: "Confira o preço.",
};

export function mensagemDoErroDoComecar(erro: { message?: string } | null | undefined): string {
  const codigo = Object.keys(ERROS).find(chave => erro?.message?.includes(chave));
  return codigo ? ERROS[codigo] : "Não foi possível criar o evento. Tente de novo.";
}
