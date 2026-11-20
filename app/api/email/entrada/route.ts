// POST /api/email/entrada (P5.5): webhook "email.received" do Resend.
//
// O e-mail enviado para pc-<código>@<domínio de recebimento> vira despesas em
// análise na prestação do código, quando o remetente é da equipe com a
// prestação, o proponente dela ou um endereço autorizado. A assinatura do
// webhook é conferida antes de tudo; o banco diz o destino
// (fn_prestacao_captura_destino) e o registro em prestacao_emails_recebidos
// garante que o mesmo e-mail não entra duas vezes. Os anexos vêm da API do
// Resend (o webhook só traz os nomes); o XML de nota preenche os dados da
// despesa. Responde 200 também quando não aproveita nada, para o Resend não
// reenviar: o que aconteceu fica no registro, que a equipe vê na prestação.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { webhookDoResendValido } from "@/lib/email/webhook-resend";
import { tratarEventoDeReembolso } from "@/lib/ticketeria/pagamento/reembolso-entrada";
import { montarCaminhoPrestacao } from "@/lib/prestacao/armazenamento";
import { lerDocumentoFiscal } from "@/lib/prestacao/documento-fiscal";
import {
  agruparAnexos,
  anexosAproveitaveis,
  ehPdf,
  ehXmlAnexo,
  enderecoPuro,
  tokensDosDestinatarios,
  type AnexoRecebido,
} from "@/lib/prestacao/captura-email";

export const runtime = "nodejs";

const TAMANHO_MAXIMO = 15 * 1024 * 1024;
const API_RESEND = () => (process.env.RESEND_API_URL || "https://api.resend.com").replace(/\/$/, "");

type EventoRecebido = {
  type?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[];
    cc?: string[];
    received_for?: string[];
    subject?: string;
    created_at?: string;
    attachments?: AnexoRecebido[];
  };
};

type Destino = {
  prestacao_id: string;
  organization_id: string;
  titulo: string;
  autorizado: boolean;
  quem: string | null;
  usuario_id: string | null;
};

