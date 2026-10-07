/**
 * Types do banco Jards — gerados manualmente a partir dos schemas 001–004.
 * Após conectar ao Supabase, substitua por:
 *   npx supabase gen types typescript --project-id <id> > lib/supabase/types.ts
 */
import type { MotivoLido } from "@/supabase/functions/_shared/leitura-documento";

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// ─── Enums ──────────────────────────────────────────────────────────────────

export type Papel = "admin" | "captador" | "colaborador" | "leitor";

export type Lei = "rouanet" | "esporte" | "audiovisual" | "fia" | "icms" | "iss" | "outros";

export type Prioridade = "alta" | "media" | "baixa";

/** Confiança comercial independente da prioridade operacional. */
export type PotencialFechamento = "baixo" | "medio" | "alto";

export type MeioContato =
  | "email" | "telefone" | "linkedin" | "reuniao" | "indicacao" | "outro";

// Valores padrão existem no contexto comercial, mas cada organização pode criar
// chaves adicionais sem exigir uma nova versão do frontend.
export type OrigemOportunidade = string;
export type CanalContato = string;
export type ResultadoInteracao = string;

export type TipoAtividade =
  | "email" | "telefone" | "linkedin" | "reuniao" | "evento" | "tarefa" | "outro";

export type OrigemContato =
  | "jards" | "proprio" | "indicacao" | "linkedin" | "outro";

export type StatusCaptacao =
  | "prospeccao" | "primeiro_contato" | "proposta_enviada"
  | "em_negociacao" | "aprovado" | "recusado" | "renovacao";

export type StatusEdital =
  | "interesse" | "inscrito" | "em_analise" | "aprovado" | "reprovado" | "cancelado";

export type StatusEditalInscrito =
  | "inscrito" | "em_analise" | "aprovado" | "reprovado" | "cancelado";

export type TipoTarefa =
  | "email" | "ligacao" | "reuniao" | "documento" | "followup" | "tarefa";

export type StatusTarefa = "pendente" | "em_andamento" | "concluida" | "cancelada";


// ─── CAMADA 1 — Dados Públicos ───────────────────────────────────────────────

export interface Empresa {
  id: string;
  bubble_id: string | null;
  nome: string;
  nome_uppercase: string | null;
  setor: string | null;
  cidade: string | null;
  estado: string | null;       // char(2)
  site: string | null;
  email_geral: string | null;
  telefone: string | null;
  logo_url: string | null;
  descricao: string | null;
  trimestre_1: boolean;
  trimestre_2: boolean;
  trimestre_3: boolean;
  trimestre_4: boolean;
  aporte_estimado: number | null;
  tem_detalhe: boolean;
  created_at: string;
  updated_at: string;
}

export interface Edital {
  id: string;
  empresa_id: string;
  titulo: string | null;
  data_abertura: string | null;
  data_fechamento: string | null;
  url_acesso: string | null;
  ativo: boolean;
  votos_funciona: number;
  votos_nao_funciona: number;
  created_at: string;
  updated_at: string;
}

export interface Responsavel {
  id: string;
  bubble_id: string | null;
  empresa_id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  linkedin_url: string | null;
  ordem: number;
  fonte: "proprietaria" | "comunidade";
  confianca: number;
  confirmacoes_independentes: number;
  ultima_confirmacao_em: string | null;
  votos_positivos: number;
  votos_negativos: number;
  created_at: string;
  updated_at: string;
  /** fn_responsaveis_empresa: nome mascarado e e-mail/LinkedIn ocultos enquanto a empresa não foi desbloqueada. */
  mascarado?: boolean;
}

export interface Tipologia {
  id: string;
  empresa_pub_id: string;
  musica: number;
  audiovisual: number;
  artes_cenicas: number;
  artes_visuais: number;
  artes_integradas: number;
  humanidades: number;
  patrimonio_cultural: number;
  impacto: number;
  visibilidade: number;
  institucional: number;
}

export interface InvestimentoAnual {
  id: string;
  empresa_pub_id: string;
  nome: string | null;
  ano_2020: number;
  ano_2021: number;
  ano_2022: number;
  ano_2023: number;
  ano_2024: number;
  ano_2025: number;
  diferenca: number;
}

export interface InvestimentoTrimestre {
  id: string;
  empresa_pub_id: string;
  t1: number;
  t2: number;
  t3: number;
  t4: number;
  janeiro: number;
  fevereiro: number;
  marco: number;
  abril: number;
  maio: number;
  junho: number;
  julho: number;
  agosto: number;
  setembro: number;
  outubro: number;
  novembro: number;
  dezembro: number;
}


// ─── CAMADA 1.5 — Organização (multi-tenancy) ────────────────────────────────

export interface Organization {
  id: string;
  nome: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  papel: Papel;
  created_at: string;
}


// ─── CAMADA 2 — CRM Privado ──────────────────────────────────────────────────

export type TipoProponente = "oscip" | "associacao" | "empresa" | "pessoa_fisica" | "outro" | (string & {});

