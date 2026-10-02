"use client";

import { useEffect, useRef, useState } from "react";
import { Check, GripVertical, Plus, Power, Tag } from "lucide-react";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useTaxonomiasComerciais, type TaxonomiaCategoria, type TaxonomiaOpcao } from "@/contexts/TaxonomiasComerciaisContext";
import { usePortalPosition, PortalMenu } from "@/components/ui/ComboboxPortalMenu";

const CATEGORIES: { key: TaxonomiaCategoria; label: string }[] = [
  { key: "origem", label: "Origem da oportunidade" },
  { key: "canal", label: "Canais de contato" },
  { key: "resultado", label: "Resultado do contato" },
  { key: "lei", label: "Leis e mecanismos" },
];
const COLORS = ["#7259B5","#2D72B0","#1A8B7A","#2E8932","#B07A14","#D94E4E","#666666","#BE185D"];
const ICONS = ["Mail","Phone","Send","MessageCircle","Video","Users","Handshake","Search","Calendar","FileText","Target","TrendingUp","Check","Clock","Star","MoreHorizontal"];

function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 45);
}

function OptionRow({ option, onUpdate }: { option: TaxonomiaOpcao; onUpdate: (option: TaxonomiaOpcao, patch: Partial<TaxonomiaOpcao>) => Promise<void> }) {
  const [label, setLabel] = useState(option.label);
  const [picker, setPicker] = useState<"color"|"icon"|null>(null);
  const colorBoxRef = useRef<HTMLDivElement>(null);
  const colorMenuPos = usePortalPosition(colorBoxRef, picker === "color");
  const iconBoxRef = useRef<HTMLDivElement>(null);
  const iconMenuPos = usePortalPosition(iconBoxRef, picker === "icon");
  useEffect(() => setLabel(option.label), [option.label]);
  const Icon = (Icons as any)[option.icone] as LucideIcon | undefined;
  const commit = () => { if (label.trim() && label.trim() !== option.label) void onUpdate(option, {label:label.trim()}); };
  return <div className={`group flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0 ${option.ativo ? "" : "opacity-45"}`} style={{borderColor:"rgba(13,13,13,.06)"}}>
    <GripVertical size={13} className="text-black/15"/>
    <div className="relative" ref={colorBoxRef}><button type="button" onClick={()=>setPicker(picker==="color"?null:"color")} className="h-6 w-6 rounded border-2 border-white shadow-sm" style={{background:option.cor}}/>{picker==="color"&&<><button className="fixed inset-0 z-40" onClick={()=>setPicker(null)}/><PortalMenu position={colorMenuPos} width={144}><div className="grid grid-cols-4 gap-1.5 p-2">{COLORS.map(color=><button key={color} onClick={()=>{void onUpdate(option,{cor:color});setPicker(null);}} className="flex h-7 w-7 items-center justify-center rounded" style={{background:color}}>{color===option.cor&&<Check size={11} color="white"/>}</button>)}</div></PortalMenu></>}</div>
    <div className="relative" ref={iconBoxRef}><button type="button" onClick={()=>setPicker(picker==="icon"?null:"icon")} className="flex h-7 w-7 items-center justify-center rounded border bg-transparent" style={{borderColor:`${option.cor}66`,color:option.cor}}>{Icon?<Icon size={13}/>:<Tag size={13}/>}</button>{picker==="icon"&&<><button className="fixed inset-0 z-40" onClick={()=>setPicker(null)}/><PortalMenu position={iconMenuPos} width={176}><div className="grid grid-cols-6 gap-1 p-2">{ICONS.map(name=>{const PickerIcon=(Icons as any)[name] as LucideIcon;return <button key={name} onClick={()=>{void onUpdate(option,{icone:name});setPicker(null);}} className="flex h-7 w-7 items-center justify-center rounded text-black/45 hover:bg-black/[.04]"><PickerIcon size={13}/></button>;})}</div></PortalMenu></>}</div>
    <input value={label} onChange={e=>setLabel(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}} className="min-w-0 flex-1 border-b border-transparent bg-transparent py-0.5 text-[0.8125rem] font-semibold outline-none focus:border-black/20"/>
    <span className="rounded px-2 py-0.5 text-[0.5625rem] font-medium text-white" style={{background:option.cor}}>{option.label}</span>
    <button type="button" onClick={()=>void onUpdate(option,{ativo:!option.ativo})} title={option.ativo?"Desativar":"Ativar"} className="flex h-7 w-7 items-center justify-center rounded text-black/25 hover:bg-black/[.04] hover:text-black/55"><Power size={13}/></button>
  </div>;
}

