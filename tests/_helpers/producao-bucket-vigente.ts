/**
 * As regras de storage.objects que o banco de produção tinha em 15/10/2026, antes da PD0.14, lidas de pg_policies
 * (nome, comando e se é restritiva): 30 regras, dez delas do bucket `documentos`, que guarda também os arquivos da
 * prestação de contas de clientes de verdade. A PD0.14 não reescreve nenhuma: só acrescenta as oito
 * `documentos: producoes ...`. tests/producao-arquivos-sql.test.ts confere que as migrations dela não criam, alteram
 * nem apagam nenhuma destas, e o ensaio no banco (supabase/tests/producao_arquivos.test.sql) que as dez do documentos
 * seguem lá. O resumo abaixo é o md5 do texto das 30 (nome, comando, tipo, using e with check, nesta ordem, por nome da
 * regra), a conferência que a migration do bucket traz no cabeçalho para depois de aplicada.
 */

export type RegraDoStorage = {
  nome: string;
  comando: "ALL" | "SELECT" | "INSERT" | "UPDATE" | "DELETE";
  restritiva: boolean;
  /** O bucket de que a regra cuida (a expressão começa por bucket_id = '...', ou por bucket_id <> 'documentos' nas restritivas). */
  bucket: string;
};

const permissiva = (bucket: string, nome: string, comando: RegraDoStorage["comando"]): RegraDoStorage => ({ nome, comando, restritiva: false, bucket });
const restritiva = (bucket: string, nome: string, comando: RegraDoStorage["comando"]): RegraDoStorage => ({ nome, comando, restritiva: true, bucket });

export const REGRAS_VIGENTES_DO_STORAGE: readonly RegraDoStorage[] = [
  permissiva("avatars", "avatars: all authenticated", "ALL"),
  permissiva("avatars", "avatars: org admin delete", "DELETE"),
  permissiva("avatars", "avatars: org admin update", "UPDATE"),
  permissiva("avatars", "avatars: org admin upload", "INSERT"),
  permissiva("avatars", "avatars: user delete", "DELETE"),
  permissiva("avatars", "avatars: user update", "UPDATE"),
  permissiva("avatars", "avatars: user upload", "INSERT"),
  permissiva("documentos", "documentos: convidado le", "SELECT"),
  permissiva("documentos", "documentos: delete org", "DELETE"),
  restritiva("documentos", "documentos: enviado nao muda", "UPDATE"),
  restritiva("documentos", "documentos: enviado nao sai", "DELETE"),
  permissiva("documentos", "documentos: leitura sem assinatura", "SELECT"),
  permissiva("documentos", "documentos: proponente desfaz envio", "DELETE"),
  permissiva("documentos", "documentos: proponente envia", "INSERT"),
  permissiva("documentos", "documentos: read org", "SELECT"),
  permissiva("documentos", "documentos: update org", "UPDATE"),
  permissiva("documentos", "documentos: upload org", "INSERT"),
  permissiva("normas", "normas: super admin le", "SELECT"),
  permissiva("projetos-identidade", "projetos-identidade: delete autenticado", "DELETE"),
  permissiva("projetos-identidade", "projetos-identidade: leitura pública", "SELECT"),
  permissiva("projetos-identidade", "projetos-identidade: update autenticado", "UPDATE"),
  permissiva("projetos-identidade", "projetos-identidade: upload autenticado", "INSERT"),
  permissiva("propostas", "propostas storage: auth delete", "DELETE"),
  permissiva("propostas", "propostas storage: auth insert", "INSERT"),
  permissiva("propostas", "propostas storage: public read", "SELECT"),
  permissiva("relatorios-sustentabilidade", "rel_sust_delete", "DELETE"),
  permissiva("relatorios-sustentabilidade", "rel_sust_read", "SELECT"),
  permissiva("relatorios-sustentabilidade", "rel_sust_upload", "INSERT"),
  permissiva("workspace-anexos", "workspace-anexos: read participantes", "SELECT"),
  permissiva("workspace-anexos", "workspace-anexos: upload participantes", "INSERT"),
];

/** md5(string_agg(policyname || cmd || permissive || coalesce(qual, '') || coalesce(with_check, ''), '|' order by policyname)) das 30, em 15/10/2026. */
export const RESUMO_MD5_DAS_30_REGRAS = "f69d142cd2895887562468f486d53506";
