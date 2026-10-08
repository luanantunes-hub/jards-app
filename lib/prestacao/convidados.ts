// Convidados da prestação (P5.3): contador, auditor ou patrocinador, de fora
// da equipe, com acesso por convite, limitado por seção e com validade. Aqui
// ficam os rótulos, a situação do convite, a conferência do formulário, o que
// cada seção mostra ao convidado e o estado de "verificado" tirado das notas.
// Sem React e sem Supabase.

import { rotuloDoTipo as rotuloDaEvidencia } from "./evidencias";
import { rotuloDaDestinacao, rotuloDoTipoBem } from "./bens";

export type SecaoDoConvite = "financeiro" | "objeto" | "envio";
export type PapelDoConvidado = "contador" | "auditor" | "patrocinador" | "outro";

export const SECOES_DO_CONVITE: readonly { id: SecaoDoConvite; rotulo: string; descricao: string }[] = [
  { id: "financeiro", rotulo: "Financeiro", descricao: "Orçamento, despesas, pagamentos, extrato e devoluções" },
  { id: "objeto", rotulo: "Objeto", descricao: "Metas, atividades, evidências, bens e divulgação" },
  { id: "envio", rotulo: "Envio", descricao: "Arquivos e envios registrados, diligências, decisões, glosas e recursos" },
];

export const PAPEIS_DO_CONVIDADO: readonly { id: PapelDoConvidado; rotulo: string }[] = [
  { id: "contador", rotulo: "Contabilidade" },
  { id: "auditor", rotulo: "Auditoria" },
  { id: "patrocinador", rotulo: "Patrocínio" },
  { id: "outro", rotulo: "Outro" },
];

export const rotuloDoPapel = (id: string) => PAPEIS_DO_CONVIDADO.find(p => p.id === id)?.rotulo ?? id;
export const rotuloDaSecao = (id: string) => SECOES_DO_CONVITE.find(s => s.id === id)?.rotulo ?? id;

