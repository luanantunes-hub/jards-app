"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, Users, Newspaper, Inbox, ClipboardList, ChevronLeft } from "lucide-react";

const NAV = [
  { href: "/admin/dashboard",      label: "Dashboard",      icon: LayoutDashboard },
  { href: "/admin/patrocinadores", label: "Patrocinadores", icon: Building2 },
  { href: "/admin/usuarios",       label: "Usuários",       icon: Users      },
  { href: "/admin/blog",           label: "Blog",           icon: Newspaper  },
  { href: "/admin/pedidos",        label: "Pedidos",        icon: Inbox      },
  { href: "/admin/logs",           label: "Logs",           icon: ClipboardList },
];

export default function AdminNav() {
  const path = usePathname();

  return (
    <nav
      className="flex items-center gap-1 px-6 h-12 sticky top-0 z-30"
      style={{ background: "#0D0D0D", borderBottom: "1px solid rgba(255,255,255,.08)" }}
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-1 text-xs font-medium mr-4 transition"
        style={{ color: "rgba(255,255,255,.35)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,.65)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,.35)")}
      >
        <ChevronLeft size={13} /> App
      </Link>

      <div className="h-4 w-px mr-4" style={{ background: "rgba(255,255,255,.10)" }} />

      <span className="text-[0.6875rem] font-bold tracking-[.10em] uppercase mr-4" style={{ color: "rgba(255,255,255,.25)" }}>
        Admin
      </span>

      {NAV.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[0.75rem] font-medium transition"
            style={
              active
                ? { background: "rgba(114,89,181,.25)", color: "#C4B5FD" }
                : { color: "rgba(255,255,255,.45)" }
            }
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,.75)"; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "rgba(255,255,255,.45)"; }}
          >
            <Icon size={13} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