/** Baixa um anexo pela API do Resend; devolve o motivo quando não vem ou passa do limite. */
async function baixarAnexo(emailId: string, anexo: AnexoRecebido): Promise<{ bytes: Buffer; tipo: string } | { erro: string }> {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) return { erro: "envio de e-mail sem chave da API" };
  const meta = await fetch(`${API_RESEND()}/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(anexo.id)}`, {
    headers: { Authorization: `Bearer ${chave}` },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  const dados = await meta?.json().catch(() => null) as { download_url?: string; size?: number; content_type?: string } | null;
  if (!meta?.ok || !dados?.download_url) return { erro: `"${anexo.filename}" não pôde ser baixado` };
  if ((dados.size ?? 0) > TAMANHO_MAXIMO) return { erro: `"${anexo.filename}" passa de 15 MB` };
  const arquivo = await fetch(dados.download_url, { signal: AbortSignal.timeout(30_000) }).catch(() => null);
  if (!arquivo?.ok) return { erro: `"${anexo.filename}" não pôde ser baixado` };
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  if (bytes.length > TAMANHO_MAXIMO) return { erro: `"${anexo.filename}" passa de 15 MB` };
  return { bytes, tipo: dados.content_type || anexo.content_type || "application/octet-stream" };
}

/** Os campos da despesa tirados do XML da nota, quando ele é lido. */
function camposDoXml(texto: string) {
  const leitura = lerDocumentoFiscal(texto);
  if (!leitura.ok) return null;
  const d = leitura.documento;
  return {
    tipo: d.tipo,
    valor_extraido: d.valor,
    data_doc: d.emissao,
    numero_documento: d.numero,
    serie: d.serie,
    chave_acesso: d.chave,
    descricao_servico: d.descricao?.slice(0, 500) ?? null,
    iss: d.retencoes.iss,
    inss: d.retencoes.inss,
    irrf: d.retencoes.irrf,
    outras_retencoes: d.retencoes.outras,
  };
}

export async function POST(req: NextRequest) {
  const segredo = process.env.RESEND_WEBHOOK_SECRET;
  const dominio = process.env.NEXT_PUBLIC_PRESTACAO_EMAIL_DOMINIO;
  if (!segredo || !dominio) return NextResponse.json({ error: "nao_configurado" }, { status: 503 });

  const corpo = await req.text();
  if (!webhookDoResendValido(req.headers, corpo, segredo)) return NextResponse.json({ error: "assinatura_invalida" }, { status: 401 });

  const evento = JSON.parse(corpo) as EventoRecebido;
  const d = evento.data;
  if (evento.type !== "email.received" || !d?.email_id) return NextResponse.json({ ignorado: true });

  const tokens = tokensDosDestinatarios([...(d.to ?? []), ...(d.cc ?? []), ...(d.received_for ?? [])], dominio);
  if (tokens.length === 0) {
    // Não é de uma prestação: pode ser um pedido de reembolso de ingresso (Ticketeria, passo D).
    const reembolso = await tratarEventoDeReembolso(d);
    if (reembolso) return NextResponse.json(reembolso.corpo, { status: reembolso.status });
    return NextResponse.json({ ignorado: true });
  }

  const admin = createAdminClient();
  const remetente = enderecoPuro(d.from ?? "");
  const assunto = (d.subject ?? "").trim().slice(0, 500) || null;

  // Um e-mail vale para uma prestação: a primeira cujo endereço está entre os destinatários.
  let destino: Destino | null = null;
  for (const token of tokens) {
    const { data } = await admin.rpc("fn_prestacao_captura_destino" as never, { p_token: token, p_remetente: remetente } as never);
    if (data) { destino = data as Destino; break; }
  }
  if (!destino) return NextResponse.json({ ignorado: true });

  // O registro vem primeiro: se o mesmo e-mail chegar de novo, para aqui.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
  const { data: registro, error: erroRegistro } = await (admin as any).from("prestacao_emails_recebidos").insert({
    prestacao_id: destino.prestacao_id,
    resend_email_id: d.email_id,
    remetente: remetente.slice(0, 320),
    assunto,
    recebido_em: d.created_at ?? new Date().toISOString(),
    situacao: "falhou",
    anexos: (d.attachments ?? []).length,
    detalhe: "Em processamento.",
  }).select("id").single();
  if (erroRegistro) {
    if (erroRegistro.code === "23505") return NextResponse.json({ repetido: true });
    return NextResponse.json({ error: "registro_falhou" }, { status: 500 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
  const atualizar = (campos: Record<string, unknown>) => (admin as any).from("prestacao_emails_recebidos").update(campos).eq("id", registro.id);

  if (!destino.autorizado) {
    await atualizar({ situacao: "remetente_nao_autorizado", detalhe: `${remetente} não é da equipe nem está entre os remetentes autorizados.` });
    await admin.rpc("fn_prestacao_avisar_captura" as never, {
      p_prestacao_id: destino.prestacao_id,
      p_titulo: "E-mail recusado na captura",
      p_mensagem: `${remetente} mandou “${assunto ?? "sem assunto"}” para “${destino.titulo}”, mas não está autorizado. Se for o caso, autorize o remetente em “Receber por e-mail” e peça para reenviar.`,
      p_email_id: d.email_id,
      p_recusado: true,
    } as never);
    return NextResponse.json({ recusado: true });
  }

  const grupos = agruparAnexos(anexosAproveitaveis(d.attachments ?? []));
  if (grupos.length === 0) {
    await atualizar({ situacao: "sem_anexo", detalhe: "Nenhum PDF, XML ou foto no e-mail." });
    return NextResponse.json({ despesas: 0 });
  }

  const problemas: string[] = [];
  let despesas = 0;
  for (const grupo of grupos) {
    const arquivo = await baixarAnexo(d.email_id, grupo.arquivo);
    if ("erro" in arquivo) { problemas.push(arquivo.erro); continue; }
    let campos: ReturnType<typeof camposDoXml> = null;
    if (grupo.xml) {
      const xml = grupo.xml === grupo.arquivo ? arquivo : await baixarAnexo(d.email_id, grupo.xml);
      if ("erro" in xml) problemas.push(xml.erro);
      else campos = camposDoXml(xml.bytes.toString("utf8"));
    }
    const caminho = montarCaminhoPrestacao({
      organizationId: destino.organization_id,
      prestacaoId: destino.prestacao_id,
      pasta: { tipo: "comprovantes" },
      nomeOriginal: grupo.arquivo.filename,
    });
    const subida = await admin.storage.from("documentos").upload(caminho, arquivo.bytes, { contentType: arquivo.tipo, upsert: false });
    if (subida.error) { problemas.push(`"${grupo.arquivo.filename}" não pôde ser guardado`); continue; }
    const tipoPadrao = ehPdf(grupo.arquivo) || ehXmlAnexo(grupo.arquivo) ? "outro" : "foto";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- coluna canal ainda fora do tipo Database
    const { error } = await (admin as any).from("prestacao_comprovantes").insert({
      prestacao_id: destino.prestacao_id,
      nome_arquivo: grupo.arquivo.filename.slice(0, 300),
      storage_path: caminho,
      canal: "email",
      enviado_por: destino.usuario_id,
      tipo: campos?.tipo ?? tipoPadrao,
      valor_extraido: campos?.valor_extraido ?? null,
      data_doc: campos?.data_doc ?? null,
      numero_documento: campos?.numero_documento ?? null,
      serie: campos?.serie ?? null,
      chave_acesso: campos?.chave_acesso ?? null,
      descricao_servico: campos?.descricao_servico ?? assunto,
      iss: campos?.iss ?? 0,
      inss: campos?.inss ?? 0,
      irrf: campos?.irrf ?? 0,
      outras_retencoes: campos?.outras_retencoes ?? 0,
    });
    if (error) {
      await admin.storage.from("documentos").remove([caminho]);
      problemas.push(error.code === "23505" ? `"${grupo.arquivo.filename}" já está na prestação (mesma chave de acesso)` : `"${grupo.arquivo.filename}" não virou despesa`);
      continue;
    }
    despesas += 1;
  }

  await atualizar({
    situacao: despesas > 0 ? "registrado" : "falhou",
    despesas,
    detalhe: problemas.length ? problemas.join("; ").slice(0, 2000) : null,
  });
  if (despesas > 0) {
    await admin.rpc("fn_prestacao_avisar_captura" as never, {
      p_prestacao_id: destino.prestacao_id,
      p_titulo: despesas === 1 ? "Despesa recebida por e-mail" : `${despesas} despesas recebidas por e-mail`,
      p_mensagem: `De ${remetente}: “${assunto ?? "sem assunto"}”, em “${destino.titulo}”. Confira e avalie.`,
      p_email_id: d.email_id,
    } as never);
  }
  return NextResponse.json({ despesas, problemas });
}
