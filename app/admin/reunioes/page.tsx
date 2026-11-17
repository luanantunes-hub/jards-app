// Uso e custo estimado de Reuniões, por organização (só administrador do Jards; o layout do /admin já esconde de quem não é). Serve para acompanhar o gasto conforme as pessoas
// usam: horas de robô, custo estimado e custo por hora. O custo é estimativa (tempo × taxas); o valor real está no painel do fornecedor da transcrição.

import { createAdminClient } from "@/lib/supabase/admin";
import { horasEmTexto, limitePadraoDoAmbiente, mesDe, resumoDeCusto, taxasDoAmbiente, type ReuniaoDeUso } from "@/lib/reunioes/custo";

export const dynamic = "force-dynamic";

type Linha = ReuniaoDeUso & { organization_id: string; status: string };

const dolar = (valor: number) => `US$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

export default async function AdminReunioesPage() {
  const admin = createAdminClient();
  const [reunioes, organizacoes, limites] = await Promise.all([
    admin.from("reunioes").select("organization_id, status, iniciada_em, duracao_bot_s, custo_estimado_usd"),
    admin.from("organizations").select("id, nome"),
    admin.from("reunioes_limites").select("organization_id, horas_por_mes"),
  ]);
  const linhas = (reunioes.data ?? []) as Linha[];
  const nomes = new Map((organizacoes.data ?? []).map(org => [org.id as string, org.nome as string]));
  const limitesPorOrg = new Map((limites.data ?? []).map(item => [item.organization_id as string, Number(item.horas_por_mes)]));
  const mes = mesDe(new Date());
  const taxas = taxasDoAmbiente(process.env);
  const limitePadrao = limitePadraoDoAmbiente(process.env);

  const orgIds = [...new Set(linhas.map(linha => linha.organization_id))];
  const porOrganizacao = orgIds.map(id => {
    const dela = linhas.filter(linha => linha.organization_id === id);
    const doMes = dela.filter(linha => linha.iniciada_em && mesDe(linha.iniciada_em) === mes);
    return { id, nome: nomes.get(id) ?? id.slice(0, 8), mes: resumoDeCusto(doMes), total: resumoDeCusto(dela), falhas: dela.filter(linha => linha.status === "falhou").length, limite: limitesPorOrg.get(id) ?? limitePadrao };
  }).sort((a, b) => b.mes.horas - a.mes.horas || b.total.horas - a.total.horas);
  const geralDoMes = resumoDeCusto(linhas.filter(linha => linha.iniciada_em && mesDe(linha.iniciada_em) === mes));
  const geral = resumoDeCusto(linhas);

  return (
    <div className="mx-auto max-w-[80rem] px-6 py-8">
      <h1 className="text-[1.5rem] font-semibold tracking-[-.02em] text-[#282525]">Reuniões: uso e custo</h1>
      <p className="mt-1 text-[0.8125rem] text-black/55">Horas de robô e custo <strong className="font-medium">estimado</strong> por organização. O valor cobrado de verdade está no painel do fornecedor da transcrição.</p>

      <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4 rounded border bg-white px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        {[
          ["Reuniões no total", String(geral.reunioes)],
          ["Horas neste mês", horasEmTexto(geralDoMes.horas)],
          ["Custo estimado neste mês", dolar(geralDoMes.custoUsd)],
          ["Custo estimado por hora", geral.custoPorHoraUsd === null ? "—" : dolar(geral.custoPorHoraUsd)],
          ["Referência: Vexa hospedado por hora", dolar(0.3)],
        ].map(([rotulo, valor]) => (
          <div key={rotulo}>
            <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{rotulo}</p>
            <p className="mt-1 text-[1.125rem] font-semibold tabular-nums text-[#282525]">{valor}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr style={{ background: "#F9F9F8" }}>
              {["Organização", "Neste mês", "Limite do mês", "Custo no mês", "No total", "Custo no total", "Por hora", "Falhas"].map(rotulo => (
                <th key={rotulo} className="px-4 py-3 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{rotulo}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[.06]">
            {porOrganizacao.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-black/45">Nenhuma reunião ainda.</td></tr>
            ) : porOrganizacao.map(org => (
              <tr key={org.id}>
                <td className="px-4 py-3 font-medium text-[#282525]">{org.nome}</td>
                <td className="px-4 py-3 tabular-nums">{org.mes.reunioes} · {horasEmTexto(org.mes.horas)}</td>
                <td className="px-4 py-3 tabular-nums" style={{ color: org.mes.horas >= org.limite ? "#D94A4A" : undefined }}>{horasEmTexto(org.limite)}</td>
                <td className="px-4 py-3 tabular-nums">{dolar(org.mes.custoUsd)}</td>
                <td className="px-4 py-3 tabular-nums">{org.total.reunioes} · {horasEmTexto(org.total.horas)}{org.total.semDuracao > 0 ? ` (${org.total.semDuracao} sem duração)` : ""}</td>
                <td className="px-4 py-3 tabular-nums">{dolar(org.total.custoUsd)}</td>
                <td className="px-4 py-3 tabular-nums">{org.total.custoPorHoraUsd === null ? "—" : dolar(org.total.custoPorHoraUsd)}</td>
                <td className="px-4 py-3 tabular-nums">{org.falhas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[0.75rem] text-black/45">
        Taxas em uso: robô {dolar(taxas.roboPorHoraUsd)} por hora, transcrição {dolar(taxas.transcricaoPorHoraUsd)} por hora de áudio, multiplicador {taxas.multiplicadorDaTranscricao.toLocaleString("pt-BR")}x. Limite padrão: {horasEmTexto(limitePadrao)} por mês.
        Mudam por variável de ambiente (REUNIOES_CUSTO_ROBO_HORA, REUNIOES_CUSTO_TRANSCRICAO_HORA, REUNIOES_MULTIPLICADOR, REUNIOES_HORAS_MES_PADRAO); o limite de uma organização, na tabela reunioes_limites.
      </p>
    </div>
  );
}
