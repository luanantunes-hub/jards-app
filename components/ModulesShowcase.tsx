"use client";

import { useState } from "react";
import {
  BarChart2, Calendar, Folder, Briefcase, FileText,
  Building2, Users, Globe, Building, UserCheck, Phone,
  Settings, Bell, LogOut, Clock,
} from "lucide-react";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";

/* ── helpers ─────────────────────────────────────────────── */
function Logo({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 4, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: Math.round(size * 0.38), fontWeight: 600, color: "#9e9ea8",
        background: "linear-gradient(145deg,#f8f8fb 0%,#d4d4dc 100%)",
        border: "1px solid rgba(13,13,13,.08)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 1px 2px rgba(0,0,0,.06)",
      }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </div>
  );
}

const LEI: Record<string, [string, string]> = {
  Rouanet:     ["rgba(114,89,181,.28)", "#7259B5"],
  Audiovisual: ["rgba(26,139,122,.28)", "#1A8B7A"],
  Esporte:     ["rgba(45,114,176,.28)", "#2D72B0"],
};
function LeiBadge({ lei }: { lei: string }) {
  const [borda, c] = LEI[lei] ?? ["rgba(13,13,13,.12)", "rgba(13,13,13,.45)"];
  return (
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 4, background: "#fff", border: `1px solid ${borda}`, color: c }}>
      {lei}
    </span>
  );
}

function SegBtn({ label, on }: { label: string; on?: boolean }) {
  return (
    <span
      style={{
        padding: "0 14px", height: 34, display: "flex", alignItems: "center",
        fontSize: 12, fontWeight: 600, cursor: "default", whiteSpace: "nowrap",
        background: on ? "#282525" : "#fff",
        color: on ? "#fff" : "rgba(13,13,13,.45)",
        borderRight: "1px solid rgba(13,13,13,.12)",
      }}
    >
      {label}
    </span>
  );
}

function SearchBox({ placeholder }: { placeholder: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, height: 34, padding: "0 12px", border: "1px solid rgba(13,13,13,.12)", borderRadius: 4, background: "#fff", minWidth: 200 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .3, flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <span style={{ fontSize: 13, color: "rgba(13,13,13,.35)" }}>{placeholder}</span>
    </div>
  );
}

function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "10px 32px", borderBottom: "1px solid rgba(13,13,13,.08)" }}>
      {children}
    </div>
  );
}

function OutlineBtn({ children }: { children: React.ReactNode }) {
  return (
    <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 14px", height: 34, background: "#fff", border: "1px solid rgba(13,13,13,.12)", borderRadius: 4, fontSize: 12, fontWeight: 700, color: "rgba(13,13,13,.65)", whiteSpace: "nowrap", cursor: "default" }}>
      {children}
    </button>
  );
}

/* ── sidebar ─────────────────────────────────────────────── */
const NAV_GROUPS = [
  { section: "Gerenciamento", items: [
    { label: "Visão Geral",   Icon: BarChart2,  navKey: null },
    { label: "Atividades",    Icon: Calendar,   navKey: "Atividades" },
    { label: "Projetos",      Icon: Folder,     navKey: null },
  ]},
  { section: "Oportunidades", items: [
    { label: "Patrocinadores", Icon: Briefcase, navKey: "Patrocinadores" },
    { label: "Editais",        Icon: FileText,  navKey: "Editais" },
  ]},
  { section: "Prospecções", items: [
    { label: "Empresas",    Icon: Building2, navKey: null },
    { label: "Negociações", Icon: Users,     navKey: "Negociações" },
    { label: "Inscrições",  Icon: Globe,     navKey: null },
  ]},
  { section: "Relacionamento", items: [
    { label: "Proponentes", Icon: Building,  navKey: null },
    { label: "Captadores",  Icon: UserCheck, navKey: null },
    { label: "Contatos",    Icon: Phone,     navKey: null },
  ]},
];
const BOTTOM = [
  { label: "Configurações", Icon: Settings },
  { label: "Notificações",  Icon: Bell },
  { label: "Sair",          Icon: LogOut },
];

