// Caminhos dos arquivos da prestação no bucket "documentos". A regra mora em
// supabase/functions/_shared para que o app e as edge functions usem o mesmo
// código; este arquivo só a expõe para o app.
export {
  ehUuid,
  extensaoDoArquivo,
  lerCaminhoPrestacao,
  montarCaminhoPrestacao,
  organizacaoDaPrestacao,
  SELECT_ORGANIZACAO_DA_PRESTACAO,
} from "@/supabase/functions/_shared/prestacao-caminho";
export type {
  CaminhoPrestacao,
  PastaPrestacao,
  PrestacaoComOrganizacao,
} from "@/supabase/functions/_shared/prestacao-caminho";
