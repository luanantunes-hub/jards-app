import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "relatorios-sustentabilidade";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

async function authenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function listReports(empresaId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("relatorios_sustentabilidade").select("*").eq("empresa_id", empresaId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function ensureBucket() {
  const admin = createAdminClient();
  const { data } = await admin.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await admin.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_FILE_SIZE, allowedMimeTypes: [...ALLOWED_TYPES] });
    if (error) throw error;
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await authenticatedUser()) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const { id } = await params;
    return NextResponse.json({ items: await listReports(id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível carregar os relatórios" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const form = await request.formData();
  const file = form.get("file");
  const reportId = String(form.get("reportId") ?? "").trim();
  if (!(file instanceof File)) return NextResponse.json({ error: "Selecione um arquivo" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Envie um arquivo PDF, DOC ou DOCX" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "O arquivo deve ter no máximo 50 MB" }, { status: 400 });

  const admin = createAdminClient();
  let previous: { id: string; storage_path: string } | null = null;
  if (reportId) {
    const { data, error } = await admin.from("relatorios_sustentabilidade").select("id,storage_path").eq("id", reportId).eq("empresa_id", id).maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });
    previous = data as { id: string; storage_path: string };
  } else {
    const { data, error } = await admin.from("relatorios_sustentabilidade").select("id").eq("empresa_id", id).limit(1);
    if (error) return NextResponse.json({ error: "Não foi possível verificar o relatório existente" }, { status: 500 });
    if (data && data.length > 0) return NextResponse.json({ error: "Esta empresa já possui um relatório. Use Trocar para atualizar o documento." }, { status: 409 });
  }

  let uploadedPath: string | null = null;
  let reportSaved = false;
  try {
    await ensureBucket();
    const rawExtension = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
    const extension = ["pdf", "doc", "docx"].includes(rawExtension) ? rawExtension : "pdf";
    const path = `${user.id}/${id}/${crypto.randomUUID()}.${extension}`;
    uploadedPath = path;
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(path);
    const payload = { empresa_id: id, nome: file.name, storage_path: path, url: publicUrl.publicUrl, tamanho_bytes: file.size, tipo_arquivo: file.type, uploaded_by: user.id, created_at: new Date().toISOString() };
    const result = previous
      ? await admin.from("relatorios_sustentabilidade").update(payload).eq("id", previous.id).eq("empresa_id", id)
      : await admin.from("relatorios_sustentabilidade").insert(payload);
    if (result.error) {
      await admin.storage.from(BUCKET).remove([path]);
      throw result.error;
    }
    reportSaved = true;
    if (previous?.storage_path && previous.storage_path !== path) {
      try {
        const { error: cleanupError } = await admin.storage.from(BUCKET).remove([previous.storage_path]);
        if (cleanupError) console.error("Não foi possível remover a versão anterior do relatório:", cleanupError.message);
      } catch (cleanupError) {
        console.error("Não foi possível remover a versão anterior do relatório:", cleanupError);
      }
    }
    return NextResponse.json({ items: await listReports(id) });
  } catch (error) {
    if (uploadedPath && !reportSaved) {
      try { await admin.storage.from(BUCKET).remove([uploadedPath]); } catch { /* limpeza de melhor esforço */ }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar o relatório" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await authenticatedUser()) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const reportId = new URL(request.url).searchParams.get("reportId");
  if (!reportId) return NextResponse.json({ error: "Relatório não informado" }, { status: 400 });
  const admin = createAdminClient();
  const { data: report } = await admin.from("relatorios_sustentabilidade").select("id,storage_path").eq("id", reportId).eq("empresa_id", id).maybeSingle();
  if (!report) return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });
  const { error } = await admin.from("relatorios_sustentabilidade").delete().eq("id", reportId).eq("empresa_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.storage.from(BUCKET).remove([report.storage_path]);
  return NextResponse.json({ items: await listReports(id) });
}