/** "Financeiro", "Financeiro e objeto", "Financeiro, objeto e envio", na ordem das seções. */
export function textoDasSecoes(secoes: readonly string[]): string {
  const nomes = SECOES_DO_CONVITE.filter(s => secoes.includes(s.id)).map((s, i) => (i === 0 ? s.rotulo : s.rotulo.toLowerCase()));
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const reais = (v: unknown) =>
  (v === null || v === undefined || v === "" ? "" : (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

// ─── O convite, do lado da equipe ───────────────────────────────────────────

export type ConvidadoDaPrestacao = {
  id: string;
  email: string;
  nome: string | null;
  papel: PapelDoConvidado;
  secoes: SecaoDoConvite[];
  expira_em: string;
  aceito_em: string | null;
  ultimo_acesso_em: string | null;
  revogado_em: string | null;
  created_at: string;
};

export type SituacaoDoConvite = "pendente" | "ativo" | "expirado" | "revogado";

export function situacaoDoConvite(c: Pick<ConvidadoDaPrestacao, "revogado_em" | "expira_em" | "aceito_em">, hoje: string): SituacaoDoConvite {
  if (c.revogado_em) return "revogado";
  if (c.expira_em < hoje) return "expirado";
  return c.aceito_em ? "ativo" : "pendente";
}

export const ROTULO_DA_SITUACAO_DO_CONVITE: Record<SituacaoDoConvite, { rotulo: string; cor: string }> = {
  pendente: { rotulo: "Aguardando aceite", cor: "#B07A14" },
  ativo: { rotulo: "Ativo", cor: "#2E8932" },
  expirado: { rotulo: "Vencido", cor: "#6B6B6B" },
  revogado: { rotulo: "Revogado", cor: "#6B6B6B" },
};

export const nomeDoConvidado = (c: Pick<ConvidadoDaPrestacao, "nome" | "email">) => c.nome?.trim() || c.email;

export const enderecoDoConvite = (origem: string, token: string) => `${origem.replace(/\/$/, "")}/convite/${token}`;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** O que o formulário do convite confere antes de chamar o banco (que confere de novo). */
export function erroDoConvite(
  c: { email: string; nome: string; secoes: readonly string[]; expiraEm: string; mensagem: string },
  hoje: string,
): string | null {
  const email = c.email.trim();
  if (!EMAIL.test(email) || email.length > 320) return "Informe um e-mail válido.";
  const nome = c.nome.trim();
  if (nome && (nome.length < 2 || nome.length > 200)) return "O nome tem de 2 a 200 caracteres.";
  if (!c.secoes.some(s => SECOES_DO_CONVITE.some(x => x.id === s))) return "Escolha ao menos uma seção.";
  if (!c.expiraEm || c.expiraEm <= hoje) return "A validade precisa ser uma data futura.";
  const umAno = new Date(`${hoje}T12:00:00Z`);
  umAno.setUTCDate(umAno.getUTCDate() + 366);
  if (c.expiraEm > umAno.toISOString().slice(0, 10)) return "A validade vai até um ano.";
  if (c.mensagem.length > 2000) return "A mensagem tem até 2.000 caracteres.";
  return null;
}

// ─── As notas: comentários e marcas de verificado ───────────────────────────

export type TipoDeItem =
  | "prestacao"
  | "despesa" | "pagamento" | "lancamento" | "devolucao" | "orcamento_no"
  | "meta" | "atividade" | "evidencia" | "bem" | "peca" | "distribuicao"
  | "checklist" | "envio_arquivo" | "envio" | "diligencia" | "decisao" | "glosa" | "recurso";

export type NotaDoConvidado = {
  id: string;
  convidado_id: string;
  entidade_tipo: TipoDeItem;
  entidade_id: string;
  tipo: "comentario" | "verificado" | "desmarcado";
  texto: string | null;
  created_at: string;
};

export const chaveDoItem = (tipo: string, id: string) => `${tipo}:${id}`;

export type EstadoDoItem = { verificadoEm: string | null; comentarios: NotaDoConvidado[] };

/**
 * Estado de cada item pelas notas de um convidado: a última marca vale
 * (verificado ou desmarcado) e os comentários ficam em ordem.
 */
export function estadoDosItens(notas: readonly NotaDoConvidado[]): Map<string, EstadoDoItem> {
  const estado = new Map<string, EstadoDoItem>();
  for (const n of [...notas].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const chave = chaveDoItem(n.entidade_tipo, n.entidade_id);
    const item = estado.get(chave) ?? { verificadoEm: null, comentarios: [] };
    if (n.tipo === "verificado") item.verificadoEm = n.created_at;
    else if (n.tipo === "desmarcado") item.verificadoEm = null;
    else item.comentarios.push(n);
    estado.set(chave, item);
  }
  return estado;
}

/** Quantos itens da lista estão verificados. */
export const verificadosDaLista = (itens: readonly { tipo: string; id: string }[], estado: Map<string, EstadoDoItem>) =>
  itens.filter(i => estado.get(chaveDoItem(i.tipo, i.id))?.verificadoEm).length;

export const ROTULO_DO_ITEM: Record<TipoDeItem, string> = {
  prestacao: "Prestação",
  despesa: "Despesa",
  pagamento: "Pagamento",
  lancamento: "Lançamento do extrato",
  devolucao: "Devolução",
  orcamento_no: "Item do orçamento",
  meta: "Meta",
  atividade: "Atividade",
  evidencia: "Evidência",
  bem: "Bem",
  peca: "Peça de divulgação",
  distribuicao: "Distribuição",
  checklist: "Item do checklist",
  envio_arquivo: "Arquivo do envio",
  envio: "Envio",
  diligencia: "Diligência",
  decisao: "Decisão",
  glosa: "Glosa",
  recurso: "Recurso",
};

export function textoDaNota(n: Pick<NotaDoConvidado, "tipo" | "texto">): string {
  if (n.tipo === "verificado") return "marcou como verificado";
  if (n.tipo === "desmarcado") return "desfez a marca de verificado";
  return `comentou: ${n.texto ?? ""}`;
}

/** Histórico dos convidados na prestação, do mais recente para o mais antigo. */
export type EventoDoConvidado = {
  em: string;
  convidadoId: string;
  tipo: "convidado" | "aceitou" | "revogado" | "nota";
  nota?: NotaDoConvidado;
};

export function historicoDosConvidados(convidados: readonly ConvidadoDaPrestacao[], notas: readonly NotaDoConvidado[]): EventoDoConvidado[] {
  const eventos: EventoDoConvidado[] = [];
  for (const c of convidados) {
    eventos.push({ em: c.created_at, convidadoId: c.id, tipo: "convidado" });
    if (c.aceito_em) eventos.push({ em: c.aceito_em, convidadoId: c.id, tipo: "aceitou" });
    if (c.revogado_em) eventos.push({ em: c.revogado_em, convidadoId: c.id, tipo: "revogado" });
  }
  for (const n of notas) eventos.push({ em: n.created_at, convidadoId: n.convidado_id, tipo: "nota", nota: n });
  return eventos.sort((a, b) => b.em.localeCompare(a.em));
}

// ─── O que o convidado vê em cada seção ─────────────────────────────────────

/** Uma linha das listas do convidado: o que mostrar e onde está o arquivo. */
export type ItemDoConvidado = {
  tipo: TipoDeItem;
  id: string;
  titulo: string;
  detalhes: string[];
  valor?: string;
  arquivo?: { path: string; nome: string } | null;
  link?: string | null;
};

type Linha = Record<string, unknown>;
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v));
const arquivo = (path: unknown, nome: unknown) => (texto(path) ? { path: texto(path), nome: texto(nome) || "Arquivo" } : null);
const juntar = (...partes: unknown[]) => partes.map(texto).filter(Boolean);

const STATUS_DA_DESPESA: Record<string, string> = { pendente: "Em análise", aceito: "Aceita", rejeitado: "Rejeitada" };
const FORMA_DE_PAGAMENTO: Record<string, string> = { pix: "Pix", ted: "TED", boleto: "Boleto", cartao: "Cartão", cheque: "Cheque", dinheiro: "Dinheiro", debito: "Débito em conta", outro: "Outro" };
const MOTIVO_DA_DEVOLUCAO: Record<string, string> = { saldo: "Saldo não utilizado", rendimento: "Rendimentos da aplicação", glosa: "Despesa glosada", reprovacao: "Reprovação das contas", outro: "Outro motivo" };
const SITUACAO_DA_DILIGENCIA: Record<string, string> = { aberta: "Aberta", respondida: "Respondida", encerrada: "Encerrada" };
const RESULTADO_DA_DECISAO: Record<string, string> = { aprovada: "Aprovada", aprovada_ressalvas: "Aprovada com ressalvas", aprovada_parcialmente: "Aprovada parcialmente", reprovada: "Reprovada" };
const SITUACAO_DO_RECURSO: Record<string, string> = { em_analise: "Em análise", deferido: "Deferido", parcialmente_deferido: "Deferido em parte", indeferido: "Indeferido" };
const ETAPA: Record<string, string> = { final: "Prestação final", parcial: "Prestação parcial" };
const APROVACAO_DA_PECA: Record<string, string> = { nao_enviada: "Não enviada", enviada: "Enviada, aguardando", aprovada: "Aprovada", reprovada: "Recusada" };

export type ListaDoConvidado = {
  tipo: TipoDeItem;
  titulo: string;
  vazia: string;
  tabela: string;
  campos: string;
  ordem: { coluna: string; crescente: boolean };
  /** Filtro extra além da prestação (o orçamento mostra só a versão em uso). */
  filtro?: { coluna: string; valor: string | boolean };
  item: (linha: Linha) => ItemDoConvidado;
};

export const LISTAS_DO_CONVIDADO: Record<SecaoDoConvite, ListaDoConvidado[]> = {
  financeiro: [
    {
      tipo: "despesa", titulo: "Despesas", vazia: "Nenhuma despesa lançada.",
      tabela: "prestacao_comprovantes",
      campos: "id, nome_arquivo, storage_path, valor_extraido, valor_liquido, data_doc, status, numero_documento, descricao_servico, fornecedor:fornecedor_id(nome, documento)",
      ordem: { coluna: "data_doc", crescente: true },
      item: l => {
        const fornecedor = (l.fornecedor ?? null) as { nome?: string; documento?: string } | null;
        return {
          tipo: "despesa", id: texto(l.id),
          titulo: texto(fornecedor?.nome) || texto(l.descricao_servico) || texto(l.nome_arquivo) || "Despesa",
          detalhes: juntar(l.numero_documento ? `Documento ${texto(l.numero_documento)}` : "", dataBr(texto(l.data_doc)), fornecedor ? l.descricao_servico : "", STATUS_DA_DESPESA[texto(l.status)] ?? ""),
          valor: reais(l.valor_extraido),
          arquivo: arquivo(l.storage_path, l.nome_arquivo),
        };
      },
    },
    {
      tipo: "pagamento", titulo: "Pagamentos", vazia: "Nenhum pagamento registrado.",
      tabela: "prestacao_pagamentos",
      campos: "id, forma, data, valor, favorecido_nome, favorecido_documento, numero_documento",
      ordem: { coluna: "data", crescente: true },
      item: l => ({
        tipo: "pagamento", id: texto(l.id),
        titulo: texto(l.favorecido_nome) || "Pagamento",
        detalhes: juntar(FORMA_DE_PAGAMENTO[texto(l.forma)] ?? l.forma, dataBr(texto(l.data)), l.numero_documento ? `Documento ${texto(l.numero_documento)}` : ""),
        valor: reais(l.valor),
      }),
    },
    {
      tipo: "lancamento", titulo: "Extrato", vazia: "Nenhum extrato importado.",
      tabela: "prestacao_lancamentos",
      campos: "id, data, natureza, valor, historico, numero_documento",
      ordem: { coluna: "data", crescente: true },
      item: l => ({
        tipo: "lancamento", id: texto(l.id),
        titulo: texto(l.historico) || "Lançamento",
        detalhes: juntar(dataBr(texto(l.data)), l.natureza === "credito" ? "Crédito" : "Débito", l.numero_documento ? `Documento ${texto(l.numero_documento)}` : ""),
        valor: reais(l.valor),
      }),
    },
    {
      tipo: "devolucao", titulo: "Devoluções", vazia: "Nenhuma devolução.",
      tabela: "prestacao_devolucoes",
      campos: "id, motivo, descricao, valor_principal, valor_atualizado, situacao, vencimento, pago_em, storage_path, nome_arquivo",
      ordem: { coluna: "ordem", crescente: true },
      item: l => ({
        tipo: "devolucao", id: texto(l.id),
        titulo: MOTIVO_DA_DEVOLUCAO[texto(l.motivo)] ?? texto(l.motivo),
        detalhes: juntar(l.descricao, l.situacao === "paga" ? `Paga em ${dataBr(texto(l.pago_em))}` : l.vencimento ? `Vence em ${dataBr(texto(l.vencimento))}` : "A pagar"),
        valor: reais(l.valor_atualizado ?? l.valor_principal),
        arquivo: arquivo(l.storage_path, l.nome_arquivo),
      }),
    },
    {
      tipo: "orcamento_no", titulo: "Orçamento em uso", vazia: "Sem orçamento lançado.",
      tabela: "prestacao_orcamento_nos",
      campos: "id, codigo, nome, tipo, quantidade, unidade, valor_total, versao:versao_id!inner(ativa)",
      ordem: { coluna: "ordem", crescente: true },
      filtro: { coluna: "versao.ativa", valor: true },
      item: l => ({
        tipo: "orcamento_no", id: texto(l.id),
        titulo: juntar(l.codigo, l.nome).join(" · ") || "Item",
        detalhes: l.tipo === "item" ? juntar(l.quantidade ? `${texto(l.quantidade)} ${texto(l.unidade)}`.trim() : "") : ["Grupo"],
        valor: l.tipo === "item" ? reais(l.valor_total) : "",
      }),
    },
  ],
  objeto: [
    {
      tipo: "meta", titulo: "Metas", vazia: "Nenhuma meta lançada.",
      tabela: "prestacao_metas",
      campos: "id, descricao, unidade, previsto, realizado, justificativa",
      ordem: { coluna: "ordem", crescente: true },
      item: l => ({
        tipo: "meta", id: texto(l.id),
        titulo: texto(l.descricao) || "Meta",
        detalhes: juntar(`Previsto: ${texto(l.previsto) || "—"} ${texto(l.unidade)}`.trim(), `Realizado: ${texto(l.realizado) || "—"}`, l.justificativa),
      }),
    },
    {
      tipo: "atividade", titulo: "Atividades", vazia: "Nenhuma atividade lançada.",
      tabela: "prestacao_atividades",
      campos: "id, titulo, data_realizacao, local, cidade, estado, status_realizacao, publico_atingido, justificativa_nao_realizacao",
      ordem: { coluna: "data_realizacao", crescente: true },
      item: l => ({
        tipo: "atividade", id: texto(l.id),
        titulo: texto(l.titulo) || "Atividade",
        detalhes: juntar(dataBr(texto(l.data_realizacao)), juntar(l.local, l.cidade, l.estado).join(", "),
          l.status_realizacao === "nao_realizado" ? `Não realizada${l.justificativa_nao_realizacao ? `: ${texto(l.justificativa_nao_realizacao)}` : ""}` : "Realizada",
          l.publico_atingido ? `Público: ${texto(l.publico_atingido)}` : ""),
      }),
    },
    {
      tipo: "evidencia", titulo: "Evidências", vazia: "Nenhuma evidência anexada.",
      tabela: "prestacao_evidencias",
      campos: "id, tipo, descricao, nome_arquivo, storage_path, url, capturada_em",
      ordem: { coluna: "created_at", crescente: true },
      item: l => ({
        tipo: "evidencia", id: texto(l.id),
        titulo: texto(l.descricao) || texto(l.nome_arquivo) || rotuloDaEvidencia(texto(l.tipo)),
        detalhes: juntar(rotuloDaEvidencia(texto(l.tipo)), l.capturada_em ? `Captada em ${dataBr(texto(l.capturada_em))}` : ""),
        arquivo: arquivo(l.storage_path, l.nome_arquivo),
        link: texto(l.url) || null,
      }),
    },
    {
      tipo: "bem", titulo: "Bens", vazia: "Nenhum bem registrado.",
      tabela: "prestacao_bens",
      campos: "id, tipo, descricao, quantidade, valor, destinacao, beneficiario",
      ordem: { coluna: "ordem", crescente: true },
      item: l => ({
        tipo: "bem", id: texto(l.id),
        titulo: texto(l.descricao) || "Bem",
        detalhes: juntar(rotuloDoTipoBem(texto(l.tipo)), l.quantidade ? `${texto(l.quantidade)} un.` : "", rotuloDaDestinacao(texto(l.destinacao) || null), l.beneficiario),
        valor: reais(l.valor),
      }),
    },
    {
      tipo: "peca", titulo: "Divulgação", vazia: "Nenhuma peça registrada.",
      tabela: "prestacao_pecas",
      campos: "id, tipo, titulo, meio, veiculacao_inicio, veiculacao_fim, aprovacao_status, storage_path, nome_arquivo, url",
      ordem: { coluna: "ordem", crescente: true },
      item: l => ({
        tipo: "peca", id: texto(l.id),
        titulo: texto(l.titulo) || "Peça",
        detalhes: juntar(l.meio, l.veiculacao_inicio ? `Veiculação ${dataBr(texto(l.veiculacao_inicio))}${l.veiculacao_fim ? ` a ${dataBr(texto(l.veiculacao_fim))}` : ""}` : "",
          APROVACAO_DA_PECA[texto(l.aprovacao_status)] ?? ""),
        arquivo: arquivo(l.storage_path, l.nome_arquivo),
        link: texto(l.url) || null,
      }),
    },
    {
      tipo: "distribuicao", titulo: "Distribuição", vazia: "Nenhuma distribuição lançada.",
      tabela: "prestacao_distribuicao",
      campos: "id, produto, categoria, quantidade, quantidade_realizada, beneficiario",
      ordem: { coluna: "ordem", crescente: true },
      item: l => ({
        tipo: "distribuicao", id: texto(l.id),
        titulo: juntar(l.produto, l.categoria).join(" · ") || "Distribuição",
        detalhes: juntar(`Previsto: ${texto(l.quantidade) || "—"}`, `Realizado: ${texto(l.quantidade_realizada) || "—"}`, l.beneficiario),
      }),
    },
  ],
  envio: [
    {
      tipo: "envio", titulo: "Envios registrados", vazia: "Nenhum envio registrado.",
      tabela: "prestacao_envios",
      campos: "id, etapa, versao, enviado_em, protocolo, sistema, situacao",
      ordem: { coluna: "registrado_em", crescente: true },
      item: l => ({
        tipo: "envio", id: texto(l.id),
        titulo: `${ETAPA[texto(l.etapa)] ?? texto(l.etapa)}${Number(l.versao) > 1 ? `, versão ${texto(l.versao)}` : ""}`,
        detalhes: juntar(`Enviado em ${dataBr(texto(l.enviado_em))}`, l.protocolo, l.sistema, l.situacao === "reaberto" ? "Reaberto" : ""),
      }),
    },
    {
      tipo: "envio_arquivo", titulo: "Arquivos do envio", vazia: "Nenhum arquivo anexado ao envio.",
      tabela: "prestacao_envio_arquivos",
      campos: "id, etapa, codigo, nome_arquivo, storage_path",
      ordem: { coluna: "created_at", crescente: true },
      item: l => ({
        tipo: "envio_arquivo", id: texto(l.id),
        titulo: texto(l.nome_arquivo) || "Arquivo",
        detalhes: juntar(ETAPA[texto(l.etapa)] ?? l.etapa),
        arquivo: arquivo(l.storage_path, l.nome_arquivo),
      }),
    },
    {
      tipo: "diligencia", titulo: "Diligências", vazia: "Nenhuma diligência recebida.",
      tabela: "prestacao_diligencias",
      campos: "id, numero, recebida_em, prazo, descricao, situacao, respondida_em, documento_path, documento_nome",
      ordem: { coluna: "recebida_em", crescente: true },
      item: l => ({
        tipo: "diligencia", id: texto(l.id),
        titulo: texto(l.descricao) || `Diligência${l.numero ? ` ${texto(l.numero)}` : ""}`,
        detalhes: juntar(`Recebida em ${dataBr(texto(l.recebida_em))}`, l.prazo ? `Prazo ${dataBr(texto(l.prazo))}` : "", SITUACAO_DA_DILIGENCIA[texto(l.situacao)] ?? ""),
        arquivo: arquivo(l.documento_path, l.documento_nome),
      }),
    },
    {
      tipo: "decisao", titulo: "Decisões", vazia: "Nenhuma decisão registrada.",
      tabela: "prestacao_decisoes",
      campos: "id, resultado, registrada_em, valor_glosado, resumo, documento_path, documento_nome",
      ordem: { coluna: "registrada_em", crescente: true },
      item: l => ({
        tipo: "decisao", id: texto(l.id),
        titulo: RESULTADO_DA_DECISAO[texto(l.resultado)] ?? texto(l.resultado),
        detalhes: juntar(`Registrada em ${dataBr(texto(l.registrada_em))}`, l.resumo),
        valor: Number(l.valor_glosado) ? `Glosa de ${reais(l.valor_glosado)}` : "",
        arquivo: arquivo(l.documento_path, l.documento_nome),
      }),
    },
    {
      tipo: "glosa", titulo: "Glosas", vazia: "Nenhuma glosa.",
      tabela: "prestacao_glosas",
      campos: "id, descricao, valor, situacao",
      ordem: { coluna: "created_at", crescente: true },
      item: l => ({
        tipo: "glosa", id: texto(l.id),
        titulo: texto(l.descricao) || "Glosa",
        detalhes: juntar(l.situacao === "revertida" ? "Revertida" : "Mantida"),
        valor: reais(l.valor),
      }),
    },
    {
      tipo: "recurso", titulo: "Recursos", vazia: "Nenhum recurso.",
      tabela: "prestacao_recursos",
      campos: "id, protocolado_em, pedido, situacao, decidido_em, documento_path, documento_nome",
      ordem: { coluna: "protocolado_em", crescente: true },
      item: l => ({
        tipo: "recurso", id: texto(l.id),
        titulo: texto(l.pedido) || "Recurso",
        detalhes: juntar(`Protocolado em ${dataBr(texto(l.protocolado_em))}`, SITUACAO_DO_RECURSO[texto(l.situacao)] ?? ""),
        arquivo: arquivo(l.documento_path, l.documento_nome),
      }),
    },
  ],
};

/** A lista de um tipo de item (para a equipe dar nome aos itens das notas). */
export const listaDoTipo = (tipo: string) =>
  Object.values(LISTAS_DO_CONVIDADO).flat().find(l => l.tipo === tipo) ?? null;