export function TaxonomiasComerciaisConfig() {
  const organizationId = useOrganizationId();
  const [supabase] = useState(()=>createClient());
  const { origens, canais, resultados, leis, recarregar } = useTaxonomiasComerciais();
  const [category, setCategory] = useState<TaxonomiaCategoria>("canal");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const options = category==="origem"?origens:category==="canal"?canais:category==="resultado"?resultados:leis;

  async function update(option: TaxonomiaOpcao, patch: Partial<TaxonomiaOpcao>) {
    if (!organizationId) return;
    setError(null);
    const payload = {organization_id:organizationId,categoria:option.categoria,chave:option.chave,label:option.label,cor:option.cor,icone:option.icone,ordem:option.ordem,ativo:option.ativo,padrao:option.padrao,...patch};
    const query = option.id.startsWith("default-")
      ? (supabase as any).from("crm_taxonomia_opcoes").upsert(payload,{onConflict:"organization_id,categoria,chave"})
      : (supabase as any).from("crm_taxonomia_opcoes").update(patch).eq("id",option.id);
    const {error:saveError}=await query;
    if(saveError){setError(saveError.message);return;}
    await recarregar();
  }

  async function create() {
    if(!organizationId||!newLabel.trim())return;
    setSaving(true);setError(null);
    const base=slug(newLabel)||"personalizado";
    const {error:saveError}=await (supabase as any).from("crm_taxonomia_opcoes").insert({organization_id:organizationId,categoria:category,chave:`${base}_${Date.now().toString(36)}`,label:newLabel.trim(),cor:"#7259B5",icone:"Tag",ordem:(Math.max(0,...options.map(item=>item.ordem))+10),ativo:true,padrao:false});
    setSaving(false);
    if(saveError){setError(saveError.message);return;}
    setNewLabel("");await recarregar();
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap gap-1 rounded border bg-black/[.02] p-1" style={{borderColor:"rgba(13,13,13,.07)"}}>{CATEGORIES.map(item=><button key={item.key} type="button" onClick={()=>setCategory(item.key)} className={`flex-1 rounded px-3 py-2 text-left transition ${category===item.key?"bg-white shadow-sm":"hover:bg-white/60"}`}><span className={`block text-[0.6875rem] font-semibold ${category===item.key?"text-[#7259B5]":"text-black/50"}`}>{item.label}</span></button>)}</div>
    <div className="overflow-hidden rounded border bg-white" style={{borderColor:"rgba(13,13,13,.08)"}}>{options.map(option=><OptionRow key={`${option.categoria}-${option.chave}`} option={option} onUpdate={update}/>) }<div className="flex items-center gap-2 border-t px-4 py-3" style={{borderColor:"rgba(13,13,13,.06)"}}><Plus size={13} className="text-black/25"/><input value={newLabel} onChange={e=>setNewLabel(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void create();}} placeholder={`Adicionar ${category==="canal"?"canal":category==="origem"?"origem":category==="resultado"?"resultado":"lei ou mecanismo"} personalizado…`} className="min-w-0 flex-1 bg-transparent text-[0.75rem] outline-none placeholder:text-black/25"/><button type="button" disabled={!newLabel.trim()||saving} onClick={()=>void create()} className="rounded border border-[#7259B5]/25 bg-white px-3 py-1.5 text-[0.6875rem] font-semibold text-[#7259B5] hover:bg-black/[.04] disabled:opacity-35">{saving?"Salvando…":"Adicionar"}</button></div></div>
    {error&&<p className="text-[0.6875rem] font-medium text-[#D94E4E]">{error}</p>}
  </div>;
}