export interface Proponente {
  id: string;
  account_id: string;
  organization_id: string | null;
  nome: string;
  nome_key: string | null;
  cnpj: string | null;
  tipo: TipoProponente | null;
  cidade: string | null;
  estado: string | null;
  email: string | null;
  telefone: string | null;
  site: string | null;
  descricao: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjetoCrm {
  id: string;
  account_id: string;
  organization_id: string | null;
  nome: string;
  nome_key: string | null;
  descricao: string | null;
  valor_alvo: number | null;
  valor_total: number | null;
  proponente_id: string | null;
  proponente_nome: string | null;
  proponente_cidade: string | null;
  proponente_estado: string | null;
  identidade_tipo: "padrao" | "icone" | "emoji" | "logo";
  identidade_valor: string | null;
  identidade_logo_url: string | null;
  capa_url: string | null;
  capa_position_y: number;
  fase: "planejamento" | "captacao" | "execucao" | "prestacao" | "concluido";
  ponto_focal_id: string | null;
  mecanismo: string | null;
  tipos_patrocinio: string[];
  data_inicio: string | null;
  data_fim: string | null;
  cidade: string | null;
  estado: string | null;
  abrangencia: string | null;
  areas_culturais: string[];
  valor_garantido: number;
  tags: string[];
  visibilidade: "equipe" | "restrita";
  status_operacional: "ativo" | "pausado" | "arquivado";
  status_comercial: "estruturando" | "pronto" | "em_captacao" | "captado" | "encerrado" | null;
  created_at: string;
  updated_at: string;
}

export interface CaptadorProponente {
  id: string;
  organization_id: string;
  captador_id: string;
  proponente_id: string;
  status: "ativo" | "encerrado" | "suspenso";
  data_inicio: string | null;
  data_fim: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjetoMembro {
  id: string; projeto_id: string; user_id: string; papel: string | null; created_at: string;
}
export interface ProjetoRecursoProprio {
  id: string; projeto_id: string; nome: string; valor: number; status: "previsto" | "confirmado" | "recebido"; previsao: string | null; observacao: string | null; created_at: string; updated_at: string;
}
export interface ProjetoHistorico {
  id: string; projeto_id: string; user_id: string | null; evento: string; descricao: string | null; dados: Json; created_at: string;
}
export interface ProjetoComentario {
  id: string; projeto_id: string; user_id: string; conteudo: string; created_at: string; updated_at: string;
}

export type StatusCotaPatrocinio = "disponivel" | "reservada" | "vendida";

export interface CotaPatrocinio {
  id: string;
  projeto_id: string;
  organization_id: string;
  nome: string;
  valor: number;
  valor_maximo: number | null;
  modelo: "nivel" | "produto";
  produto_nome: string | null;
  contrapartidas: string[];
  ordem: number;
  unidades: number;
  unidades_ilimitadas: boolean;
  unidades_vendidas: number;
  status: StatusCotaPatrocinio;
  captacao_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendaPatrocinio {
  id: string;
  organization_id: string;
  projeto_id: string;
  proposta_id: string | null;
  captacao_id: string | null;
  edital_user_id: string | null;
  cota_id: string | null;
  empresa_crm_id: string | null;
  empresa_id: string | null;
  quantidade: number;
  valor_vendido: number;
  vendida_em: string;
  created_by: string | null;
  created_at: string;
}

export interface ProponenteScoreCriterio {
  id: string;
  organization_id: string;
  proponente_id: string;
  nome: string;
  peso: 1 | 2 | 3;
  nota: 1 | 2 | 3 | 4 | 5 | null;
  ordem: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaptadorScoreCriterio {
  id: string;
  organization_id: string;
  captador_id: string;
  nome: string;
  peso: 1 | 2 | 3;
  nota: 1 | 2 | 3 | 4 | 5 | null;
  ordem: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type OrigemOrcamentoProjeto = "manual" | "csv";

export interface ProjetoOrcamentoItem {
  id: string;
  projeto_id: string;
  organization_id: string;
  rubrica: string;
  descricao: string | null;
  valor: number;
  origem: OrigemOrcamentoProjeto;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export interface ProjetoOrcamentoRateio {
  id: string;
  item_id: string;
  cota_id: string;
  valor: number;
  created_at: string;
}

export type StatusProposta =
  | "rascunho" | "enviada" | "visualizada"
  | "aceita" | "recusada" | "expirada" | "arquivada";

export interface SlideCapa {
  titulo?: string;
  subtitulo?: string;
  imagem_url?: string;
}

export interface SlideHistoria {
  texto?: string;
  imagens?: string[];
}

export interface SlideNumeros {
  alcance?: string;
  publico?: number;
  edicoes_anteriores?: string;
  roi_medio?: string;
}

export interface SlideContato {
  nome?: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
}

export interface Proposta {
  id: string;
  projeto_id: string;
  captacao_id: string | null;
  edital_user_id: string | null;
  cota_id: string | null;
  organization_id: string;
  titulo: string;
  valor_proposto: number | null;
  contrapartidas: string[];
  observacoes_comerciais: string | null;
  pdf_url: string | null;
  pdf_nome: string | null;
  slide_capa: SlideCapa;
  slide_historia: SlideHistoria;
  slide_numeros: SlideNumeros;
  slide_contato: SlideContato;
  status: StatusProposta;
  slug: string;
  expira_em: string | null;
  primeira_visualizacao: string | null;
  ultima_visualizacao: string | null;
  total_visualizacoes: number;
  created_at: string;
  updated_at: string;
}

export interface PropostaVisualizacao {
  id: string;
  proposta_id: string;
  visualizado_em: string;
  duracao_segundos: number | null;
  ip_hash: string | null;
  user_agent: string | null;
}

export type NotificationPriority = "baixa" | "normal" | "alta" | "critica";
export type NotificationEventStatus = "pending" | "processed" | "failed";

export interface NotificationEvent {
  id: string;
  organization_id: string | null;
  event_key: string;
  entity_type: string | null;
  entity_id: string | null;
  actor_id: string | null;
  payload: Json;
  dedupe_key: string | null;
  status: NotificationEventStatus;
  occurred_at: string;
  processed_at: string | null;
  error: string | null;
}

export interface Notificacao {
  id: string;
  account_id: string;
  organization_id: string | null;
  user_id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  link: string | null;
  event_id: string | null;
  event_key: string | null;
  categoria: string;
  prioridade: NotificationPriority;
  entity_type: string | null;
  entity_id: string | null;
  actor_id: string | null;
  dados: Json;
  dedupe_key: string | null;
  lida_em: string | null;
  arquivada_em: string | null;
  adiada_ate: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface EmpresaCrm {
  id: string;
  account_id: string;
  organization_id: string | null;
  empresa_pub_id: string | null;   // FK → empresas (opcional)
  nome: string;
  nome_key: string | null;
  setor: string | null;
  domain_key: string | null;
  site: string | null;
  tipo: 'prospect' | 'cliente_ativo' | 'ex_cliente';
  ordem: number;
  status: StatusCaptacao | null;
  responsavel_interno_id: string | null;
  potencial_relacionamento: number | null;
  potencial_justificativa: string | null;
  localizacao: string | null;
  cidades_interesse: string[];
  ja_patrocina_cultura: boolean | null;
  patrocina_cultura_com: string | null;
  ja_patrocina_esporte: boolean | null;
  patrocina_esporte_com: string | null;
  leis_que_usa: string[];
  janela_decisao: string[];
  created_at: string;
  updated_at: string;
}

export interface ContaPatrocinio {
  id: string;
  account_id: string;
  organization_id: string | null;
  empresa_crm_id: string;
  nome: string | null;
  status: 'ativa' | 'pausada' | 'encerrada';
  data_abertura: string;
  data_encerramento: string | null;
  motivo_encerramento: string | null;
  valor_total: number;
  notas: string | null;
  responsavel_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contrato {
  id: string;
  account_id: string;
  organization_id: string | null;
  conta_patrocinio_id: string;
  numero: string | null;
  titulo: string | null;
  valor: number;
  status: 'proposta' | 'assinado' | 'vigente' | 'encerrado' | 'renovado';
  data_proposta: string | null;
  data_assinatura: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  data_encerramento: string | null;
  renovacao_automatica: boolean;
  proxima_renovacao: string | null;
  notas: string | null;
  rascunho_automatico: boolean;
  origem_tipo: 'captacao' | 'inscricao' | 'manual' | null;
  captacao_id: string | null;
  edital_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParticipacaoAgenciaCliente {
  id: string;
  organization_id: string;
  account_id: string;
  conta_patrocinio_id: string;
  contrato_id: string;
  venda_id: string | null;
  captador_id: string;
  captacao_id: string | null;
  edital_user_id: string | null;
  atribuicao_id: string | null;
  papel: 'principal' | 'compartilhada' | 'originadora' | 'relacionamento' | 'apoio';
  status: 'ativa' | 'encerrada' | 'cancelada';
  percentual_comissao: number | null;
  valor_comissao: number | null;
  data_inicio: string;
  data_fim: string | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Captacao {
  id: string;
  account_id: string;
  organization_id: string | null;
  empresa_id: string | null;
  empresa_crm_id: string | null;
  edital_id: string | null;
  projeto_id: string | null;
  titulo: string | null;
  lei: Lei | null;
  valor_solicitado: number | null;
  valor_aprovado: number | null;
  status: StatusCaptacao;
  prioridade: Prioridade | null;
  potencial_fechamento: PotencialFechamento | null;
  meio_contato: MeioContato | null;
  origem_oportunidade: OrigemOportunidade | null;
  canal_planejado: CanalContato | null;
  retorno: string | null;
  captador_id: string | null;
  supervisor_id: string | null;
  contato_empresa_id: string | null;
  captador_externo_id: string | null;
  proxima_prospeccao: string | null;
  data_previsao: string | null;
  notas: string | null;
  ciclo_ano: number | null;
  ciclo_anterior_id: string | null;
  retomada_programada_em: string | null;
  ciclo_programado: number | null;
  retomada_atividade_id: string | null;
  conta_patrocinio_id: string | null;
  renovacao_id: string | null;
  contrato_origem_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contato {
  id: string;
  account_id: string;
  organization_id: string | null;
  responsavel_id: string | null;     // FK → responsaveis (base pública)
  empresa_id: string | null;         // FK → empresas (base pública)
  empresa_crm_id: string | null;     // FK → empresas_crm
  captador_id: string | null;        // FK → captadores
  proponente_id: string | null;      // FK → proponentes
  nome: string | null;
  cargo: string | null;
  email: string | null;
  linkedin_url: string | null;
  telefone: string | null;
  telefone_2: string | null;
  score: number;
  origem: OrigemContato | null;
  notas: string | null;
  ultima_interacao: string | null;
  papel_decisao: 'decision_maker' | 'champion' | 'influencer' | 'gatekeeper' | null;
  influencia: number | null;
  sentimento: 'positivo' | 'neutro' | 'negativo' | 'desconhecido' | null;
  forca_relacao: number | null;
  canal_preferido: MeioContato | null;
  responsavel_interno_id: string | null;
  ativo_na_empresa: boolean;
  created_at: string;
  updated_at: string;
}

export type CalendarProvider = "google" | "microsoft";

export type StatusPrestacao =
  | "rascunho"
  | "revisao_interna"
  | "enviado"
  | "ajuste_solicitado"
  | "aprovado"
  | "arquivado";

export interface PrestacaoContas {
  id: string;
  /** Null só em prestações antigas sem projeto, captação ou organização única de quem criou. */
  organization_id: string | null;
  captacao_id: string | null;
  projeto_id: string | null;
  titulo: string;
  status: StatusPrestacao;
  /** Prazo vigente: o informado à mão, senão o calculado pelo regime (P1.2). */
  prazo: string | null;
  data_inicio_execucao: string | null;
  data_fim_execucao: string | null;
  /** Regime normativo (prestacao_regimes) e dados oficiais (P1.2). */
  regime_id?: string | null;
  identificador_oficial?: string | null;
  identificador_tipo?: string | null;
  fonte_recurso?: string | null;
  proponente_id?: string | null;
  data_aprovacao?: string | null;
  data_liberacao?: string | null;
  data_termo?: string | null;
  data_conclusao_objeto?: string | null;
  data_envio?: string | null;
  /** Última verificação do motor de checagens (P2.7); só o servidor grava. */
  verificada_em?: string | null;
  /** Calculado pelo banco a partir do regime e dos marcos. */
  prazo_final?: string | null;
  prazo_final_override?: string | null;
  prazo_final_justificativa?: string | null;
  valor_aprovado: number | null;
  valor_realizado: number;
  observacoes: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrestacaoStatusLog {
  id: string;
  prestacao_id: string;
  status_anterior: StatusPrestacao | null;
  status_novo: StatusPrestacao;
  usuario_id: string | null;
  comentario: string | null;
  created_at: string;
}

export type TipoComprovante =
  | "nfe"
  | "recibo"
  | "contrato"
  | "extrato"
  | "invoice"
  | "cartao_embarque"
  | "print_screenshot"
  | "folha_pagamento"
  | "guia_tributo"
  | "rpa"
  | "foto"
  | "planilha"
  | "outro"
  // Despesa v2 (P2.4)
  | "nfse"
  | "cupom"
  | "rpci"
  | "fatura"
  | "apolice"
  | "nota_debito";
export type StatusComprovante = "pendente" | "aceito" | "rejeitado";

export interface PrestacaoComprovante {
  id: string;
  prestacao_id: string;
  /** Item do orçamento em árvore (P1.6). */
  no_id: string | null;
  tipo: TipoComprovante;
  origem: "nacional" | "internacional";
  nome_arquivo: string;
  storage_path: string;
  valor_extraido: number | null;
  data_doc: string | null;
  descricao_servico: string | null;
  status: StatusComprovante;
  observacao: string | null;
  enviado_por: string | null;
  /** Quem aceitou ou rejeitou, e quando (P0.10). */
  avaliado_por?: string | null;
  avaliado_em?: string | null;
  // Despesa v2 (P2.4): o comprovante fiscal vira a despesa.
  fornecedor_id?: string | null;
  numero_documento?: string | null;
  serie?: string | null;
  chave_acesso?: string | null;
  iss?: number;
  inss?: number;
  irrf?: number;
  outras_retencoes?: number;
  /** valor_extraido (bruto) menos as retenções; o banco calcula. */
  valor_liquido?: number | null;
  identificacao_projeto?: "presente" | "declaracao" | "ausente" | null;
  /** Por que a despesa segue apesar dos alertas. */
  justificativa?: string | null;
  /** O que a leitura por IA apontou, com códigos do catálogo de checagens (P2.10b). */
  motivos_ia?: MotivoLido[];
  created_at: string;
}
// ─── Prestação de contas — Phase 3 ──────────────────────────────────────────

export interface PrestacaoAtividade {
  id: string;
  prestacao_id: string;
  titulo: string;
  descricao: string | null;
  data_realizacao: string;
  data_inicio: string | null;
  data_fim: string | null;
  local: string | null;
  cidade: string | null;
  estado: string | null;
  publico_atingido: number | null;
  meta_prevista: number | null;
  empregos_diretos: number | null;
  empregos_indiretos: number | null;
  democratizacao_descricao: string | null;
  acessibilidade_descricao: string | null;
  status_realizacao: "realizado" | "nao_realizado";
  justificativa_nao_realizacao: string | null;
  /** Meta e local de realização da mesma prestação (P3.1). */
  meta_id: string | null;
  local_id: string | null;
  ordem: number;
  criado_por: string | null;
  created_at: string;
}

/** Meta do objeto: o previsto e o realizado que o relatório compara (P3.1). */
export interface PrestacaoMeta {
  id: string;
  prestacao_id: string;
  descricao: string;
  unidade: string | null;
  previsto: number;
  realizado: number | null;
  justificativa: string | null;
  /** Agrupador do orçamento em árvore (meta, produto, etapa) por onde a despesa chega à meta. */
  no_id: string | null;
  ordem: number;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

/** Evidência do objeto, com a data e a posição lidas do arquivo (P3.2). */
export interface PrestacaoEvidencia {
  id: string;
  prestacao_id: string;
  tipo: "foto" | "video" | "link" | "lista_presenca" | "declaracao" | "clipping" | "bordero" | "print" | "relatorio_exibicao" | "cpb" | "outro";
  requisitos: ("alcance_objeto" | "democratizacao" | "acessibilidade" | "distribuicao" | "divulgacao")[];
  atividade_id: string | null;
  meta_id: string | null;
  local_id: string | null;
  nome_arquivo: string | null;
  storage_path: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  url: string | null;
  descricao: string | null;
  /** Hora da câmera, sem fuso: "2026-09-10T14:32:05". */
  capturada_em: string | null;
  latitude: number | null;
  longitude: number | null;
  origem_dados: "arquivo" | "informado" | null;
  justificativa: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

/** Parte do plano de distribuição de um produto, na categoria do regime (P3.4). */
export interface PrestacaoDistribuicao {
  id: string;
  prestacao_id: string;
  produto: string;
  categoria: "patrocinador" | "proponente" | "social" | "educativo" | "popular" | "venda" | "gratuita";
  quantidade: number;
  /** Quantas da quantidade são meia-entrada; só onde há venda. */
  quantidade_meia: number;
  /** Preço do ingresso inteiro ou do produto; só onde há venda. */
  preco: number | null;
  quantidade_realizada: number | null;
  beneficiario: string | null;
  /** CPF ou CNPJ só com letras e números. */
  beneficiario_documento: string | null;
  justificativa: string | null;
  observacoes: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
}

/** Cotação de preço de um bem (P3.5); o arquivo fica na pasta bens da prestação. */
export interface CotacaoDoBem {
  fornecedor: string;
  documento?: string | null;
  valor: number;
  /** "2026-09-01" */
  data?: string | null;
  storage_path?: string | null;
  nome_arquivo?: string | null;
}

/** Bem permanente adquirido, produzido ou construído (P3.5). */
export interface PrestacaoBem {
  id: string;
  prestacao_id: string;
  /** Item da planilha (art. 30 da IN 29) e despesa que pagou o bem. */
  no_id: string | null;
  despesa_id: string | null;
  tipo: "movel" | "equipamento" | "obra_de_arte" | "imovel";
  descricao: string;
  quantidade: number;
  valor: number | null;
  numero_patrimonio: string | null;
  /** Imóvel: cartório, número do registro e folha. */
  registro_imovel: string | null;
  cotacoes: CotacaoDoBem[];
  destinacao: "doacao" | "proponente" | "outra" | null;
  destinacao_descricao: string | null;
  beneficiario: string | null;
  beneficiario_documento: string | null;
  doacao_storage_path: string | null;
  doacao_nome_arquivo: string | null;
  aceite_storage_path: string | null;
  aceite_nome_arquivo: string | null;
  justificativa: string | null;
  observacoes: string | null;
  ordem: number;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

/** Peça de divulgação: veiculação, marcas, aprovação prévia e amostra (P3.6). */
export interface PrestacaoPeca {
  id: string;
  prestacao_id: string;
  tipo: "cartaz" | "folder" | "banner" | "programa" | "convite" | "anuncio" | "rede_social" | "site" | "video" | "audio" | "placa" | "release" | "outro";
  titulo: string;
  /** Onde foi veiculada: o perfil, o jornal, o local da placa. */
  meio: string | null;
  veiculacao_inicio: string | null;
  veiculacao_fim: string | null;
  /** Marcas que aparecem na peça, com os nomes do regime. */
  marcas: string[];
  aprovacao_status: "nao_enviada" | "enviada" | "aprovada" | "reprovada";
  aprovacao_protocolo: string | null;
  aprovacao_enviada_em: string | null;
  aprovacao_decidida_em: string | null;
  storage_path: string | null;
  nome_arquivo: string | null;
  mime_type: string | null;
  url: string | null;
  justificativa: string | null;
  observacoes: string | null;
  ordem: number;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

/** Marcação de um item do checklist de envio: pronto ou não se aplica (P4.1). */
export interface PrestacaoEnvioMarcacao {
  id: string;
  prestacao_id: string;
  etapa: "parcial" | "final";
  tipo: "documento" | "condicao";
  /** Código do documento ou da condição no regime. */
  codigo: string;
  situacao: "pronto" | "nao_se_aplica";
  justificativa: string | null;
  marcado_por: string | null;
  created_at: string;
  updated_at: string;
}

/** Arquivo anexado a um documento do checklist, na pasta envio da prestação (P4.1). */
export interface PrestacaoEnvioArquivo {
  id: string;
  prestacao_id: string;
  etapa: "parcial" | "final";
  codigo: string;
  storage_path: string;
  nome_arquivo: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  criado_por: string | null;
  created_at: string;
}

/** Devolução de recursos por GRU: saldo, rendimento, glosa ou reprovação (P4.4). */
export interface PrestacaoDevolucao {
  id: string;
  prestacao_id: string;
  motivo: "saldo" | "rendimento" | "glosa" | "reprovacao" | "outro";
  descricao: string | null;
  valor_principal: number;
  /** Índice de atualização; "nenhum" para saldo e rendimentos devolvidos no encerramento. */
  indice: "nenhum" | "poupanca" | "selic" | "outro";
  data_base: string | null;
  atualizado_ate: string | null;
  fator: number | null;
  valor_atualizado: number | null;
  gru_unidade_gestora: string | null;
  gru_gestao: string | null;
  gru_codigo: string | null;
  gru_referencia: string | null;
  /** "MM/AAAA". */
  competencia: string | null;
  vencimento: string | null;
  situacao: "a_pagar" | "paga";
  pago_em: string | null;
  valor_pago: number | null;
  storage_path: string | null;
  nome_arquivo: string | null;
  mime_type: string | null;
  observacoes: string | null;
  ordem: number;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

/** Local de realização e a situação que o relatório informa (P3.1). */
export interface PrestacaoLocal {
  id: string;
  prestacao_id: string;
  pais: string;
  uf: string | null;
  municipio: string | null;
  /** Código do IBGE e coordenadas da sede, quando o município veio da lista (P3.2). */
  municipio_ibge: string | null;
  latitude: number | null;
  longitude: number | null;
  espaco: string | null;
  inicio: string | null;
  fim: string | null;
  status: "previsto" | "realizado" | "nao_realizado" | "outras_fontes";
  /** Até 500 caracteres, o limite do Salic; obrigatória em não realizado e em outras fontes. */
  justificativa: string | null;
  ordem: number;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

/** Conta bancária do projeto (P2.1). */
export interface PrestacaoContaBancaria {
  id: string;
  prestacao_id: string;
  tipo: "captacao" | "movimento" | "unica" | "recolhimento" | "aplicacao";
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  apelido: string | null;
  data_abertura: string | null;
  data_encerramento: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

/** Um arquivo de extrato importado; apagar desfaz a importação e leva os lançamentos dela. */
export interface PrestacaoExtratoImportacao {
  id: string;
  prestacao_id: string;
  conta_id: string;
  formato: "ofx" | "csv" | "pdf" | "agregador";
  nome_arquivo: string | null;
  storage_path: string | null;
  hash_arquivo: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  saldo_inicial: number | null;
  saldo_final: number | null;
  lancamentos_novos: number;
  lancamentos_repetidos: number;
  criado_por: string | null;
  created_at: string;
}

/** Linha do extrato. Só entra por fn_prestacao_extrato_importar. */
export interface PrestacaoLancamento {
  id: string;
  prestacao_id: string;
  conta_id: string;
  importacao_id: string | null;
  data: string;
  natureza: "credito" | "debito";
  valor: number;
  historico: string;
  numero_documento: string | null;
  numero_normalizado: string | null;
  id_externo: string | null;
  categoria: string;
  saldo_apos: number | null;
  chave: string;
  created_at: string;
}

export interface PrestacaoAtividadeEvidencia {
  id: string;
  atividade_id: string;
  nome_arquivo: string;
  storage_path: string;
  tipo: string;
  created_at: string;
}

export interface PrestacaoRelatorio {
  id: string;
  prestacao_id: string;
  secao: string;
  conteudo: string;
  updated_at: string;
}

export type CalendarSyncStatus = "pending" | "synced" | "error" | "conflict" | "skipped";
export type CalendarSyncOrigin = "jards" | "google" | "microsoft";

export interface CalendarConnection {
  id: string;
  user_id: string;
  organization_id: string | null;
  provider: CalendarProvider;
  provider_account_email: string | null;
  calendar_id: string;
  calendar_name: string | null;
  access_token_enc: string;
  refresh_token_enc: string;
  token_expires_at: string;
  scopes: string[] | null;
  watch_channel_id: string | null;
  watch_resource_id: string | null;
  watch_expiration: string | null;
  graph_subscription_id: string | null;
  graph_subscription_expires_at: string | null;
  sync_enabled: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Atividade {
  id: string;
  account_id: string;
  organization_id: string | null;
  empresa_crm_id: string | null;
  projeto_id: string | null;
  captacao_id: string | null;
  contato_id: string | null;
  responsavel_id: string | null;
  captador_id: string | null;
  proponente_id: string | null;
  edital_user_id: string | null;
  conta_patrocinio_id: string | null;
  contrato_id: string | null;
  compromisso_id: string | null;
  plano_parceria_id: string | null;
  prestacao_id: string | null;
  origem_automatica: boolean;
  regra_origem: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  resultado: string | null;
  nome: string;
  nome_key: string | null;
  tipo: TipoAtividade | null;
  tipo_custom_id: string | null;
  prioridade: Prioridade | null;
  data_inicio: string | null;
  data_prevista: string | null;
  data_realizada: string | null;
  feita: boolean;
  nota: string | null;
  copy: string | null;
  google_event_id: string | null;
  microsoft_event_id: string | null;
  calendar_sync_status: CalendarSyncStatus | null;
  calendar_sync_error: string | null;
  calendar_synced_at: string | null;
  sync_origin: CalendarSyncOrigin | null;
  external_etag: string | null;
  skip_calendar_push: boolean;
  calendar_sync_requested: boolean;
  created_at: string;
  updated_at: string;
}

export interface Nota {
  id: string;
  account_id: string;
  titulo: string | null;
  conteudo: string;
  timestamp: string;
  empresa_pub_id: string | null;
  empresa_crm_id: string | null;
  proponente_id: string | null;
  contato_id: string | null;
  captacao_id: string | null;
  atividade_id: string | null;
  edital_user_id: string | null;
  created_at: string;
}

export interface EditalUser {
  id: string;
  account_id: string;
  organization_id: string | null;
  edital_pub_id: string | null;
  empresa_pub_id: string | null;
  empresa_crm_id: string | null;
  projeto_id: string | null;
  cota_id: string | null;
  contato_id: string | null;
  lei: string | null;
  valor: number | null;
  site: string | null;
  data_abertura: string | null;
  data_fechamento: string | null;
  data_resultado: string | null;
  status: StatusEdital;
  prioridade: Prioridade | null;
  potencial_fechamento: PotencialFechamento;
  observacoes: string | null;
  ciclo_ano: number | null;
  ciclo_anterior_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EditalInscrito {
  id: string;
  account_id: string;
  organization_id: string | null;
  edital_id: string | null;
  captacao_id: string | null;
  status: StatusEditalInscrito;
  data_inscricao: string | null;
  notas: string | null;
  created_at: string;
}

export interface Desbloqueio {
  id: string;
  account_id: string;
  organization_id: string | null;
  empresa_pub_id: string;
  created_at: string;
}

export interface ResultadoProjeto {
  id: string;
  account_id: string;
  organization_id: string | null;
  projeto_id: string;
  investimento_total: number | null;
  contrapartida: number | null;
  publico_alcancado: number | null;
  eventos_realizados: number | null;
  materiais_produzidos: number | null;
  valor_captado: number | null;
  valor_executado: number | null;
  retorno_midia_est: number | null;
  data_resultado: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export type PlanTipo = "gratuito" | "basico" | "profissional";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  onde_conheceu: string | null;
  cargo_funcao: string | null;
  tipo_organizacao: string | null;
  tamanho_equipe: string | null;
  objetivo_principal: string | null;
  onboarding_completed: boolean;
  primeiros_passos_ocultos_em: string | null;
  plano: PlanTipo;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_subscription_status: "inactive" | "trialing" | "active" | "past_due" | "unpaid" | "paused" | "canceled" | "incomplete" | "incomplete_expired";
  stripe_last_event_at: string | null;
  periodo_fim: string | null;
  desbloqueios_mes: number;
  desbloqueios_mes_reset: string;
  created_at: string;
  updated_at: string;
}

export type StatusPesquisaEmpresa = "pendente" | "em_pesquisa" | "concluida" | "cancelada";

export interface SolicitacaoPesquisaEmpresa {
  id: string;
  organization_id: string;
  empresa_id: string;
  solicitante_id: string;
  status: StatusPesquisaEmpresa;
  prioridade: number;
  created_at: string;
  updated_at: string;
  concluida_em: string | null;
}

export interface CopyTemplate {
  id: string;
  account_id: string;
  projeto_id: string | null;
  nome: string;
  texto: string | null;
  meio_contato: MeioContato | null;
  ativo: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ConfigOrg {
  id: string;
  organization_id: string;
  visibilidade_captacoes: "admin_only" | "team_shared";
  acesso_contatos: "admin_only" | "team_with_credits";
  contribuicoes_habilitadas: boolean;
  contribuicoes_requer_aprovacao: boolean;
  created_at: string;
  updated_at: string;
}

export interface SequenciaTemplate {
  id: string;
  account_id: string;
  projeto_id: string | null;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  padrao_global: boolean;
  created_at: string;
  updated_at: string;
}

export interface SequenciaPasso {
  id: string;
  account_id: string;
  sequencia_id: string;
  titulo: string | null;
  ordem: number;
  offset_dias: number;
  tipo_contato: MeioContato | null;
  copy_sugerida: string | null;
  nota_sugerida: string | null;
  ativo: boolean;
  created_at: string;
}

export interface Tarefa {
  id: string;
  account_id: string;
  organization_id: string | null;
  captacao_id: string | null;
  responsavel_id: string | null;
  titulo: string;
  tipo: TipoTarefa;
  status: StatusTarefa;
  data_prazo: string | null;
  data_conclusao: string | null;
  created_at: string;
}

// ─── CAMADA 3 — Governança Comercial ────────────────────────────────────────

export type TipoExclusividade =
  | "livre" | "exclusividade_empresa" | "exclusividade_projeto"
  | "time_lock" | "relacao_pessoal" | "compartilhada";

export type StatusAtribuicao =
  | "ativa" | "suspensa" | "expirada" | "transferida" | "cancelada";

export type StatusSolicitacao =
  | "pendente" | "aprovada" | "negada" | "compartilhada";

export type StatusComissao =
  | "prevista" | "aprovada" | "recebida" | "paga";

export type MarcoStatus =
  | "pendente" | "em_andamento" | "concluido" | "cancelado";

export interface Atribuicao {
  id: string;
  account_id: string;
  organization_id: string | null;
  empresa_crm_id: string;
  projeto_id: string | null;
  captador_user_id: string;
  tipo: TipoExclusividade;
  status: StatusAtribuicao;
  data_inicio: string;
  data_fim: string | null;
  dias_aviso: number | null;
  motivo: string | null;
  aprovado_por: string | null;
  ultimo_avanco: string | null;
  dias_sem_avanco: number | null;
  created_at: string;
  updated_at: string;
}

export interface SolicitacaoTransferencia {
  id: string;
  account_id: string;
  organization_id: string | null;
  atribuicao_id: string;
  solicitante_id: string;
  destinatario_id: string | null;
  tipo: StatusSolicitacao;
  motivo: string | null;
  resposta: string | null;
  created_at: string;
  responded_at: string | null;
}

export interface MarcoCaptacao {
  id: string;
  account_id: string;
  organization_id: string | null;
  captacao_id: string;
  nome: string;
  ordem: number;
  status: MarcoStatus;
  data_prevista: string | null;
  data_conclusao: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comissao {
  id: string;
  account_id: string;
  organization_id: string | null;
  captacao_id: string;
  captador_user_id: string;
  contrato_id: string | null;
  participacao_id: string | null;
  conta_patrocinio_id: string | null;
  percentual: number | null;
  valor: number | null;
  status: StatusComissao;
  data_prevista: string | null;
  data_recebimento: string | null;
  data_pagamento: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}


export type StatusContribuicao = "pendente" | "aprovada" | "rejeitada" | "auto_promovida";

export type TabelaAlvo = "empresas" | "editais" | "responsaveis";

export type TipoContribuicao = "adicao" | "correcao" | "sinalizacao";

export interface Contribuicao {
  id: string;
  autor_id: string;
  organization_id: string | null;
  tabela_alvo: TabelaAlvo;
  registro_alvo_id: string;
  tipo: TipoContribuicao;
  campo: string | null;
  valor_proposto: Json;
  justificativa: string | null;
  status: StatusContribuicao;
  empresa_crm_id: string | null;
  created_at: string;
  revisado_por: string | null;
  revisado_em: string | null;
}

export interface ContribuicaoConfirmacao {
  contribuicao_id: string;
  organization_id: string;
  confirmou_em: string;
}

// ─── Comentários sobre Patrocinadores ────────────────────────────────────────

export type ComentarioTopico =
  | "processo_selecao"
  | "tomador_decisao"
  | "experiencia_patrocinio"
  | "tipo_projetos"
  | "valor_empresa";

export type StatusComentario = "pendente" | "aprovado" | "oculto";

export const TOPICO_META: Record<ComentarioTopico, { label: string; icon: string; color: string; bg: string; desc: string }> = {
  processo_selecao:     { label: "Processo Seletivo",  icon: "ClipboardCheck", color: "#2D72B0", bg: "#2D72B014", desc: "Como selecionam projetos" },
  tomador_decisao:      { label: "Tomador de Decisão", icon: "UserCheck",      color: "#7259B5", bg: "#7259B514", desc: "Quem decide e como" },
  experiencia_patrocinio:{ label: "Experiência",        icon: "Sparkles",       color: "#2E8932", bg: "#2E893214", desc: "Ser patrocinado por eles" },
  tipo_projetos:        { label: "Tipos de Projetos",   icon: "Layers",         color: "#B07A14", bg: "#B07A1414", desc: "O que financiam" },
  valor_empresa:        { label: "Gera Valor",          icon: "TrendingUp",     color: "#1A8B7A", bg: "#1A8B7A14", desc: "O que valorizam" },
};

export interface Comentario {
  id: string;
  empresa_id: string;
  autor_id: string;
  topico: ComentarioTopico;
  conteudo: string;
  votos: number;
  status: StatusComentario;
  created_at: string;
  editado_em: string | null;
}

export interface ComentarioVoto {
  comentario_id: string;
  user_id: string;
  valor: -1 | 1;
  created_at: string;
}

// ─── Votos em Editais ("Esse edital funciona?") ──────────────────────────────

export interface EditalVoto {
  edital_id: string;
  user_id: string;
  funciona: boolean | null;
  principal_selecao: boolean | null;
  comentario: string | null;
  created_at: string;
}

// ─── Sugestão de Contatos ─────────────────────────────────────────────────────

export type StatusSugestaoContato = "pendente" | "aprovado" | "rejeitado" | "promovido";

export interface ContatoSugestao {
  id: string;
  empresa_id: string;
  autor_id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  linkedin_url: string | null;
  telefone: string | null;
  justificativa: string | null;
  votos_positivos: number;
  votos_negativos: number;
  status: StatusSugestaoContato;
  responsavel_id: string | null;
  created_at: string;
}

export interface ContatoSugestaoVoto {
  sugestao_id: string;
  user_id: string;
  valor: -1 | 1;
  created_at: string;
}

export interface Captador {
  id: string;
  organization_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  agencia: string | null;
  prioridade: Prioridade | null;
  contatos: Json | null;
  user_id: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface AnotacaoEmpresa {
  id: string;
  account_id: string;
  empresa_crm_id: string;
  conteudo: string;
  created_at: string;
  updated_at: string;
}

export interface AtividadeTipo {
  id: string;
  organization_id: string;
  nome: string;
  nome_key: string | null;
  icone: string;
  cor: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Documento {
  id: string;
  account_id: string;
  organization_id: string | null;
  captacao_id: string | null;
  projeto_id: string | null;
  conta_patrocinio_id: string | null;
  contrato_id: string | null;
  plano_ativacao_id: string | null;
  compromisso_id: string | null;
  nome: string;
  tipo: string | null;
  tamanho: number | null;
  url: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentoInscricao {
  id: string;
  account_id: string;
  inscricao_id: string;
  projeto_id: string | null;
  titulo: string;
  icone: string | null;
  cor: string | null;
  arquivo_url: string;
  arquivo_nome: string | null;
  arquivo_tamanho: number | null;
  created_at: string;
}

export interface HistoricoCaptacao {
  id: string;
  account_id: string;
  organization_id: string | null;
  captacao_id: string;
  user_id: string | null;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  created_at: string;
}

export interface DashboardPreference {
  id: string;
  user_id: string;
  organization_id: string;
  module_id: string;
  enabled: boolean;
  position: number;
  settings: Json;
  created_at: string;
  updated_at: string;
}

export interface UserPreference {
  id: string;
  user_id: string;
  organization_id: string;
  preference_key: string;
  settings: Json;
  created_at: string;
  updated_at: string;
}

export interface CrmInteracao {
  id: string; organization_id: string; account_id: string; empresa_crm_id: string | null;
  proponente_id: string | null; contato_id: string | null; captacao_id: string | null; atividade_id: string | null;
  followup_id: string | null; tipo: string; canal: CanalContato | null;
  tipo_interacao: "tentativa" | "mensagem" | "ligacao" | "reuniao" | "apresentacao" | "followup" | "outro" | null;
  direcao: "entrada" | "saida"; duracao_minutos: number | null; resposta_em: string | null;
  assunto: string; resumo: string | null; resultado: ResultadoInteracao | null; proximo_passo: string | null;
  ocorreu_em: string; created_by: string | null; created_at: string; updated_at: string;
}

export interface CrmDuvida {
  id: string; organization_id: string; account_id: string; empresa_crm_id: string | null;
  proponente_id: string | null; contato_id: string | null; captacao_id: string | null; interacao_id: string | null;
  tipo: "duvida" | "objecao"; titulo: string; resposta: string | null;
  status: "aberta" | "em_validacao" | "respondida"; responsavel_id: string | null;
  created_by: string | null; created_at: string; updated_at: string;
}

export interface CrmFollowup {
  id: string; organization_id: string; account_id: string; empresa_crm_id: string | null;
  proponente_id: string | null; contato_id: string | null; captacao_id: string | null; conta_patrocinio_id: string | null;
  titulo: string; motivo: string | null;
  canal: string; previsto_para: string; status: "pendente" | "concluido" | "cancelado";
  resultado: string | null; tentativa: number; workflow: string | null; responsavel_id: string | null;
  concluido_em: string | null; created_by: string | null; created_at: string; updated_at: string;
}

// ─── Database type (para createClient<Database>()) ───────────────────────────

export interface PlanoParceria {
  id: string; organization_id: string; account_id: string; conta_patrocinio_id: string;
  nome: string; objetivo_geral: string | null; responsavel_id: string | null;
  status: 'rascunho' | 'ativo' | 'concluido' | 'arquivado'; data_inicio: string;
  proxima_revisao: string | null; created_at: string; updated_at: string;
}

export interface ObjetivoParceria {
  id: string; organization_id: string; account_id: string; plano_id: string; titulo: string;
  indicador: string | null; meta: string | null; valor_atual: string | null; prazo: string | null;
  status: 'nao_iniciado' | 'em_andamento' | 'atingido' | 'em_risco' | 'cancelado';
  created_at: string; updated_at: string;
}

export interface CompromissoCliente {
  id: string; organization_id: string; account_id: string; conta_patrocinio_id: string;
  contrato_id: string | null; projeto_id: string | null; objetivo_id: string | null; titulo: string;
  categoria: string; prazo: string | null; responsavel_id: string | null;
  status: 'pendente' | 'em_andamento' | 'entregue' | 'aprovado' | 'atrasado' | 'cancelado';
  evidencia_url: string | null; aprovado_em: string | null; observacoes: string | null;
  criterios_aceite?: string | null; entregue_em?: string | null;
  entregue_por?: string | null; aprovado_por?: string | null;
  plano_ativacao_id: string | null; acao_ativacao_id: string | null; cota_id: string | null;
  proposta_id: string | null; edital_user_id: string | null; contrapartida_ordem: number | null;
  evidencia_obrigatoria: boolean; origem: 'manual' | 'cota' | 'contrato' | 'importacao' | 'proposta';
  created_at: string; updated_at: string;
}

export type StatusPlanoAtivacao = 'rascunho' | 'planejado' | 'em_execucao' | 'concluido' | 'arquivado';
export type StatusAcaoAtivacao = 'nao_iniciada' | 'em_andamento' | 'bloqueada' | 'concluida' | 'cancelada';

export interface PlanoAtivacao {
  id: string; organization_id: string; account_id: string; conta_patrocinio_id: string;
  projeto_id: string; cota_id: string | null; contrato_id: string | null; captacao_id: string | null;
  nome: string; descricao: string | null; responsavel_id: string | null; status: StatusPlanoAtivacao;
  data_inicio: string | null; data_fim: string | null; valor_direito_snapshot: number | null;
  moeda: string; created_at: string; updated_at: string;
}

export interface PlanoAtivacaoResumo extends PlanoAtivacao {
  conta_nome: string | null; empresa_crm_id: string; empresa_nome: string; empresa_domain_key: string | null; empresa_site: string | null;
  projeto_nome: string; cota_nome: string | null; contrato_titulo: string | null;
  acoes_total: number; acoes_concluidas: number; tarefas_total: number; tarefas_concluidas: number;
  entregaveis_total: number; entregaveis_aprovados: number; entregaveis_atrasados: number;
  evidencias_total: number; evidencias_aprovadas: number;
  orcamento_planejado: number; orcamento_realizado: number; proxima_data: string | null;
}

export interface AtivacaoPublico {
  id: string; organization_id: string; account_id: string; plano_id: string; nome: string;
  descricao: string | null; necessidade: string | null; prioridade: 'primario' | 'secundario';
  ordem: number; created_at: string; updated_at: string;
}

export interface AtivacaoObjetivo {
  id: string; organization_id: string; account_id: string; plano_id: string; titulo: string;
  descricao: string | null; indicador: string | null; unidade: string | null; meta: number | null;
  valor_atual: number | null; prazo: string | null;
  status: 'nao_iniciado' | 'em_andamento' | 'atingido' | 'em_risco' | 'cancelado';
  created_at: string; updated_at: string;
}

export interface AtivacaoAcao {
  id: string; organization_id: string; account_id: string; plano_id: string; objetivo_id: string | null;
  titulo: string; descricao: string | null; canal: string | null; responsavel_id: string | null;
  data_inicio: string | null; data_fim: string | null; status: StatusAcaoAtivacao;
  valor_planejado: number; ordem: number; created_at: string; updated_at: string;
}

export interface AtivacaoOrcamentoItem {
  id: string; organization_id: string; account_id: string; plano_id: string; acao_id: string | null;
  categoria: string; descricao: string; pagador: 'patrocinador' | 'proponente' | 'compartilhado' | 'terceiro';
  valor_planejado: number; valor_realizado: number; data_prevista: string | null; data_realizada: string | null;
  status: 'previsto' | 'aprovado' | 'comprometido' | 'pago' | 'cancelado';
  ordem: number; created_at: string; updated_at: string;
}

export interface AtivacaoEvidencia {
  id: string; organization_id: string; account_id: string; plano_id: string; acao_id: string | null;
  compromisso_id: string | null; documento_id: string | null;
  tipo: 'arquivo' | 'link' | 'imagem' | 'video' | 'metrica' | 'declaracao';
  url_externa: string | null; titulo: string; descricao: string | null; capturada_em: string;
  status: 'rascunho' | 'enviada' | 'aprovada' | 'rejeitada'; aprovada_por: string | null;
  aprovada_em: string | null; created_at: string; updated_at: string;
}

export interface SaudeConta {
  id: string; organization_id: string; account_id: string; conta_patrocinio_id: string;
  dimensao: 'relacionamento' | 'entregas' | 'engajamento' | 'resultados' | 'financeiro' | 'renovacao';
  estado: 'saudavel' | 'atencao' | 'risco' | 'sem_dados';
  tendencia: 'melhorando' | 'estavel' | 'piorando'; justificativa: string | null;
  origem: 'manual' | 'regra' | 'ia'; avaliado_por: string | null; created_at: string;
}

export interface PrevisaoRenovacao {
  id: string; organization_id: string; account_id: string; contrato_id: string;
  cenario: 'renovar' | 'expandir' | 'reduzir' | 'encerrar'; valor_esperado: number | null;
  probabilidade: number | null; confianca: 'baixa' | 'media' | 'alta' | null;
  data_esperada: string | null; riscos: string | null; responsavel_id: string | null;
  created_at: string; updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      // ── Públicas ──
      empresas: {
        Row: Empresa;
        Insert: Omit<Empresa, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Empresa, "id" | "created_at">>;
      };
      editais: {
        Row: Edital;
        Insert: Omit<Edital, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Edital, "id" | "created_at">>;
      };
      responsaveis: {
        Row: Responsavel;
        Insert: Omit<Responsavel, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Responsavel, "id" | "created_at">>;
      };
      tipologias: {
        Row: Tipologia;
        Insert: Omit<Tipologia, "id">;
        Update: Partial<Omit<Tipologia, "id">>;
      };
      investimentos_anuais: {
        Row: InvestimentoAnual;
        Insert: Omit<InvestimentoAnual, "id">;
        Update: Partial<Omit<InvestimentoAnual, "id">>;
      };
      investimentos_trimestres: {
        Row: InvestimentoTrimestre;
        Insert: Omit<InvestimentoTrimestre, "id">;
        Update: Partial<Omit<InvestimentoTrimestre, "id">>;
      };
      // ── Organização ──
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Organization, "id" | "created_at">>;
      };
      organization_members: {
        Row: OrganizationMember;
        Insert: Omit<OrganizationMember, "id" | "created_at">;
        Update: Partial<Omit<OrganizationMember, "id" | "created_at">>;
      };
      dashboard_preferences: {
        Row: DashboardPreference;
        Insert: Omit<DashboardPreference, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<DashboardPreference, "id" | "created_at">>;
      };
      user_preferences: {
        Row: UserPreference;
        Insert: Omit<UserPreference, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<UserPreference, "id" | "user_id" | "organization_id" | "created_at">>;
      };
      // ── CRM Privado ──
      proponentes: {
        Row: Proponente;
        Insert: Omit<Proponente, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Proponente, "id" | "created_at">>;
      };
      projetos_crm: {
        Row: ProjetoCrm;
        Insert: Omit<ProjetoCrm, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ProjetoCrm, "id" | "created_at">>;
      };
      projeto_membros: {
        Row: ProjetoMembro;
        Insert: Omit<ProjetoMembro, "id" | "created_at">;
        Update: Partial<Omit<ProjetoMembro, "id" | "projeto_id" | "created_at">>;
      };
      projeto_recursos_proprios: {
        Row: ProjetoRecursoProprio;
        Insert: Omit<ProjetoRecursoProprio, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ProjetoRecursoProprio, "id" | "projeto_id" | "created_at">>;
      };
      projeto_historico: {
        Row: ProjetoHistorico;
        Insert: Omit<ProjetoHistorico, "id" | "created_at">;
        Update: Partial<Omit<ProjetoHistorico, "id" | "projeto_id" | "created_at">>;
      };
      projeto_comentarios: {
        Row: ProjetoComentario;
        Insert: Omit<ProjetoComentario, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ProjetoComentario, "id" | "projeto_id" | "user_id" | "created_at">>;
      };
      resultados_projeto: {
        Row: ResultadoProjeto;
        Insert: Omit<ResultadoProjeto, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ResultadoProjeto, "id" | "created_at">>;
      };
      empresas_crm: {
        Row: EmpresaCrm;
        Insert: Omit<EmpresaCrm, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<EmpresaCrm, "id" | "created_at">>;
      };
      captacoes: {
        Row: Captacao;
        Insert: Omit<Captacao, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Captacao, "id" | "created_at">>;
      };
      contatos: {
        Row: Contato;
        Insert: Omit<Contato, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Contato, "id" | "created_at">>;
      };
      crm_interacoes: {
        Row: CrmInteracao;
        Insert: Omit<CrmInteracao, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<CrmInteracao, "id" | "organization_id" | "account_id" | "created_at">>;
      };
      crm_duvidas: {
        Row: CrmDuvida;
        Insert: Omit<CrmDuvida, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<CrmDuvida, "id" | "organization_id" | "account_id" | "created_at">>;
      };
      crm_followups: {
        Row: CrmFollowup;
        Insert: Omit<CrmFollowup, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<CrmFollowup, "id" | "organization_id" | "account_id" | "created_at">>;
      };
      atividades: {
        Row: Atividade;
        Insert: Omit<Atividade, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Atividade, "id" | "created_at">>;
      };
      calendar_connections: {
        Row: CalendarConnection;
        Insert: Omit<CalendarConnection, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<CalendarConnection, "id" | "created_at">>;
      };
      notas: {
        Row: Nota;
        Insert: Omit<Nota, "id" | "created_at">;
        Update: Partial<Omit<Nota, "id" | "created_at">>;
      };
      editais_user: {
        Row: EditalUser;
        Insert: Omit<EditalUser, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<EditalUser, "id" | "created_at">>;
      };
      editais_inscritos: {
        Row: EditalInscrito;
        Insert: Omit<EditalInscrito, "id" | "created_at">;
        Update: Partial<Omit<EditalInscrito, "id" | "created_at">>;
      };
      desbloqueios: {
        Row: Desbloqueio;
        Insert: Omit<Desbloqueio, "id" | "created_at">;
        Update: never;
      };
      solicitacoes_pesquisa_empresa: {
        Row: SolicitacaoPesquisaEmpresa;
        Insert: Omit<SolicitacaoPesquisaEmpresa, "id" | "created_at" | "updated_at" | "concluida_em"> & { concluida_em?: string | null };
        Update: Partial<Omit<SolicitacaoPesquisaEmpresa, "id" | "organization_id" | "empresa_id" | "solicitante_id" | "created_at">>;
      };
      copy_templates: {
        Row: CopyTemplate;
        Insert: Omit<CopyTemplate, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<CopyTemplate, "id" | "created_at">>;
      };
      sequencias_template: {
        Row: SequenciaTemplate;
        Insert: Omit<SequenciaTemplate, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<SequenciaTemplate, "id" | "created_at">>;
      };
      sequencias_passo: {
        Row: SequenciaPasso;
        Insert: Omit<SequenciaPasso, "id" | "created_at">;
        Update: Partial<Omit<SequenciaPasso, "id" | "created_at">>;
      };
      tarefas: {
        Row: Tarefa;
        Insert: Omit<Tarefa, "id" | "created_at">;
        Update: Partial<Omit<Tarefa, "id" | "created_at">>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "id" | "created_at">;
        Update: Partial<Omit<Profile, "id" | "created_at">>;
      };
      cotas_patrocinio: {
        Row: CotaPatrocinio;
        Insert: Omit<CotaPatrocinio, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<CotaPatrocinio, "id" | "created_at">>;
      };
      vendas_patrocinio: {
        Row: VendaPatrocinio;
        Insert: Omit<VendaPatrocinio, "id" | "created_at" | "vendida_em">;
        Update: Partial<Omit<VendaPatrocinio, "id" | "created_at">>;
      };
      proponente_score_criterios: {
        Row: ProponenteScoreCriterio;
        Insert: Omit<ProponenteScoreCriterio, "id" | "created_at" | "updated_at" | "created_by"> & { created_by?: string | null };
        Update: Partial<Omit<ProponenteScoreCriterio, "id" | "organization_id" | "proponente_id" | "created_at">>;
      };
      projeto_orcamento_itens: {
        Row: ProjetoOrcamentoItem;
        Insert: Omit<ProjetoOrcamentoItem, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ProjetoOrcamentoItem, "id" | "created_at" | "updated_at">>;
      };
      projeto_orcamento_rateios: {
        Row: ProjetoOrcamentoRateio;
        Insert: Omit<ProjetoOrcamentoRateio, "id" | "created_at">;
        Update: Partial<Omit<ProjetoOrcamentoRateio, "id" | "created_at">>;
      };
      propostas: {
        Row: Proposta;
        Insert: Omit<Proposta, "id" | "created_at" | "updated_at" | "slug" | "total_visualizacoes">;
        Update: Partial<Omit<Proposta, "id" | "created_at">>;
      };
      proposta_visualizacoes: {
        Row: PropostaVisualizacao;
        Insert: Omit<PropostaVisualizacao, "id" | "visualizado_em">;
        Update: Partial<Omit<PropostaVisualizacao, "id" | "visualizado_em">>;
      };
      notification_events: {
        Row: NotificationEvent;
        Insert: Omit<NotificationEvent, "id" | "occurred_at" | "processed_at" | "error"> & {
          processed_at?: string | null;
          error?: string | null;
        };
        Update: Partial<Omit<NotificationEvent, "id" | "occurred_at">>;
      };
      notificacoes: {
        Row: Notificacao;
        Insert: Omit<Notificacao, "id" | "created_at">;
        Update: Partial<Omit<Notificacao, "id" | "user_id" | "organization_id" | "created_at">>;
      };
      contribuicoes: {
        Row: Contribuicao;
        Insert: Omit<Contribuicao, "id" | "created_at" | "revisado_por" | "revisado_em">;
        Update: Partial<Omit<Contribuicao, "id" | "created_at">>;
      };
      contribuicoes_confirmacoes: {
        Row: ContribuicaoConfirmacao;
        Insert: Omit<ContribuicaoConfirmacao, "confirmou_em">;
        Update: never;
      };
      config_org: {
        Row: ConfigOrg;
        Insert: Omit<ConfigOrg, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ConfigOrg, "id" | "created_at">>;
      };
      comentarios: {
        Row: Comentario;
        Insert: Omit<Comentario, "id" | "created_at" | "editado_em" | "votos">;
        Update: Partial<Omit<Comentario, "id" | "created_at">>;
      };
      comentario_votos: {
        Row: ComentarioVoto;
        Insert: Omit<ComentarioVoto, "created_at">;
        Update: Partial<Omit<ComentarioVoto, "comentario_id" | "user_id">>;
      };
      edital_votos: {
        Row: EditalVoto;
        Insert: Omit<EditalVoto, "created_at">;
        Update: Partial<Omit<EditalVoto, "edital_id" | "user_id">>;
      };
      contatos_sugestoes: {
        Row: ContatoSugestao;
        Insert: Omit<ContatoSugestao, "id" | "created_at" | "votos_positivos" | "votos_negativos" | "status" | "responsavel_id">;
        Update: Partial<Omit<ContatoSugestao, "id" | "created_at">>;
      };
      contato_sugestao_votos: {
        Row: ContatoSugestaoVoto;
        Insert: Omit<ContatoSugestaoVoto, "created_at">;
        Update: Partial<Omit<ContatoSugestaoVoto, "sugestao_id" | "user_id">>;
      };
      captadores: {
        Row: Captador;
        Insert: Omit<Captador, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Captador, "id" | "created_at">>;
      };
      captador_score_criterios: {
        Row: CaptadorScoreCriterio;
        Insert: Omit<CaptadorScoreCriterio, "id" | "created_at" | "updated_at" | "created_by"> & { created_by?: string | null };
        Update: Partial<Omit<CaptadorScoreCriterio, "id" | "organization_id" | "captador_id" | "created_at">>;
      };
      captador_proponente: {
        Row: CaptadorProponente;
        Insert: Omit<CaptadorProponente, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<CaptadorProponente, "id" | "created_at">>;
      };
      anotacoes_empresa: {
        Row: AnotacaoEmpresa;
        Insert: Omit<AnotacaoEmpresa, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<AnotacaoEmpresa, "id" | "created_at">>;
      };
      atividade_tipos: {
        Row: AtividadeTipo;
        Insert: Omit<AtividadeTipo, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<AtividadeTipo, "id" | "created_at">>;
      };
      documentos: {
        Row: Documento;
        Insert: Omit<Documento, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Documento, "id" | "created_at">>;
      };
      documentos_inscricao: {
        Row: DocumentoInscricao;
        Insert: Omit<DocumentoInscricao, "id" | "created_at">;
        Update: Partial<Omit<DocumentoInscricao, "id" | "created_at">>;
      };
      historico_captacoes: {
        Row: HistoricoCaptacao;
        Insert: Omit<HistoricoCaptacao, "id" | "created_at">;
        Update: never;
      };
      planos_parceria: {
        Row: PlanoParceria;
        Insert: Omit<PlanoParceria, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<PlanoParceria, "id" | "organization_id" | "account_id" | "created_at">>;
      };
      objetivos_parceria: {
        Row: ObjetivoParceria;
        Insert: Omit<ObjetivoParceria, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<ObjetivoParceria, "id" | "organization_id" | "account_id" | "created_at">>;
      };
      compromissos_cliente: {
        Row: CompromissoCliente;
        Insert: Omit<CompromissoCliente, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<CompromissoCliente, "id" | "organization_id" | "account_id" | "created_at">>;
      };
      saude_conta: {
        Row: SaudeConta;
        Insert: Omit<SaudeConta, "id" | "created_at">;
        Update: never;
      };
      previsoes_renovacao: {
        Row: PrevisaoRenovacao;
        Insert: Omit<PrevisaoRenovacao, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<PrevisaoRenovacao, "id" | "organization_id" | "account_id" | "created_at">>;
      };
      planos_ativacao: {
        Row: PlanoAtivacao;
        Insert: Omit<PlanoAtivacao, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<PlanoAtivacao, "id" | "organization_id" | "account_id" | "created_at">>;
      };
      ativacao_publicos: {
        Row: AtivacaoPublico;
        Insert: Omit<AtivacaoPublico, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<AtivacaoPublico, "id" | "organization_id" | "account_id" | "created_at">>;
      };
      ativacao_objetivos: {
        Row: AtivacaoObjetivo;
        Insert: Omit<AtivacaoObjetivo, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<AtivacaoObjetivo, "id" | "organization_id" | "account_id" | "created_at">>;
      };
      ativacao_acoes: {
        Row: AtivacaoAcao;
        Insert: Omit<AtivacaoAcao, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<AtivacaoAcao, "id" | "organization_id" | "account_id" | "created_at">>;
      };
      ativacao_orcamento_itens: {
        Row: AtivacaoOrcamentoItem;
        Insert: Omit<AtivacaoOrcamentoItem, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<AtivacaoOrcamentoItem, "id" | "organization_id" | "account_id" | "created_at">>;
      };
      ativacao_evidencias: {
        Row: AtivacaoEvidencia;
        Insert: Omit<AtivacaoEvidencia, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<AtivacaoEvidencia, "id" | "organization_id" | "account_id" | "created_at">>;
      };
    };
    Views: {
      vw_planos_ativacao_resumo: {
        Row: PlanoAtivacaoResumo;
      };
    };
    Functions: {
      fn_aceitar_proposta_comercial: {
        Args: { p_proposta_id: string };
        Returns: Json;
      };
      fn_set_atividade_concluida: {
        Args: { p_atividade_id: string; p_feita: boolean; p_data_realizada?: string | null };
        Returns: Json;
      };
      fn_toggle_voto: {
        Args: { p_comentario_id: string; p_valor: number };
        Returns: number;
      };
      fn_votar_sugestao_contato: {
        Args: { p_sugestao_id: string; p_valor: number };
        Returns: string;
      };
      fn_solicitar_pesquisa_empresa: {
        Args: { p_organization_id: string; p_empresa_id: string };
        Returns: Json;
      };
    };
    Enums: {
      lei:              "rouanet" | "esporte" | "audiovisual" | "fia" | "icms" | "iss" | "outros";
      prioridade:       "alta" | "media" | "baixa";
      meio_contato:     "email" | "telefone" | "linkedin" | "reuniao" | "indicacao" | "outro";
      tipo_atividade:   "email" | "telefone" | "linkedin" | "reuniao" | "evento" | "outro";
      status_captacao:  "prospeccao" | "primeiro_contato" | "proposta_enviada" | "em_negociacao" | "aprovado" | "recusado" | "renovacao";
      status_edital:    "interesse" | "inscrito" | "em_analise" | "aprovado" | "reprovado" | "cancelado";
      papel:            "admin" | "captador" | "colaborador" | "leitor";
      tipo_proponente:  "oscip" | "associacao" | "empresa" | "pessoa_fisica" | "outro";
    };
    CompositeTypes: Record<string, never>;
  };
}

/**
 * Fornecedor da organização (P2.3). Os dados da Receita e das sanções só são
 * gravados pela função consultar-fornecedor; a pessoa edita o resto.
 */
export interface PrestacaoFornecedor {
  id: string;
  organization_id: string;
  tipo_pessoa: "pj" | "mei" | "pf" | "estrangeiro";
  documento: string | null;
  nome: string | null;
  parte_relacionada: boolean;
  tipo_relacao: "proponente" | "conjuge" | "coligada" | "socio_em_comum" | "dirigente" | "parente" | null;
  grupo_economico: string | null;
  observacoes: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  situacao_cadastral: string | null;
  data_situacao: string | null;
  data_abertura: string | null;
  cnae_principal: string | null;
  cnae_descricao: string | null;
  cnaes_secundarios: { codigo: string; descricao: string }[] | null;
  natureza_juridica: string | null;
  porte: string | null;
  opcao_mei: boolean | null;
  uf: string | null;
  municipio: string | null;
  socios: { nome: string; qualificacao: string | null; documento: string | null; entrada: string | null }[] | null;
  cnpj_consultado_em: string | null;
  cnpj_erro: string | null;
  sancoes: {
    emissor: string | null;
    tipo: string | null;
    descricao: string | null;
    situacao: string | null;
    observacao: string | null;
    emitida_em: string | null;
    resultado: "nada_consta" | "consta" | "a_conferir";
  }[] | null;
  sancoes_situacao: "nada_consta" | "consta" | "a_conferir" | "indisponivel" | null;
  sancoes_consultadas_em: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

/** Pagamento de uma despesa (P2.5); lancamento_id liga ao extrato na conciliação (P2.6). */
export interface PrestacaoPagamento {
  id: string;
  prestacao_id: string;
  despesa_id: string;
  lancamento_id: string | null;
  forma: "pix" | "ted" | "doc" | "boleto" | "cheque" | "saque" | "cartao" | "debito_automatico" | "cambio";
  data: string;
  valor: number;
  favorecido_documento: string | null;
  favorecido_nome: string | null;
  numero_documento: string | null;
  observacao: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

/** Comprovante do fornecedor (P2.3b): o que a consulta guardou ou a pessoa anexou. */
/** Achado do motor de checagens (P2.7). Só o servidor grava; decidir é pela função. */
export interface PrestacaoVerificacao {
  id: string;
  prestacao_id: string;
  chave: string;
  check_codigo: string;
  severidade: "bloqueio" | "alerta" | "justificativa" | "info";
  resultado: "nao_conforme" | "revisar" | "nao_calculavel";
  entidade_tipo: "prestacao" | "despesa" | "pagamento" | "lancamento" | "meta" | "local" | "atividade" | "evidencia" | "distribuicao" | "bem" | "peca";
  entidade_id: string | null;
  mensagem: string;
  fonte: { documento: string; dispositivo: string; citacao?: string; aConfirmar?: boolean; regra?: { codigo: string; descricao: string } } | null;
  dados: Record<string, string | number | null>;
  status: "aberta" | "justificada" | "dispensada" | "resolvida";
  justificativa: string | null;
  resolvida_por: string | null;
  resolvida_em: string | null;
  detectada_em: string;
  visto_em: string;
  created_at: string;
  updated_at: string;
}

export interface PrestacaoFornecedorDocumento {
  id: string;
  organization_id: string;
  fornecedor_id: string;
  origem: "consulta" | "pessoa";
  tipo: "certidao_tcu" | "consulta_receita" | "cartao_cnpj" | "certidao" | "outro";
  nome_arquivo: string;
  storage_path: string;
  documento: string | null;
  hash_sha256: string | null;
  criado_por: string | null;
  created_at: string;
}
