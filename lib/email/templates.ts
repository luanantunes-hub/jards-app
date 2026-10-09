function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function emailShell(content: string) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f6f6f4;font-family:Arial,sans-serif;color:#282525">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f6f6f4"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e8e8e5;border-radius:8px;overflow:hidden">
      <tr><td style="padding:28px 32px 8px"><img src="https://ykaymbmybellixxvtasi.supabase.co/storage/v1/object/public/email-assets/logo-jards.png" alt="Jards" width="96" style="display:block;width:96px;height:auto;border:0"></td></tr>
      <tr><td style="padding:20px 32px 32px">${content}</td></tr>
    </table>
    <p style="margin:18px 0 0;color:#8a8a86;font-size:11px">Mensagem transacional enviada pela Jards.</p>
  </td></tr></table>
</body></html>`;
}

// Convite para acompanhar a prestação de contas (P5.3).
export function conviteDaPrestacaoEmail(input: {
  recipientName?: string | null;
  organizacao: string;
  convidadoPor?: string | null;
  prestacao: string;
  secoes: string;
  validade: string;
  mensagem?: string | null;
  url: string;
}) {
  const recipient = input.recipientName?.trim()
    ? `Olá, ${escapeHtml(input.recipientName.trim().split(" ")[0])}.`
    : "Olá.";
  const quem = input.convidadoPor?.trim() ? `${input.convidadoPor.trim()}, de ${input.organizacao},` : input.organizacao;
  const url = escapeHtml(input.url);
  const mensagem = input.mensagem?.trim()
    ? `<p style="margin:0 0 20px;padding:12px 14px;border-left:2px solid #e8e8e5;font-size:13px;line-height:1.6;color:#61615d">${escapeHtml(input.mensagem.trim()).replace(/\n/g, "<br>")}</p>`
    : "";

  return {
    subject: `Convite para acompanhar a prestação de contas de ${input.prestacao}`,
    text: `${recipient} ${quem} convidou você para acompanhar a prestação de contas de ${input.prestacao} (${input.secoes}), até ${input.validade}. Abra o convite: ${input.url}`,
    html: emailShell(`
      <p style="margin:0 0 12px;font-size:14px;color:#555">${recipient}</p>
      <h1 style="margin:0 0 12px;font-size:23px;line-height:1.25;letter-spacing:-.5px">${escapeHtml(quem)} convidou você para acompanhar a prestação de contas de ${escapeHtml(input.prestacao)}.</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#61615d">Você poderá ler ${escapeHtml(input.secoes.toLowerCase())}, comentar e marcar itens como verificados, até ${escapeHtml(input.validade)}. Entre com a conta deste e-mail.</p>
      ${mensagem}
      <a href="${url}" style="display:inline-block;padding:12px 18px;border-radius:6px;background:#282525;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700">Abrir o convite</a>
      <p style="margin:24px 0 0;font-size:11px;line-height:1.5;color:#999">Se o botão não abrir, copie este endereço:<br>${url}</p>
    `),
  };
}

export function patrocinadorProntoEmail(input: {
  recipientName?: string | null;
  empresaName: string;
  url: string;
}) {
  const recipient = input.recipientName?.trim()
    ? `Olá, ${escapeHtml(input.recipientName.trim().split(" ")[0])}.`
    : "Olá.";
  const empresa = escapeHtml(input.empresaName);
  const url = escapeHtml(input.url);

  return {
    subject: `${input.empresaName} está disponível na Jards`,
    text: `${recipient} A pesquisa de ${input.empresaName} foi concluída. Consulte os dados em ${input.url}`,
    html: emailShell(`
      <p style="margin:0 0 12px;font-size:14px;color:#555">${recipient}</p>
      <h1 style="margin:0 0 12px;font-size:25px;line-height:1.2;letter-spacing:-.6px">A pesquisa de ${empresa} está pronta.</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.65;color:#61615d">Os dados do patrocinador já estão disponíveis para consulta no seu espaço.</p>
      <a href="${url}" style="display:inline-block;padding:12px 18px;border:1px solid #2e8932;border-radius:6px;background:#ffffff;color:#2e8932;text-decoration:none;font-size:13px;font-weight:700">Ver patrocinador</a>
      <p style="margin:24px 0 0;font-size:11px;line-height:1.5;color:#999">Se o botão não abrir, copie este endereço:<br>${url}</p>
    `),
  };
}
