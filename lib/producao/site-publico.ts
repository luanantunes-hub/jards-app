import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diasDaProgramacaoDoEspaco } from "@/lib/producao/programacao-publica";
import type { DiaPublico } from "@/lib/producao/programacao";
import { blocosDoJson, corDoTema, hostDoPedido, ordemDasPaginas, type Bloco } from "@/lib/producao/site";
import type { Database } from "@/lib/supabase/types";

// O site público do espaço (PD12.1): o que a página de um domínio da pessoa mostra. Sem login: o servidor lê com a chave de
// serviço e só devolve o que está PUBLICADO (nunca o rascunho), de um site publicado, num domínio ativo (conferido o DNS e a
// posse). O que não existe ou não está no ar responde igual: "não encontrado".

type Admin = SupabaseClient<Database>;

export type SitePublico = {
  titulo: string; cor: string; organizacao: string; espaco: string;
  menu: { slug: string; titulo: string }[];
  pagina: { slug: string; titulo: string; blocos: Bloco[] };
  /** As sessões confirmadas do espaço, só carregadas quando a página tem o bloco de programação. */
  programacao: DiaPublico[] | null;
};

/** A página `slug` do site que está no ar no domínio `host`, ou null. */
export async function paginaPublicaDoDominio(admin: Admin, host: string, slug: string): Promise<SitePublico | null> {
  const dominio = hostDoPedido(host);
  if (dominio === "") return null;
  const producao = clienteDaProducao(admin);
  const { data: registro, error } = await producao.from("producao_site_dominios").select("site_id, situacao").eq("dominio", dominio).maybeSingle();
  if (error) throw new Error("não foi possível conferir o domínio");
  if (!registro || registro.situacao !== "ativo") return null;
  const { data: site } = await producao.from("producao_sites").select("id, organization_id, espaco_id, nome, titulo, cor, situacao").eq("id", registro.site_id).maybeSingle();
  if (!site || site.situacao !== "publicado") return null;
  const { data: paginas } = await producao.from("producao_site_paginas").select("slug, titulo, ordem, blocos_publicados").eq("site_id", site.id).not("blocos_publicados", "is", null);
  const publicadas = ordemDasPaginas(paginas ?? []);
  const atual = publicadas.find(pagina => pagina.slug === slug);
  if (!atual) return null;
  const blocos = blocosDoJson(atual.blocos_publicados);
  const [espaco, organizacao, programacao] = await Promise.all([
    producao.from("producao_espacos").select("nome").eq("id", site.espaco_id).maybeSingle(),
    admin.from("organizations").select("nome").eq("id", site.organization_id).maybeSingle(),
    blocos.some(bloco => bloco.tipo === "programacao") ? diasDaProgramacaoDoEspaco(admin, site.espaco_id) : Promise.resolve(null),
  ]);
  return {
    titulo: site.titulo ?? site.nome,
    cor: corDoTema(site.cor),
    organizacao: (organizacao.data as { nome?: string | null } | null)?.nome ?? "",
    espaco: espaco.data?.nome ?? "",
    menu: publicadas.map(pagina => ({ slug: pagina.slug, titulo: pagina.titulo })),
    pagina: { slug: atual.slug, titulo: atual.titulo, blocos },
    programacao: programacao ? programacao.dias : null,
  };
}