function Sidebar({ activeNavKey }: { activeNavKey: string | null }) {
  return (
    <aside style={{ width: 224, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff", borderRight: "1px solid rgba(13,13,13,.08)", boxShadow: "4px 0 24px rgba(0,0,0,.06)" }}>
      {/* logo */}
      <div style={{ height: 56, display: "flex", alignItems: "center", gap: 9, padding: "0 20px", borderBottom: "1px solid rgba(13,13,13,.07)", flexShrink: 0 }}>
        <svg width="20" height="20" viewBox="0 0 689 689"><path fill="#D94E4E" d="M0,168h194c-2,19-9,38-11,58C170,411,341,548,519,495v194H0V168Z"/><path fill="#7259B5" d="M675,338H355l-4-4V15C548-57,743,141,675,338Z"/></svg>
        <span style={{ fontFamily: "var(--font-newsreader), Georgia, serif", fontSize: 16, fontWeight: 700, color: "#282525" }}>Jards</span>
      </div>
      {/* user */}
      <div style={{ padding: 8, borderBottom: "1px solid rgba(13,13,13,.07)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 4 }}>
          <div style={{ width: 28, height: 28, borderRadius: 4, background: "#7259B5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>L</div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#282525", lineHeight: 1.3 }}>Luana</p>
            <p style={{ fontSize: 10, color: "rgba(13,13,13,.35)" }}>Plano Pro</p>
          </div>
        </div>
      </div>
      {/* nav */}
      <nav style={{ flex: 1, padding: "12px 8px", overflow: "hidden" }}>
        {NAV_GROUPS.map((g, gi) => (
          <div key={gi} style={{ marginTop: gi > 0 ? 16 : 0 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase", color: "rgba(13,13,13,.30)", padding: "0 8px", marginBottom: 6 }}>{g.section}</p>
            {g.items.map((it) => {
              const active = it.navKey === activeNavKey;
              return (
                <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 4, fontSize: 13, fontWeight: 500, marginBottom: 2, whiteSpace: "nowrap", background: active ? "#1a1a1a" : "transparent", color: active ? "#fff" : "rgba(13,13,13,.40)", cursor: "default" }}>
                  <it.Icon size={15} />
                  {it.label}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
      {/* bottom */}
      <div style={{ padding: 8, borderTop: "1px solid rgba(13,13,13,.07)", flexShrink: 0 }}>
        {BOTTOM.map((it) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 4, fontSize: 13, fontWeight: 500, color: "rgba(13,13,13,.40)", cursor: "default" }}>
            <it.Icon size={15} />
            {it.label}
          </div>
        ))}
      </div>
    </aside>
  );
}

/* ── page header ─────────────────────────────────────────── */
function PageHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: string }) {
  return (
    <div style={{ flexShrink: 0, padding: "28px 32px 20px", borderBottom: "1px solid rgba(13,13,13,.08)" }}>
      {eyebrow && <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(13,13,13,.30)", marginBottom: 4 }}>{eyebrow}</p>}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ fontFamily: "var(--font-newsreader), Georgia, serif", fontSize: 26, fontWeight: 700, letterSpacing: "-.025em", color: "#282525" }}>{title}</h1>
        {action && <OutlineBtn>{action}</OutlineBtn>}
      </div>
    </div>
  );
}

/* ── EDITAIS ─────────────────────────────────────────────── */
const EDITAIS = [
  { co: "Itaú Cultural",  state: "SP", title: "Rumos Dança 2025–2026",             urgency: "urgente", ab: "15/04/25", fe: "05/09/25" },
  { co: "Petrobras",      state: "RJ", title: "Seleção Projetos Audiovisual 2025",  urgency: "soon",    ab: "20/03/25", fe: "20/10/25" },
  { co: "Bradesco",       state: "SP", title: "Bolsa de Incentivo Cultural",        urgency: "open",    ab: "01/07/25", fe: "30/11/25" },
  { co: "Natura",         state: "SP", title: "Programa Amazônia Viva — Arte",      urgency: "open",    ab: "10/06/25", fe: "15/12/25" },
  { co: "Ambev",          state: "SP", title: "Bora — Música e Comunidades",        urgency: "urgente", ab: "01/08/25", fe: "10/09/25" },
  { co: "Vale",           state: "MG", title: "Fundo Local de Cultura 2025",        urgency: "soon",    ab: "15/07/25", fe: "01/11/25" },
];
const URG_BADGE: Record<string, [string, string, string]> = {
  urgente: ["rgba(217,78,78,.28)",  "#D94E4E", "Urgente"],
  soon:    ["rgba(176,122,20,.28)", "#B07A14", "Próximo"],
  open:    ["rgba(46,137,50,.28)",  "#2E8932", "Aberto"],
};

function EditaisPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PageHeader title="Editais" action="Sugerir edital" />
      <Toolbar>
        <SearchBox placeholder="Buscar edital, empresa, estado…" />
        <span style={{ fontSize: 13, color: "rgba(13,13,13,.40)" }}><strong style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "#282525" }}>47</strong> editais</span>
        <div style={{ marginLeft: "auto", display: "flex", border: "1px solid rgba(13,13,13,.12)", borderRadius: 4, overflow: "hidden" }}>
          <SegBtn label="Abertos" on />
          <SegBtn label="Fechados" />
        </div>
      </Toolbar>
      <div style={{ flex: 1, overflow: "hidden", padding: "16px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {EDITAIS.map((e) => {
            const [borda, c, lbl] = URG_BADGE[e.urgency];
            return (
              <div key={e.co} style={{ border: "1px solid rgba(13,13,13,.08)", borderRadius: 4, padding: 18, background: "linear-gradient(145deg,#ffffff 0%,#f7f7f6 100%)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Logo name={e.co} size={44} />
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 700, color: "#282525" }}>{e.co}</p>
                      <p style={{ fontSize: 11, color: "rgba(13,13,13,.35)" }}>{e.state}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".05em", padding: "2px 6px", borderRadius: 4, background: "rgba(13,13,13,.07)", color: "rgba(13,13,13,.50)" }}>ADM</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "#fff", border: `1px solid ${borda}`, color: c }}>{lbl}</span>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: "rgba(13,13,13,.50)", lineHeight: 1.45, marginBottom: 12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.title}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 10 }}>
                  <div>
                    <p style={{ fontWeight: 500, textTransform: "uppercase", letterSpacing: ".08em", color: "rgba(13,13,13,.45)", marginBottom: 2 }}>Abertura</p>
                    <p style={{ fontWeight: 500, color: "rgba(13,13,13,.60)" }}>{e.ab}</p>
                  </div>
                  <div>
                    <p style={{ fontWeight: 500, textTransform: "uppercase", letterSpacing: ".08em", color: "rgba(13,13,13,.45)", marginBottom: 2 }}>Fechamento</p>
                    <p style={{ fontWeight: 500, color: "rgba(13,13,13,.60)" }}>{e.fe}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── NEGOCIAÇÕES ─────────────────────────────────────────── */
const STATUS_COLOR: Record<string, { label: string; color: string }> = {
  prospeccao:       { label: "Prospecção", color: "rgba(13,13,13,.35)" },
  primeiro_contato: { label: "1º Contato", color: "#7259B5" },
  proposta_enviada: { label: "Proposta",   color: "#2D72B0" },
  em_negociacao:    { label: "Negociação", color: "#B07A14" },
};
const KANBAN_COLS = [
  { key: "prospeccao", cards: [
    { co: "TV Cultura",  title: "Captação Rouanet — Série Documental",  lei: "Rouanet",    val: 80000,  cap: "R" },
    { co: "Sabesp",      title: "Programa Ambiental e Arte 2025",       lei: "Rouanet",    val: 120000, cap: "M" },
  ]},
  { key: "primeiro_contato", cards: [
    { co: "Porto Seguro", title: "Patrocínio Lei Esporte — Atletismo",   lei: "Esporte",    val: 90000,  cap: "F", dt: "22/09" },
    { co: "Embraer",      title: "Arte e Inovação — Projeto Cultural",   lei: "Rouanet",    val: 160000, cap: "R" },
  ]},
  { key: "proposta_enviada", cards: [
    { co: "Itaú BBA",   title: "Rouanet 2025 — Ciclo de Shows Nacionais", lei: "Rouanet",    val: 200000, cap: "L", dt: "30/09" },
    { co: "Petrobras",  title: "Documentário Audiovisual 2025",            lei: "Audiovisual",val: 280000, cap: "M" },
  ]},
  { key: "em_negociacao", cards: [
    { co: "Ambev",      title: "Rouanet — Turnê Nacional Música Brasileira", lei: "Rouanet", val: 350000, cap: "R", dt: "12/09" },
  ]},
];

function NegociacoesPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PageHeader eyebrow="Pipeline comercial" title="Negociações" action="+ Nova negociação" />
      <Toolbar>
        <SearchBox placeholder="Buscar negociação…" />
        <div style={{ display: "flex", border: "1px solid rgba(13,13,13,.12)", borderRadius: 4, overflow: "hidden" }}>
          <SegBtn label="Todas" on /><SegBtn label="Abertas" /><SegBtn label="Recentes" />
        </div>
      </Toolbar>
      <div style={{ flex: 1, overflow: "hidden", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, padding: "14px 32px" }}>
        {KANBAN_COLS.map((col) => {
          const { label, color } = STATUS_COLOR[col.key];
          return (
            <div key={col.key} style={{ display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 8, borderBottom: `2px solid ${color}` }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "rgba(13,13,13,.75)" }}>{label}</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 100, background: "rgba(13,13,13,.08)", color: "rgba(13,13,13,.50)" }}>{col.cards.length}</span>
              </div>
              {col.cards.map((c) => (
                <div key={c.co} style={{ border: "1px solid rgba(13,13,13,.08)", borderRadius: 4, padding: 12, background: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Logo name={c.co} size={18} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(13,13,13,.50)" }}>{c.co}</span>
                    </div>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#7259B5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#fff" }}>{c.cap}</div>
                  </div>
                  <p style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.35, letterSpacing: "-.01em", color: "rgba(40,37,37,.85)", marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.title}</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <LeiBadge lei={c.lei} />
                    <span title={formatarValorCompleto(c.val)} style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "#282525" }}>{formatarValorCurto(c.val)}</span>
                  </div>
                  {"dt" in c && c.dt && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(13,13,13,.06)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, fontWeight: 500 }}>
                      <span style={{ color: "rgba(13,13,13,.45)" }}>Próx. contato</span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontVariantNumeric: "tabular-nums", color: "rgba(13,13,13,.6)" }}>
                        <Calendar size={12} strokeWidth={1.75} color="rgba(13,13,13,.4)" aria-hidden="true" />
                        {c.dt}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── ATIVIDADES ──────────────────────────────────────────── */
const ATIVS = [
  { done: false, nome: "Enviar proposta Rouanet atualizada", tipo: "Email",   neg: "Captação Itaú BBA",   co: "Itaú BBA",    prazo: "hoje",   prio: ["rgba(217,78,78,.28)", "#D94E4E",   "Alta"]  },
  { done: false, nome: "Reunião de alinhamento do projeto",  tipo: "Reunião", neg: "Ambev — Turnê",       co: "Ambev",       prazo: "amanhã", prio: ["rgba(176,122,20,.28)", "#B07A14", "Média"] },
  { done: true,  nome: "Follow-up sobre edital Rouanet",     tipo: "Ligação", neg: "Petrobras Audio",     co: "Petrobras",   prazo: "ontem",  prio: ["rgba(13,13,13,.12)", "rgba(13,13,13,.45)", "Baixa"] },
  { done: false, nome: "Conectar com dir. de patrocínio",    tipo: "LinkedIn",neg: "Prosp. Porto Seg.",   co: "Porto Seguro",prazo: "seg",    prio: ["rgba(176,122,20,.28)", "#B07A14", "Média"] },
  { done: true,  nome: "Confirmar reunião presencial",        tipo: "Email",   neg: "Proposta Embraer",    co: "Embraer",     prazo: "ontem",  prio: ["rgba(217,78,78,.28)", "#D94E4E",   "Alta"]  },
  { done: false, nome: "Preparar relatório de atividades",   tipo: "Tarefa",  neg: "—",                   co: "Interno",     prazo: "sexta",  prio: ["rgba(13,13,13,.12)", "rgba(13,13,13,.45)", "Baixa"] },
] as const;
const DEADLINE_COLOR: Record<string, string> = { hoje: "rgba(13,13,13,.55)", amanhã: "rgba(13,13,13,.55)", sexta: "rgba(13,13,13,.55)", seg: "rgba(13,13,13,.55)", ontem: "rgba(13,13,13,.35)" };
const TH = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35 bg-[#F9F9F8] px-3.5 py-2.5 text-left whitespace-nowrap";

function AtividadesPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PageHeader eyebrow="Gestão" title="Atividades" action="+ Nova atividade" />
      <Toolbar>
        <SearchBox placeholder="Buscar atividade…" />
        <div style={{ display: "flex", border: "1px solid rgba(13,13,13,.12)", borderRadius: 4, overflow: "hidden" }}>
          <SegBtn label="Pendentes" on /><SegBtn label="Concluídas" />
        </div>
        <div style={{ display: "flex", border: "1px solid rgba(13,13,13,.12)", borderRadius: 4, overflow: "hidden" }}>
          <SegBtn label="Todas" on /><SegBtn label="Email" /><SegBtn label="Reunião" /><SegBtn label="Tarefa" />
        </div>
      </Toolbar>
      <div style={{ flex: 1, overflow: "hidden", padding: "0 0 0 32px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(13,13,13,.07)" }}>
              <th className={TH} />
              <th className={TH}>Atividade</th>
              <th className={TH}>Negociação</th>
              <th className={TH}>Empresa</th>
              <th className={TH}>Prazo</th>
              <th className={TH}>Prioridade</th>
              <th className={TH}>Resp.</th>
            </tr>
          </thead>
          <tbody>
            {ATIVS.map((a, i) => (
              <tr key={i} style={{ borderBottom: "1px solid rgba(13,13,13,.045)" }}>
                <td style={{ padding: "11px 14px" }}>
                  <div style={{ width: 17, height: 17, borderRadius: "50%", border: a.done ? "1.5px solid #2E8932" : "1.5px solid rgba(13,13,13,.20)", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#2E8932" }}>
                    {a.done ? "✓" : ""}
                  </div>
                </td>
                <td style={{ padding: "11px 14px" }}>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: a.done ? "rgba(13,13,13,.30)" : "rgba(13,13,13,.75)", textDecoration: a.done ? "line-through" : "none" }}>{a.nome}</p>
                  <p style={{ fontSize: 10, color: "rgba(13,13,13,.30)" }}>{a.tipo}</p>
                </td>
                <td style={{ padding: "11px 14px", fontSize: 11.5, fontWeight: 500, color: "rgba(13,13,13,.55)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.neg}</td>
                <td style={{ padding: "11px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <Logo name={a.co} size={22} />
                    <span style={{ fontSize: 11.5, fontWeight: 500, color: "rgba(13,13,13,.60)" }}>{a.co}</span>
                  </div>
                </td>
                <td style={{ padding: "11px 14px", fontSize: 11.5, fontWeight: 500, color: DEADLINE_COLOR[a.prazo] ?? "rgba(13,13,13,.50)", whiteSpace: "nowrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                    {a.prazo === "hoje" && <Clock size={12} strokeWidth={1.75} color="#B07A14" aria-hidden="true" />}
                    {a.prazo}
                  </span>
                </td>
                <td style={{ padding: "11px 14px" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 100, background: "#fff", border: `1px solid ${a.prio[0]}`, color: a.prio[1] }}>{a.prio[2]}</span>
                </td>
                <td style={{ padding: "11px 14px", fontSize: 11.5, color: "rgba(13,13,13,.55)" }}>Luana M.</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── PATROCINADORES ──────────────────────────────────────── */
const SPS = [
  { co: "Itaú Cultural",      sec: "Banco",      lei: "Rouanet",    editais: 24, negs: 3, inscs: 8  },
  { co: "Petrobras Cultural", sec: "Energia",    lei: "Audiovisual",editais: 18, negs: 2, inscs: 5  },
  { co: "Bradesco Seguros",   sec: "Seguros",    lei: "Rouanet",    editais: 12, negs: 1, inscs: 3  },
  { co: "Natura & Co",        sec: "Cosméticos", lei: "Rouanet",    editais: 9,  negs: 4, inscs: 12 },
  { co: "Ambev",              sec: "Bebidas",    lei: "Rouanet",    editais: 7,  negs: 1, inscs: 2  },
  { co: "Vale",               sec: "Mineração",  lei: "Esporte",    editais: 15, negs: 2, inscs: 6  },
];

function PatrocinadoresPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PageHeader title="Patrocinadores" action="+ Patrocinador" />
      <Toolbar>
        <SearchBox placeholder="Buscar empresa, segmento…" />
        <div style={{ display: "flex", border: "1px solid rgba(13,13,13,.12)", borderRadius: 4, overflow: "hidden" }}>
          <SegBtn label="Todos" on /><SegBtn label="Rouanet" /><SegBtn label="Esporte" /><SegBtn label="Audiovisual" />
        </div>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "rgba(13,13,13,.40)" }}><strong style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "#282525" }}>312</strong> empresas</span>
      </Toolbar>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(13,13,13,.07)" }}>
              {["Empresa", "Lei", "Editais abertos", "Negociações", "Inscrições"].map((h) => (
                <th key={h} className={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SPS.map((s) => (
              <tr key={s.co} style={{ borderBottom: "1px solid rgba(13,13,13,.045)" }}>
                <td style={{ padding: "13px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Logo name={s.co} size={32} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#282525" }}>{s.co}</p>
                      <p style={{ fontSize: 11, color: "rgba(13,13,13,.40)" }}>{s.sec}</p>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "13px 14px" }}><LeiBadge lei={s.lei} /></td>
                <td style={{ padding: "13px 14px", fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "#282525" }}>{s.editais}</td>
                <td style={{ padding: "13px 14px", fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "#282525" }}>{s.negs} <span style={{ fontSize: 11, fontWeight: 400, color: "rgba(13,13,13,.40)" }}>negociações</span></td>
                <td style={{ padding: "13px 14px", fontSize: 13, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "#282525" }}>{s.inscs} <span style={{ fontSize: 11, fontWeight: 400, color: "rgba(13,13,13,.40)" }}>inscrições</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── main export ─────────────────────────────────────────── */
const TABS = [
  { label: "Editais Abertos",  navKey: "Editais",         Panel: EditaisPanel },
  { label: "Negociações",      navKey: "Negociações",      Panel: NegociacoesPanel },
  { label: "Atividades",       navKey: "Atividades",       Panel: AtividadesPanel },
  { label: "Patrocinadores",   navKey: "Patrocinadores",   Panel: PatrocinadoresPanel },
];

export default function ModulesShowcase() {
  const [active, setActive] = useState(0);
  const { navKey, Panel } = TABS[active];

  return (
    <section className="max-w-[67.5rem] mx-auto w-full">
      {/* chamada */}
      <p className="text-center text-[0.625rem] font-bold uppercase tracking-[.12em] text-[#7259B5] mb-3.5">Plataforma</p>
      <h2 className="text-center text-[clamp(26px,3.8vw,40px)] font-extrabold leading-[1.18] text-balance mb-3" style={{ fontFamily: "var(--font-newsreader), Georgia, serif" }}>
        Tudo que você precisa para captar<br className="hidden sm:block" /> com mais estratégia
      </h2>
      <p className="text-center text-[0.9375rem] leading-[1.7] text-black/45 max-w-[30rem] mx-auto mb-10">
        Do mapeamento de editais à gestão do relacionamento com patrocinadores — em um só lugar.
      </p>

      {/* tabs */}
      <div className="flex justify-center border-b border-black/[.08] mb-0">
        {TABS.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className="px-6 py-2.5 text-[0.8125rem] font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap"
            style={{
              borderColor: active === i ? "#7259B5" : "transparent",
              color: active === i ? "#7259B5" : "rgba(13,13,13,.40)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* app shell */}
      <div
        className="flex overflow-hidden rounded-b"
        style={{ height: 490, border: "1px solid rgba(13,13,13,.08)", borderTop: "none", boxShadow: "0 2px 4px rgba(0,0,0,.04),0 8px 40px rgba(0,0,0,.10)" }}
      >
        <Sidebar activeNavKey={navKey} />
        <main style={{ flex: 1, minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column", background: "#fff" }}>
          <Panel />
        </main>
      </div>
    </section>
  );
}
