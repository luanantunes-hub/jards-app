"use client";
import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

/* ─── Public types ─────────────────────────────────────────────────────── */

export interface CaptadorInput {
  id: string; nome: string; prioridade: string;
  n_captacoes: number; n_aprovadas: number; valor_captado: number;
  logo_url?: string | null;
}
export interface EmpresaInput {
  id: string; nome: string;
  domain_key?: string | null; site?: string | null;
}
export interface ConexaoInput {
  captador_id: string; empresa: EmpresaInput; status: string;
}

/* ─── Internal types ───────────────────────────────────────────────────── */

interface Hub  { id: string; nome: string; color: string; r: number; x: number; y: number;
                 logoUrl: string | null; img: HTMLImageElement | null; imgOk: boolean }
interface Card { id: string; nome: string; dominio: string | null; color: string;
                 x: number; y: number; img: HTMLImageElement | null; imgOk: boolean }
interface Edge { hub: Hub; card: Card; status: string }

/* ─── Constants ────────────────────────────────────────────────────────── */

const HUB_COLORS = ["#7259B5","#2563EB","#2E8932","#D94E4E","#B07A14","#2D72B0","#7259B5","#9D174D"];

const STATUS_COLOR: Record<string, string> = {
  ativa:    "#2E8932",
  suspensa: "#B07A14",
  expirada: "#D94E4E",
};

// Aceita o nome legado usado pelo projeto e o nome canônico atual.
const LOGODEV = process.env.NEXT_PUBLIC_LOGODEV_TOKEN ?? process.env.NEXT_PUBLIC_LOGODOTDEV_TOKEN ?? "";

const CARD_W = 44, CARD_H = 44, CARD_R = 8;

/* ─── Utilities ────────────────────────────────────────────────────────── */

function initials(s: string) {
  const p = s.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : s.slice(0, 2).toUpperCase();
}

function resolveDomain(e: EmpresaInput): string | null {
  const raw = e.domain_key ?? e.site;
  if (raw) {
    try {
      const u = raw.startsWith("http") ? raw : `https://${raw}`;
      return new URL(u).hostname.replace(/^www\./, "");
    } catch {
      return raw.replace(/^https?:\/\/(www\.)?/, "").split("/")[0].split("?")[0] || null;
    }
  }
  return null;
}

function deterministicColor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff;
  return `hsl(${h % 360},40%,38%)`;
}

function renderTooltip(tip: HTMLDivElement, card: Card, edges: Edge[]) {
  const fragment = document.createDocumentFragment();
  const title = document.createElement("p");
  title.style.cssText = "font-size:13px;font-weight:700;color:#282525;line-height:1.3";
  title.textContent = card.nome;
  fragment.appendChild(title);

  if (card.dominio) {
    const domain = document.createElement("p");
    domain.style.cssText = "font-size:11px;color:rgba(13,13,13,.4);margin-top:2px";
    domain.textContent = card.dominio;
    fragment.appendChild(domain);
  }

  const connections = document.createElement("div");
  connections.style.cssText = "margin-top:8px;border-top:1px solid rgba(13,13,13,.06);padding-top:8px;display:flex;flex-direction:column;gap:5px";
  edges.forEach(edge => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:6px";

    const hubName = document.createElement("span");
    hubName.style.cssText = "font-size:11px;color:rgba(13,13,13,.65);flex:1";
    hubName.textContent = edge.hub.nome;
    const status = document.createElement("span");
    status.style.cssText = "font-size:10px;font-weight:500;color:rgba(13,13,13,.5)";
    status.textContent = edge.status;

    row.append(hubName, status);
    connections.appendChild(row);
  });
  fragment.appendChild(connections);
  tip.replaceChildren(fragment);
}

/* ─── Layout: force-settle synchronously ─────────────────────────────────
   Run 180 iterations without RAF so the first draw is already settled.      */

