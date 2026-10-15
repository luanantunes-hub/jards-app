// Caminhos dos arquivos da produção no bucket "documentos" (PD0.14). A regra mora
// em supabase/functions/_shared para que o app e as edge functions usem o mesmo
// código, com a lista de pastas e a de extensões num lugar só; este arquivo só a
// expõe para o app.
export {
  BUCKET_DOS_ARQUIVOS,
  EXTENSOES_ACEITAS,
  ehPastaDeArquivo,
  ehUuid,
  extensaoAceita,
  extensaoDoArquivo,
  lerCaminhoProducao,
  montarCaminhoProducao,
  PADRAO_DO_CAMINHO,
  PASTAS_DE_ARQUIVO,
  PASTAS_SENSIVEIS,
  pastaEhSensivel,
  RAIZ_DOS_ARQUIVOS,
} from "@/supabase/functions/_shared/producao-caminho";
export type {
  CaminhoProducao,
  ExtensaoAceita,
  PastaDeArquivo,
} from "@/supabase/functions/_shared/producao-caminho";