function buildLayout(
  captadores: CaptadorInput[],
  conexoes: ConexaoInput[],
  W: number, H: number,
): { hubs: Hub[]; cards: Card[]; edges: Edge[] } {
  const hubs: Hub[] = captadores.map((c, i) => {
    const ang = (i / captadores.length) * Math.PI * 2 - Math.PI / 2;
    const R   = Math.min(W, H) * (captadores.length <= 2 ? 0.20 : 0.27);
    return {
      id: c.id, nome: c.nome,
      color: HUB_COLORS[i % HUB_COLORS.length],
      r: 26 + Math.min(c.n_captacoes, 12) * 0.7,
      x: W / 2 + Math.cos(ang) * R,
      y: H / 2 + Math.sin(ang) * R,
      logoUrl: c.logo_url ?? null,
      img: null,
      imgOk: false,
    };
  });

  const cardMap = new Map<string, Card>();
  const edges: Edge[] = [];

  conexoes.forEach(({ captador_id, empresa, status }) => {
    const hub = hubs.find(h => h.id === captador_id);
    if (!hub) return;

    if (!cardMap.has(empresa.id)) {
      const ang = Math.random() * Math.PI * 2;
      const d   = hub.r + 70 + Math.random() * 30;
      cardMap.set(empresa.id, {
        id: empresa.id, nome: empresa.nome,
        dominio: resolveDomain(empresa),
        color: STATUS_COLOR[status] ?? deterministicColor(empresa.nome),
        x: hub.x + Math.cos(ang) * d,
        y: hub.y + Math.sin(ang) * d,
        img: null, imgOk: false,
      });
    }
    edges.push({ hub, card: cardMap.get(empresa.id)!, status });
  });

  const cards = [...cardMap.values()];

  // --- physics settle (synchronous, no animation) ---
  type P = { x: number; y: number; vx: number; vy: number; fx?: boolean };
  const pts: P[] = [
    ...hubs.map(h => ({ x: h.x, y: h.y, vx: 0, vy: 0, fx: true })),
    ...cards.map(c => ({ x: c.x, y: c.y, vx: 0, vy: 0 })),
  ];
  const springs = edges.map(e => ({
    a: hubs.indexOf(e.hub),
    b: hubs.length + cards.indexOf(e.card),
    tgt: e.hub.r + 36 + 55,
  }));

  for (let iter = 0; iter < 200; iter++) {
    const alpha = 1 - iter / 200;

    // Centering (cards only)
    for (let i = hubs.length; i < pts.length; i++) {
      pts[i].vx += (W / 2 - pts[i].x) * 0.012 * alpha;
      pts[i].vy += (H / 2 - pts[i].y) * 0.012 * alpha;
    }

    // Charge repulsion
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
        const d2 = Math.max(dx * dx + dy * dy, 1), d = Math.sqrt(d2);
        const f  = (-280 * alpha) / d2;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        if (!pts[i].fx) { pts[i].vx += fx; pts[i].vy += fy; }
        if (!pts[j].fx) { pts[j].vx -= fx; pts[j].vy -= fy; }
      }
    }

    // Link springs
    springs.forEach(({ a, b, tgt }) => {
      const dx = pts[b].x - pts[a].x, dy = pts[b].y - pts[a].y;
      const d  = Math.hypot(dx, dy) || 1;
      const f  = (d - tgt) * 0.22 * alpha;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      if (!pts[a].fx) { pts[a].vx += fx; pts[a].vy += fy; }
      if (!pts[b].fx) { pts[b].vx -= fx; pts[b].vy -= fy; }
    });

    // Collision
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const ri  = i < hubs.length ? hubs[i].r : CARD_W / 2;
        const rj  = j < hubs.length ? hubs[j].r : CARD_W / 2;
        const min = ri + rj + 10;
        const dx  = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
        const d   = Math.hypot(dx, dy) || 1;
        if (d < min) {
          const push = ((min - d) / d) * 0.5;
          if (!pts[i].fx) { pts[i].x -= dx * push * 0.5; pts[i].y -= dy * push * 0.5; }
          if (!pts[j].fx) { pts[j].x += dx * push * 0.5; pts[j].y += dy * push * 0.5; }
        }
      }
    }

    // Boundary + integrate
    const pad = 50;
    pts.forEach(p => {
      if (p.fx) return;
      if (p.x < pad) p.vx += (pad - p.x) * 0.1;
      if (p.x > W - pad) p.vx += (W - pad - p.x) * 0.1;
      if (p.y < pad) p.vy += (pad - p.y) * 0.1;
      if (p.y > H - pad) p.vy += (H - pad - p.y) * 0.1;
      p.x += p.vx; p.vx *= 0.7;
      p.y += p.vy; p.vy *= 0.7;
    });
  }

  // Write settled positions back
  cards.forEach((c, i) => { c.x = pts[hubs.length + i].x; c.y = pts[hubs.length + i].y; });

  return { hubs, cards, edges };
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export function BipartiteGraph({
  captadores, conexoes,
}: { captadores: CaptadorInput[]; conexoes: ConexaoInput[] }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef  = useRef<{ hubs: Hub[]; cards: Card[]; edges: Edge[] } | null>(null);
  const hoverRef  = useRef<Card | null>(null);
  const tipRef    = useRef<HTMLDivElement>(null);

  /* ── draw ──────────────────────────────────────────────────────────────── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const state  = stateRef.current;
    if (!canvas || !state) return;
    const { hubs, cards, edges } = state;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth;
    const H   = canvas.offsetHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    // White background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);

    // Dotted grid
    const sp = 28;
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    for (let gx = sp; gx < W; gx += sp)
      for (let gy = sp; gy < H; gy += sp) {
        ctx.beginPath(); ctx.arc(gx, gy, 1, 0, Math.PI * 2); ctx.fill();
      }

    // Title
    ctx.fillStyle = "rgba(13,13,13,0.35)";
    ctx.font = "500 11px system-ui,sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("Captadores e suas empresas atribuídas", 16, 16);

    // Shared-empresa bridge: dotted line between cards of the same empresa at different hubs
    const byEmpresa = new Map<string, Card[]>();
    edges.forEach(e => {
      const arr = byEmpresa.get(e.card.id) ?? []; arr.push(e.card); byEmpresa.set(e.card.id, arr);
    });
    ctx.save();
    ctx.setLineDash([2, 5]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    byEmpresa.forEach(arr => {
      for (let i = 0; i < arr.length; i++)
        for (let j = i + 1; j < arr.length; j++) {
          ctx.beginPath(); ctx.moveTo(arr[i].x, arr[i].y); ctx.lineTo(arr[j].x, arr[j].y); ctx.stroke();
        }
    });
    ctx.restore();

    // Dashed edges hub → card
    edges.forEach(({ hub, card, status }) => {
      const col = STATUS_COLOR[status] ?? "rgba(13,13,13,.35)";
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.moveTo(hub.x, hub.y); ctx.lineTo(card.x, card.y); ctx.stroke();
      ctx.restore();
    });

    // Company cards (rounded squares)
    cards.forEach(c => {
      const hi  = hoverRef.current?.id === c.id;
      const x   = c.x - CARD_W / 2, y = c.y - CARD_H / 2;
      const sz  = hi ? CARD_W + 4 : CARD_W;
      const ox  = hi ? -2 : 0;

      // Shadow on hover
      if (hi) {
        ctx.shadowColor = "rgba(0,0,0,0.15)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
      }

      // Card background
      ctx.beginPath();
      ctx.roundRect(x + ox, y + ox, sz, sz, CARD_R);
      ctx.fillStyle = "white";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.10)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

      if (c.imgOk && c.img) {
        // Logo clipped inside card
        ctx.save();
        ctx.beginPath(); ctx.roundRect(x + ox + 3, y + ox + 3, sz - 6, sz - 6, CARD_R - 2);
        ctx.clip();
        ctx.drawImage(c.img, x + ox + 3, y + ox + 3, sz - 6, sz - 6);
        ctx.restore();
      } else {
        // Initials fallback — colored background
        ctx.save();
        ctx.beginPath(); ctx.roundRect(x + ox, y + ox, sz, sz, CARD_R); ctx.clip();
        ctx.fillStyle = c.color; ctx.fillRect(x + ox, y + ox, sz, sz);
        ctx.fillStyle = "rgba(255,255,255,.92)";
        ctx.font = `700 13px system-ui,sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(initials(c.nome), c.x, c.y);
        ctx.restore();
      }
    });

    // Captador circles (hubs)
    hubs.forEach(h => {
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      ctx.fillStyle = h.imgOk ? "#FFFFFF" : h.color; ctx.fill();
      if (h.imgOk && h.img) {
        ctx.save();
        ctx.beginPath(); ctx.arc(h.x, h.y, h.r - 2, 0, Math.PI * 2); ctx.clip();
        const side = h.r * 2 - 8;
        ctx.fillStyle = "#FFFFFF"; ctx.fillRect(h.x - h.r, h.y - h.r, h.r * 2, h.r * 2);
        ctx.drawImage(h.img, h.x - side / 2, h.y - side / 2, side, side);
        ctx.restore();
        ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(13,13,13,.10)"; ctx.lineWidth = 1; ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(255,255,255,.93)";
        ctx.font = `700 ${Math.round(h.r * 0.58)}px system-ui,sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(initials(h.nome), h.x, h.y);
      }
      ctx.fillStyle = "rgba(13,13,13,.48)";
      ctx.font = "500 11px system-ui,sans-serif";
      ctx.textBaseline = "top";
      ctx.fillText(h.nome, h.x, h.y + h.r + 7);
    });

    // Legend — bottom-left
    const lItems = [
      { col: "#7259B5", label: "Captador", big: true },
      { col: "#2E8932", label: "Ativa" },
      { col: "#B07A14", label: "Suspensa" },
      { col: "#D94E4E", label: "Expirada" },
    ];
    let lx = 16;
    const ly = H - 22;
    ctx.font = "500 9px system-ui,sans-serif";
    ctx.textBaseline = "middle";
    lItems.forEach(({ col, label, big }) => {
      const sz = big ? 9 : 7;
      ctx.beginPath();
      if (big) ctx.arc(lx + sz / 2, ly, sz / 2, 0, Math.PI * 2);
      else     ctx.roundRect(lx, ly - sz / 2, sz, sz, 2);
      ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = "rgba(13,13,13,.35)";
      ctx.textAlign = "left";
      ctx.fillText(label, lx + sz + 5, ly);
      lx += ctx.measureText(label).width + sz + 18;
    });

    ctx.restore();
  }, []);

  /* ── build + load logos ───────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || captadores.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth;
    const H   = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;

    const layout = buildLayout(captadores, conexoes, W, H);
    stateRef.current = layout;
    hoverRef.current = null;
    draw();

    // Load logos asynchronously; redraw on each load. ImageBitmap is not used
    // because HTMLImageElement has broader support with Logo.dev's CDN.
    if (LOGODEV) {
      layout.cards.forEach(c => {
        if (!c.dominio) return;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload  = () => { c.img = img; c.imgOk = true;  draw(); };
        img.onerror = () => { c.img = null; c.imgOk = false; draw(); };
        const params = new URLSearchParams({ token: LOGODEV, size: "96", format: "png" });
        img.src = `https://img.logo.dev/${encodeURIComponent(c.dominio)}?${params.toString()}`;
      });
    }

    // Logos próprias das agências/captadores, mantendo iniciais como fallback.
    layout.hubs.forEach(h => {
      if (!h.logoUrl) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { h.img = img; h.imgOk = true; draw(); };
      img.onerror = () => { h.img = null; h.imgOk = false; draw(); };
      img.src = h.logoUrl;
    });
  }, [captadores, conexoes, draw]);

  /* ── mouse hover (tooltip on card) ─────────────────────────────────────── */
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const state  = stateRef.current;
    const tip    = tipRef.current;
    if (!canvas || !state) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const hs  = CARD_W / 2 + 4;
    const hit = state.cards.find(c => Math.abs(c.x - mx) < hs && Math.abs(c.y - my) < hs) ?? null;

    const prev = hoverRef.current?.id;
    hoverRef.current = hit;
    if (hit?.id !== prev) draw();

    canvas.style.cursor = hit ? "pointer" : "default";

    if (hit && tip) {
      const relEdges = state.edges.filter(e => e.card.id === hit.id);
      tip.style.left    = `${mx + 14}px`;
      tip.style.top     = `${my - 10}px`;
      tip.style.display = "block";
      renderTooltip(tip, hit, relEdges);
    } else if (tip) {
      tip.style.display = "none";
    }
  }, [draw]);

  const onMouseLeave = useCallback(() => {
    hoverRef.current = null;
    if (tipRef.current) tipRef.current.style.display = "none";
    draw();
  }, [draw]);

  const onClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const state = stateRef.current;
    if (!canvas || !state) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hs = CARD_W / 2 + 4;
    const empresa = state.cards.find(card => Math.abs(card.x - mx) < hs && Math.abs(card.y - my) < hs);
    if (empresa) router.push(`/empresas-crm/${empresa.id}`);
  }, [router]);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      />
      {/* Tooltip (raw div, mutated directly to avoid re-renders) */}
      <div
        ref={tipRef}
        style={{
          display: "none", position: "absolute", pointerEvents: "none",
          background: "white", border: "1px solid rgba(13,13,13,.08)",
          borderRadius: 8, padding: "10px 14px", minWidth: 170, maxWidth: 230,
          boxShadow: "0 4px 16px rgba(13,13,13,.10)", zIndex: 20,
        }}
      />
    </div>
  );
}
