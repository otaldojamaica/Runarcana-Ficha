import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Dices,
  Shield,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Plus,
  X,
  Heart,
  Camera,
  Sparkles,
  Footprints,
  Swords,
  Wand2,
  BookOpen,
  Backpack,
  ScrollText,
  Settings,
  Share2,
  MessageSquare,
  User,
  Award,
} from "lucide-react";
import "./index.css";

/*
  Runarcana — ficha de personagem estilo C.R.I.S.
  Mantém a lógica principal do sistema e reduz ruído de código.
*/

const ATTRS = [
  { key: "for", label: "Força", short: "FOR" },
  { key: "des", label: "Destreza", short: "DES" },
  { key: "con", label: "Constituição", short: "CON" },
  { key: "int", label: "Inteligência", short: "INT" },
  { key: "sab", label: "Sabedoria", short: "SAB" },
  { key: "car", label: "Carisma", short: "CAR" },
];

const SKILLS = [
  { name: "Acrobacia", attr: "des" },
  { name: "Arcanismo", attr: "int" },
  { name: "Atletismo", attr: "for" },
  { name: "Atuação", attr: "car" },
  { name: "Enganação", attr: "car" },
  { name: "Furtividade", attr: "des" },
  { name: "História", attr: "int" },
  { name: "Intimidação", attr: "car" },
  { name: "Intuição", attr: "sab" },
  { name: "Investigação", attr: "int" },
  { name: "Lidar com Animais", attr: "sab" },
  { name: "Medicina", attr: "sab" },
  { name: "Natureza", attr: "int" },
  { name: "Percepção", attr: "sab" },
  { name: "Persuasão", attr: "car" },
  { name: "Prestidigitação", attr: "des" },
  { name: "Religião", attr: "int" },
  { name: "Sobrevivência", attr: "sab" },
  { name: "Tecnologia", attr: "int" },
];

const DAMAGE_TYPE_GROUPS = [
  { label: "Físico", options: ["Contundente", "Cortante", "Perfurante"] },
  { label: "Físico Mágico", options: ["Esmagador (Contundente)", "Lacerante (Cortante)", "Incisivo (Perfurante)"] },
  {
    label: "Elemental",
    options: ["Ácido", "Elétrico", "Energético", "Ígneo", "Gélido", "Necrótico", "Radiante", "Trovejante", "Venenoso", "Psíquico"],
  },
];
const DAMAGE_TYPES = new Set(DAMAGE_TYPE_GROUPS.flatMap((group) => group.options));

const TABS = [
  { name: "Combate", icon: Swords },
  { name: "Magias/Runas", icon: Wand2 },
  { name: "Heranças", icon: BookOpen },
  { name: "Inventário", icon: Backpack },
  { name: "Anotações", icon: ScrollText },
];

const STORAGE_KEY = "runarcana:ficha-cris";
const PREFERENCES_COOKIE = "runarcana:preferences";

const defaultChar = () => ({
  // Cabeçalho segue exatamente os 7 campos da ficha oficial: Jogador, Personagem,
  // Origem, Região, Passado, Moral, Classe e Nível — sem campo "Raça" (Origem já
  // cobre isso em Runarcana: Humano, Vastaya, Yordle etc).
  header: { nome: "", jogador: "", origem: "", regiao: "", passado: "", moral: "", classe: "", nivel: 1 },
  campanha: "",
  portrait: null,
  attrs: {
    for: { score: 10 },
    des: { score: 10 },
    con: { score: 10 },
    int: { score: 10 },
    sab: { score: 10 },
    car: { score: 10 },
  },
  savesTreino: {},
  skillsTreino: {},
  skillsOutros: {},
  inspiracao: 0,
  extras: {
    prof: 0,
    iniciativa: 0,
    percepcao: 0,
    intuicao: 0,
    magiaCD: 0,
    magiaAtk: 0,
    runaCD: 0,
    runaAtk: 0,
  },
  caExtra: 0,
  caEscudo: 0,
  deslocamento: "9m",
  hp: { cur: 10, max: 10, temp: 0, color: "#b4232e" },
  hitDice: "1d8",
  deathSaves: { success: 0, fail: 0 },
  exhaustion: 0,
  xp: 0,
  magia: { label: "Pontos de Mana", cur: 0, max: 0, attr: "int", color: "#7c3aed" },
  resistencias: "",
  proficienciasArmas: "",
  linguas: "",
  moedas: { pp: 0, pe: 0, po: 0, pl: 0 },
  attackFilter: "",
  freeRoll: "",
  attacks: [{
    id: "a1",
    nome: "Adaga Rúnica",
    dano: "1d4 + 1",
    critico: 20,
    multiplicador: "x2",
    ataqueBonus: 1,
    tipoDano: "Perfurante",
    alcance: "Corpo a corpo",
    pericia: "",
    atributo: "des",
    danoExtra: [],
    imagem: null,
    anotacoes: "",
  }],
  habilidades: [{ id: "h1", nome: "", desc: "" }],
  magias: [{ id: "m1", nome: "", custo: "", desc: "" }],
  runas: "",
  inventario: [{ id: "i1", item: "", qtd: 1, notas: "" }],
  bio: "",
});

const clampLevel = (n) => Math.max(1, Math.min(20, Number(n) || 1));
const profBonus = (level) => 2 + Math.floor((clampLevel(level) - 1) / 4);
const mod = (score) => Math.floor((Number(score ?? 10) - 10) / 2);
const fmtMod = (m) => (m >= 0 ? `+${m}` : `${m}`);
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const parseModifier = (value = "0") => {
  const parsed = Number(String(value).replace(/[^-\d]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const uid = () => {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

function migrateAttack(value, legacyProf, attrs) {
  const saved = isRecord(value) ? value : {};
  const atributo = ATTRS.some(({ key }) => key === saved.atributo) ? saved.atributo : "des";
  const ataqueBonus = Object.prototype.hasOwnProperty.call(saved, "ataqueBonus")
    ? toNumber(saved.ataqueBonus, 0)
    : saved.bonus !== undefined
      ? parseModifier(saved.bonus) - legacyProf - mod(attrs[atributo]?.score)
      : 0;
  const savedDamageType = saved.tipoDano ?? saved.tipo;
  return {
    id: typeof saved.id === "string" && saved.id ? saved.id : uid(),
    nome: typeof saved.nome === "string" ? saved.nome : "",
    dano: typeof saved.dano === "string" && saved.dano ? saved.dano : "1d6",
    critico: Math.min(20, Math.max(1, Math.round(toNumber(saved.critico, 20)))),
    multiplicador: typeof saved.multiplicador === "string" && saved.multiplicador ? saved.multiplicador : "x2",
    ataqueBonus,
    tipoDano: DAMAGE_TYPES.has(savedDamageType) ? savedDamageType : "Cortante",
    alcance: typeof saved.alcance === "string" ? saved.alcance : "",
    pericia: typeof saved.pericia === "string" ? saved.pericia : "",
    atributo,
    danoExtra: Array.isArray(saved.danoExtra)
      ? saved.danoExtra.filter(isRecord).map((extra) => ({
          formula: typeof extra.formula === "string" ? extra.formula : "",
          tipoDano: DAMAGE_TYPES.has(extra.tipoDano) ? extra.tipoDano : "Cortante",
        }))
      : [],
    imagem: typeof saved.imagem === "string" ? saved.imagem : null,
    anotacoes: typeof saved.anotacoes === "string" ? saved.anotacoes : "",
  };
}

function secureRoll(die) {
  if (!Number.isInteger(die) || die < 2) throw new Error("O dado precisa ter pelo menos dois lados.");
  if (!globalThis.crypto?.getRandomValues) throw new Error("Este navegador não oferece aleatoriedade segura.");

  const sample = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / die) * die;
  do {
    globalThis.crypto.getRandomValues(sample);
  } while (sample[0] >= limit);
  return (sample[0] % die) + 1;
}

function loadChar() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function saveChar(data) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    return false;
  }
}

function restoreCharacter(data) {
  const defaults = defaultChar();
  const saved = data?.character ?? data;
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    throw new Error("Arquivo de ficha inválido.");
  }
  const record = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
  const savedHeader = record(saved.header);
  const savedAttrs = record(saved.attrs);
  const savedHp = record(saved.hp);
  const savedMagia = record(saved.magia);
  const savedMoedas = record(saved.moedas);
  const savedDeathSaves = record(saved.deathSaves);
  const savedExtras = record(saved.extras);
  const attrs = Object.fromEntries(
    ATTRS.map(({ key }) => [key, { ...defaults.attrs[key], ...record(savedAttrs[key]) }]),
  );
  const magia = {
    ...defaults.magia,
    ...savedMagia,
    label: typeof savedMagia.label === "string" ? savedMagia.label : defaults.magia.label,
    attr: ["int", "sab", "car"].includes(savedMagia.attr) ? savedMagia.attr : defaults.magia.attr,
  };
  const legacyProf = profBonus(savedHeader.nivel ?? defaults.header.nivel) + toNumber(savedExtras.prof, 0);
  return {
    ...defaults,
    ...saved,
    header: { ...defaults.header, ...savedHeader },
    attrs,
    hp: { ...defaults.hp, ...savedHp },
    magia,
    moedas: { ...defaults.moedas, ...savedMoedas },
    deathSaves: { ...defaults.deathSaves, ...savedDeathSaves },
    extras: { ...defaults.extras, ...savedExtras },
    savesTreino: record(saved.savesTreino),
    skillsTreino: record(saved.skillsTreino),
    skillsOutros: record(saved.skillsOutros),
    attacks: Array.isArray(saved.attacks)
      ? saved.attacks.filter(isRecord).map((attack) => migrateAttack(attack, legacyProf, attrs))
      : defaults.attacks,
    habilidades: Array.isArray(saved.habilidades) ? saved.habilidades.filter((item) => item && typeof item === "object" && !Array.isArray(item)) : defaults.habilidades,
    magias: Array.isArray(saved.magias) ? saved.magias.filter((item) => item && typeof item === "object" && !Array.isArray(item)) : defaults.magias,
    inventario: Array.isArray(saved.inventario) ? saved.inventario.filter((item) => item && typeof item === "object" && !Array.isArray(item)) : defaults.inventario,
    attackFilter: typeof saved.attackFilter === "string" ? saved.attackFilter : defaults.attackFilter,
    freeRoll: typeof saved.freeRoll === "string" ? saved.freeRoll : defaults.freeRoll,
    runas: typeof saved.runas === "string" ? saved.runas : defaults.runas,
  };
}

function downloadCharacter(char) {
  const blob = new Blob([JSON.stringify({ format: "runarcana-sheet", version: 1, character: char }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "runarcana-ficha.json";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function loadPreferences() {
  const defaults = { tab: "Combate", locked: false, theme: "light" };
  if (typeof document === "undefined") return defaults;
  try {
    const cookie = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${PREFERENCES_COOKIE}=`));
    if (!cookie) return defaults;
    const saved = JSON.parse(decodeURIComponent(cookie.slice(PREFERENCES_COOKIE.length + 1)));
    return {
      tab: TABS.some((tab) => tab.name === saved.tab) ? saved.tab : defaults.tab,
      locked: typeof saved.locked === "boolean" ? saved.locked : defaults.locked,
      theme: saved.theme === "light" || saved.theme === "dark" ? saved.theme : defaults.theme,
    };
  } catch (error) {
    return defaults;
  }
}

function savePreferences(preferences) {
  if (typeof document === "undefined") return;
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${PREFERENCES_COOKIE}=${encodeURIComponent(JSON.stringify(preferences))}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
  } catch (error) {}
}

/* ================================ UI atoms ================================ */

function Label({ children, className = "" }) {
  return <div className={`text-[10px] tracking-[0.15em] uppercase text-gray-500 ${className}`}>{children}</div>;
}

function Underline({ value, onChange, className = "", ...rest }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-transparent border-b border-zinc-800 focus:border-red-700 pb-0.5 text-sm text-gray-200 focus:outline-none transition-colors ${className}`}
      {...rest}
    />
  );
}

function HField({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <Label>{label}</Label>
      {type === "number" ? (
        <NumberInput
          value={value}
          onChange={onChange}
          className="w-full bg-transparent border-b border-zinc-800 focus:border-red-700 pb-0.5 text-sm text-gray-200 focus:outline-none transition-colors"
        />
      ) : (
        <Underline value={value} onChange={onChange} type={type} />
      )}
    </div>
  );
}

function NumberInput({ value, onChange, className = "", onBlur, onFocus, placeholder = "0", maxLength = 12, ...rest }) {
  const inputRef = useRef(null);
  const normalizedValue = value == null || value === "" || Number(value) === 0 ? "" : String(value);
  const [draft, setDraft] = useState(normalizedValue);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) setDraft(normalizedValue);
  }, [normalizedValue]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      data-numeric-input="true"
      maxLength={maxLength}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => {
        const typedValue = e.target.value.slice(0, maxLength);
        const nextValue = typedValue.replace(/^(-?)0+(?=\d)/, "$1");
        if (!/^-?\d*\.?\d*$/.test(typedValue)) return;
        setDraft(nextValue);
        onChange?.(nextValue);
      }}
      onFocus={(e) => {
        onFocus?.(e);
        if (!normalizedValue) setDraft("");
      }}
      onBlur={(e) => {
        onBlur?.(e);
        setDraft(normalizedValue);
      }}
      className={`${className} placeholder:text-zinc-500`}
      {...rest}
    />
  );
}

function RollIcon({ onClick, size = 15, title = "Rolar d20" }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="shrink-0 text-gray-600 hover:text-violet-400 transition-colors"
    >
      <Dices size={size} strokeWidth={1.6} />
    </button>
  );
}

function ExtraBonus({ value, onChange, title = "Ajuste manual" }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] text-zinc-600" title={title}>
      <span>manual</span>
      <NumberInput
        value={value}
        onChange={onChange}
        className="w-7 bg-transparent border-b border-zinc-800 text-center text-zinc-400 focus:outline-none focus:border-red-800 focus:text-white"
      />
    </span>
  );
}

function StatBox({ label, children, icon: Icon, extra }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-16 h-14 border border-zinc-800 rounded flex flex-col items-center justify-center gap-0.5">
        {Icon && <Icon size={12} className="text-gray-600" strokeWidth={1.6} />}
        <div className="text-lg font-semibold text-gray-100">{children}</div>
      </div>
      <Label className="text-center">{label}</Label>
      {extra}
    </div>
  );
}

/* ------------------------------ Status bar (Vida / Magia) ------------------------------ */

function StatusBar({ label, icon: Icon, cur, max, from, color, onColorChange, editableLabel, staticFill = false, allowOverflow = false, overflowLabel = "acima do máximo", numberColor, defaultNumberColor, onNumberColorChange, onChange, onToggleLabel }) {
  const [colorOptionsOpen, setColorOptionsOpen] = useState(false);
  const [numberColorOptionsOpen, setNumberColorOptionsOpen] = useState(false);
  const safeMax = Math.max(0, toNumber(max, 0));
  const rawCur = Math.max(0, toNumber(cur, 0));
  const safeCur = allowOverflow ? rawCur : Math.min(safeMax, rawCur);
  const meterCur = Math.min(safeCur, safeMax);
  const pct = safeMax === 0 ? 0 : Math.max(0, Math.min(100, (safeCur / safeMax) * 100));
  const fallbackColor = editableLabel ? "#7c3aed" : "#b4232e";
  const safeNumberColor = /^#[\da-f]{6}$/i.test(numberColor || "") ? numberColor : defaultNumberColor;
  const step = (amount) => {
    const nextCur = Math.max(0, safeCur + amount);
    const nextMax = safeMax === 0 && editableLabel && amount > 0 ? nextCur : safeMax;
    if (allowOverflow) {
      onChange({ cur: nextCur, ...(nextMax > safeMax ? { max: nextMax } : {}) });
      return;
    }
    onChange({ cur: Math.min(nextCur, nextMax), ...(nextMax > safeMax ? { max: nextMax } : {}) });
  };
  return (
    <div>
      <div className="flex items-center justify-center gap-1.5 mb-1">
        {Icon && <Icon size={11} className="text-gray-500" strokeWidth={1.8} />}
        {editableLabel ? (
          <div className="flex items-center gap-2">
            <input
              value={label}
              aria-label="Nome do recurso mágico"
              onChange={(e) => onChange({ label: e.target.value })}
              className="text-[10px] tracking-[0.15em] uppercase text-gray-500 bg-transparent text-center focus:outline-none focus:text-violet-400 w-32"
            />
            {onToggleLabel && (
              <button
                type="button"
                onClick={onToggleLabel}
                className="text-[9px] uppercase tracking-wide text-violet-400 hover:text-violet-300"
                title="Alternar entre Mana e Ki"
              >
                {label.toLowerCase().includes("ki") ? "Mana" : "Ki"}
              </button>
            )}
          </div>
        ) : (
          <Label>{label}</Label>
        )}
      </div>
      <div
        className="status-bar-track relative h-10 rounded border border-zinc-800 overflow-hidden bg-zinc-950"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={meterCur}
        aria-valuetext={`${safeCur} / ${safeMax}${allowOverflow && safeCur > safeMax ? `, ${overflowLabel}` : ""}`}
      >
        <div
          className={`status-bar-fill absolute inset-y-0 left-0 ${staticFill ? "is-static" : ""} ${safeMax > 0 && pct <= 25 ? "is-low" : ""}`}
          style={{
            width: `${pct}%`,
            backgroundColor: color || fallbackColor,
            filter: `saturate(${0.3 + (pct / 100) * 0.7}) brightness(${0.55 + (pct / 100) * 0.45})`,
          }}
        />
        <div className="relative h-full flex items-center justify-between px-0.5">
          <div className="flex items-center h-full">
            <button type="button" onClick={() => step(-2)} aria-label={`Diminuir ${label} atual em 2`} title="Diminuir 2" className="px-1 text-gray-500 hover:text-white">
              <ChevronsLeft size={14} />
            </button>
            <button type="button" onClick={() => step(-1)} aria-label={`Diminuir ${label} atual em 1`} title="Diminuir 1" className="px-1 text-gray-500 hover:text-white">
              <ChevronLeft size={14} />
            </button>
          </div>
          <div className="flex items-baseline gap-1">
            <NumberInput
              value={safeCur}
              maxLength={3}
              onChange={(value) => onChange({ cur: Math.max(0, toNumber(value, 0)) })}
              onBlur={() => onChange({ cur: allowOverflow ? Math.max(0, toNumber(cur, 0)) : Math.max(0, Math.min(safeMax, toNumber(cur, 0))) })}
              className="status-bar-number w-10 bg-transparent text-center text-lg font-bold focus:outline-none [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]"
              style={{ color: numberColor || undefined }}
            />
            <span className="text-white/50">/</span>
            <NumberInput
              value={safeMax}
              maxLength={3}
              onChange={(value) => onChange({ max: Math.max(0, toNumber(value, 0)) })}
              onBlur={() => onChange({ max: Math.max(0, toNumber(max, 0)), cur: allowOverflow ? safeCur : Math.min(safeCur, Math.max(0, toNumber(max, 0))) })}
              className="status-bar-number w-10 bg-transparent text-center text-sm focus:outline-none"
              style={{ color: numberColor || undefined }}
            />
          </div>
          <div className="flex items-center h-full">
            <button type="button" onClick={() => step(1)} aria-label={`Aumentar ${label} atual em 1`} title="Aumentar 1" className="px-1 text-gray-500 hover:text-white">
              <ChevronRight size={14} />
            </button>
            <button type="button" onClick={() => step(2)} aria-label={`Aumentar ${label} atual em 2`} title="Aumentar 2" className="px-1 text-gray-500 hover:text-white">
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      </div>
      <div className="mt-1 flex min-h-6 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {numberColorOptionsOpen && (
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-zinc-500">
              Cor dos números
              <input
                type="color"
                value={safeNumberColor || "#ffffff"}
                onChange={(event) => onNumberColorChange?.(event.target.value)}
                aria-label={`Cor dos números de ${label}`}
                className="h-6 w-8 cursor-pointer rounded border border-zinc-700 bg-transparent p-0.5"
              />
            </label>
          )}
          <button
            type="button"
            onClick={() => setNumberColorOptionsOpen((open) => !open)}
            aria-expanded={numberColorOptionsOpen}
            aria-label={numberColorOptionsOpen ? `Ocultar cor dos números de ${label}` : `Alterar cor dos números de ${label}`}
            title={numberColorOptionsOpen ? "Ocultar cor dos números" : "Alterar cor dos números"}
            className="text-zinc-500 hover:text-amber-400"
          >
            {numberColorOptionsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {colorOptionsOpen && (
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-zinc-500">
              Cor da barra
              <input
                type="color"
                value={color || fallbackColor}
                onChange={(event) => onColorChange?.(event.target.value)}
                aria-label={`Cor da barra de ${label}`}
                className="h-6 w-8 cursor-pointer rounded border border-zinc-700 bg-transparent p-0.5"
              />
            </label>
          )}
          <button
            type="button"
            onClick={() => setColorOptionsOpen((open) => !open)}
            aria-expanded={colorOptionsOpen}
            aria-label={colorOptionsOpen ? `Ocultar cor de ${label}` : `Alterar cor de ${label}`}
            title={colorOptionsOpen ? "Ocultar seletor de cor" : "Alterar cor da barra"}
            className="text-zinc-500 hover:text-amber-400"
          >
            {colorOptionsOpen ? <ChevronDown size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Portrait ------------------------------ */

function Portrait({ src, onChange }) {
  const ref = useRef(null);
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => onChange(r.result);
    r.readAsDataURL(file);
  };
  return (
    <div className="w-16 h-16 shrink-0">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        title="Selecionar foto"
        aria-label={src ? "Alterar foto do personagem" : "Selecionar foto do personagem"}
        className="group relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
      >
        {src ? (
          <img src={src} alt="Retrato" className="h-full w-full object-cover" />
        ) : (
          <User size={26} className="text-zinc-700" strokeWidth={1.3} />
        )}
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Camera size={22} strokeWidth={1.8} />
        </span>
      </button>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

/* --------------------------- Hexagrama de atributos --------------------------- */

function AttrHex({ attrs, locked, onToggleLock, onScoreChange, onRoll }) {
  const R = 84;
  const cx = 114,
    cy = 114;
  const pos = ATTRS.map((a, i) => {
    const angle = -90 + i * 60;
    const rad = (angle * Math.PI) / 180;
    return { ...a, x: cx + R * Math.cos(rad), y: cy + R * Math.sin(rad) };
  });

  return (
    <div className="relative mx-auto flex items-center justify-center" style={{ width: 228, height: 246 }}>
      <button
        onClick={onToggleLock}
        className="absolute top-0 right-4 text-gray-600 hover:text-violet-400 transition-colors z-10"
        title={locked ? "Destravar valores" : "Travar valores"}
      >
        {locked ? <Lock size={13} /> : <Unlock size={13} />}
      </button>

      <svg viewBox="0 0 228 228" width="228" height="228" className="absolute left-0 top-0">
        <circle cx={cx} cy={cy} r={R + 28} fill="none" stroke="#18181b" strokeWidth="1" strokeDasharray="1 5" />
        <polygon
          points={pos.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="#27272a"
          strokeWidth="1"
        />
      </svg>

      <div className="absolute rounded-full border border-zinc-700 bg-zinc-950 flex items-center justify-center" style={{ width: 74, height: 74, left: cx - 37, top: cy - 37 }}>
        <span className="text-[10px] tracking-[0.2em] uppercase text-gray-400 font-medium">Atributos</span>
      </div>

      {pos.map((p) => {
        const a = attrs[p.key];
        const m = mod(a.score);
        return (
          <div key={p.key} className="absolute flex flex-col items-center" style={{ left: p.x - 27, top: p.y - 27, width: 54 }}>
            <div
              className="relative w-[54px] h-[54px] rounded-full border border-white/70 bg-zinc-950 flex flex-col items-center justify-center cursor-pointer hover:border-violet-400 transition-colors"
              onClick={() => onRoll(p.label, m)}
              title={`Rolar teste de ${p.label}`}
            >
              {locked ? (
                <span className="text-xl font-bold text-white leading-none">{a.score}</span>
              ) : (
                <NumberInput
                  value={a.score}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(value) => onScoreChange(p.key, toNumber(value, 0))}
                  className="w-12 bg-transparent text-center text-xl font-bold text-white leading-none focus:outline-none"
                />
              )}
              <span className="text-[10px] text-gray-400 mt-0.5">{p.short}</span>
            </div>
            <span className="text-[10px] text-violet-400 mt-1 font-medium">{fmtMod(m)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------- Dice toast --------------------------------- */

function DiceToast({ roll, onClose, onReroll }) {
  const [phase, setPhase] = useState("rolling");
  const [display, setDisplay] = useState(1);

  useEffect(() => {
    if (!roll) return;
    setPhase("rolling");
    let n = 0;
    const iv = setInterval(() => {
      setDisplay(secureRoll(roll.die));
      n++;
      if (n > 9) {
        clearInterval(iv);
        setPhase("done");
      }
    }, 45);
    return () => clearInterval(iv);
  }, [roll]);

  if (!roll) return null;
  const { label, mod: m, mode, r1, r2 } = roll;
  const chosen = mode === "adv" ? Math.max(r1, r2) : mode === "dis" ? Math.min(r1, r2) : r1;
  const total = chosen + m;

  return (
    <section
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-red-900/60 bg-zinc-950/95 p-5 text-center shadow-2xl backdrop-blur-sm"
      style={{ boxShadow: "0 0 40px rgba(153,27,27,0.2)" }}
    >
      <div className="text-[11px] tracking-[0.2em] text-gray-500 uppercase mb-2">{label}</div>
      <div className={`text-5xl font-bold transition-colors ${phase === "rolling" ? "text-zinc-700" : "text-white"}`}>
          {phase === "rolling" ? display : total}
      </div>
      {phase === "done" && (
        <>
          <div className="text-xs text-gray-500 mt-2">
            {mode === "normal" && `d${roll.die} (${r1}) ${fmtMod(m)}`}
            {mode === "adv" && <><span className="text-emerald-400">vantagem</span> · d{roll.die} ({r1}, {r2}) → {chosen} {fmtMod(m)}</>}
            {mode === "dis" && <><span className="text-red-400">desvantagem</span> · d{roll.die} ({r1}, {r2}) → {chosen} {fmtMod(m)}</>}
          </div>
          <div className="flex items-center justify-center gap-4 mt-4 text-[10px] tracking-[0.12em] uppercase">
            <button type="button" onClick={() => onReroll("adv")} className="text-emerald-400/80 hover:text-emerald-400">
              Vantagem
            </button>
            <button type="button" onClick={() => onReroll("normal")} className="text-violet-400 hover:text-violet-300">
              Rolar de novo
            </button>
            <button type="button" onClick={() => onReroll("dis")} className="text-red-400/80 hover:text-red-400">
              Desvantagem
            </button>
          </div>
        </>
      )}
      <button type="button" onClick={onClose} className="mt-3 text-[10px] tracking-[0.15em] uppercase text-gray-600 hover:text-gray-300">
          fechar
      </button>
    </section>
  );
}

/* ------------------------------- Editable list ------------------------------- */

function EditableList({ items, fields, onChange, addLabel = "Adicionar" }) {
  const update = (id, key, val) => onChange(items.map((it) => (it.id === id ? { ...it, [key]: val } : it)));
  const remove = (id) => onChange(items.filter((it) => it.id !== id));
  const add = () => onChange([...items, { id: uid(), ...Object.fromEntries(fields.map((f) => [f.key, ""])) }]);

  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.id} className="flex items-start gap-2 group">
          <div className="grid gap-2 flex-1" style={{ gridTemplateColumns: fields.map((f) => f.width || "1fr").join(" ") }}>
            {fields.map((f) =>
              f.area ? (
                <textarea
                  key={f.key}
                  rows={2}
                  value={it[f.key] || ""}
                  onChange={(e) => update(it.id, f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-red-800 resize-y"
                />
              ) : (
                <input
                  key={f.key}
                  type={f.type || "text"}
                  value={it[f.key] || ""}
                  onChange={(e) => update(it.id, f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-red-800"
                />
              )
            )}
          </div>
          <button onClick={() => remove(it.id)} className="mt-1.5 text-zinc-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
            <X size={13} />
          </button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1 text-[11px] tracking-[0.1em] uppercase text-violet-400 hover:text-violet-300">
        <Plus size={12} /> {addLabel}
      </button>
    </div>
  );
}

function DamageTypeSelect({ value, onChange, label }) {
  return (
    <select
      value={value}
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
      className="w-full min-w-0 rounded border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-sm text-gray-200 focus:border-amber-500 focus:outline-none"
    >
      {DAMAGE_TYPE_GROUPS.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((type) => <option key={type} value={type}>{type}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

function formatAttackNotes(notes) {
  const parts = String(notes || "").split(/(\*\*[\s\S]+?\*\*|\*[\s\S]+?\*|__[\s\S]+?__)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-semibold text-amber-500">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith("__") && part.endsWith("__")) return <u key={index}>{part.slice(2, -2)}</u>;
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function AttackEditorModal({ attack, isEditing, onClose, onSave }) {
  const [draft, setDraft] = useState(() => ({ ...attack, danoExtra: attack.danoExtra.map((extra) => ({ ...extra })) }));
  const [error, setError] = useState("");
  const notesRef = useRef(null);
  const update = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const updateExtra = (index, patch) =>
    update({ danoExtra: draft.danoExtra.map((extra, itemIndex) => itemIndex === index ? { ...extra, ...patch } : extra) });
  const formatSelection = (before, after = before) => {
    const field = notesRef.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selected = draft.anotacoes.slice(start, end);
    const content = selected || "texto";
    const replacement = `${before}${content}${after}`;
    update({ anotacoes: `${draft.anotacoes.slice(0, start)}${replacement}${draft.anotacoes.slice(end)}` });
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + before.length, start + before.length + content.length);
    });
  };
  const save = (event) => {
    event.preventDefault();
    if (!draft.nome.trim() || !draft.dano.trim() || !draft.multiplicador.trim()) {
      setError("Preencha nome, dano e multiplicador para salvar o ataque.");
      return;
    }
    onSave({ ...draft, nome: draft.nome.trim(), critico: Math.min(20, Math.max(1, toNumber(draft.critico, 20))) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="attack-editor-title"
        className="w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-gray-200 shadow-2xl sm:p-6"
      >
        <form onSubmit={save}>
          <header className="mb-5 flex items-center justify-between border-b border-zinc-800 pb-3">
            <h2 id="attack-editor-title" className="text-sm font-semibold uppercase tracking-[0.12em] text-gray-100">
              {isEditing ? "Editar Ataque" : "Novo Ataque"}
            </h2>
            <button type="button" onClick={onClose} aria-label="Fechar editor de ataque" className="text-gray-500 hover:text-white">
              <X size={18} />
            </button>
          </header>

          <div className="space-y-4">
            <label className="block space-y-1.5 text-xs text-amber-500">
              <span>Nome*</span>
              <input required autoFocus value={draft.nome} onChange={(event) => update({ nome: event.target.value })} placeholder="Ex.: Cajado" className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-gray-200 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none" />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="space-y-1.5 text-xs text-amber-500"><span>Dano*</span><input required value={draft.dano} onChange={(event) => update({ dano: event.target.value })} placeholder="1d6" className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-gray-200 focus:border-amber-500 focus:outline-none" /></label>
              <label className="space-y-1.5 text-xs text-amber-500"><span>Crítico*</span><input required type="number" min="1" max="20" value={draft.critico} onChange={(event) => update({ critico: toNumber(event.target.value, 20) })} className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-gray-200 focus:border-amber-500 focus:outline-none" /></label>
              <label className="space-y-1.5 text-xs text-amber-500"><span>Multiplicador*</span><input required value={draft.multiplicador} onChange={(event) => update({ multiplicador: event.target.value })} placeholder="x2" className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-gray-200 focus:border-amber-500 focus:outline-none" /></label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs text-amber-500"><span>Ataque Bônus</span><input type="number" value={draft.ataqueBonus} onChange={(event) => update({ ataqueBonus: toNumber(event.target.value, 0) })} className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-gray-200 focus:border-amber-500 focus:outline-none" /></label>
              <label className="space-y-1.5 text-xs text-amber-500"><span>Tipo de Dano</span><DamageTypeSelect label="Tipo de Dano" value={draft.tipoDano} onChange={(tipoDano) => update({ tipoDano })} /></label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="space-y-1.5 text-xs text-amber-500"><span>Alcance</span><input value={draft.alcance} onChange={(event) => update({ alcance: event.target.value })} placeholder="Corpo a corpo ou 18m" className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-gray-200 focus:border-amber-500 focus:outline-none" /></label>
              <label className="space-y-1.5 text-xs text-amber-500"><span>Perícia (opcional)</span><input list="runarcana-attack-skills" value={draft.pericia} onChange={(event) => update({ pericia: event.target.value })} placeholder="Selecione ou digite" className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-gray-200 focus:border-amber-500 focus:outline-none" /><datalist id="runarcana-attack-skills">{SKILLS.map((skill) => <option key={skill.name} value={skill.name} />)}</datalist></label>
              <label className="space-y-1.5 text-xs text-amber-500"><span>Atributo</span><select value={draft.atributo} onChange={(event) => update({ atributo: event.target.value })} className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-gray-200 focus:border-amber-500 focus:outline-none">{ATTRS.map((attr) => <option key={attr.key} value={attr.key}>{attr.short} — {attr.label}</option>)}</select></label>
            </div>

            <section className="space-y-2 rounded border border-zinc-800 p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-500">Dano extra</h3>
                <button type="button" onClick={() => update({ danoExtra: [...draft.danoExtra, { formula: "", tipoDano: "Cortante" }] })} className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-300"><Plus size={13} /> Adicionar</button>
              </div>
              {draft.danoExtra.length === 0 && <p className="text-xs text-zinc-500">Nenhum dano extra.</p>}
              {draft.danoExtra.map((extra, index) => (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_32px] items-end gap-2">
                  <label className="space-y-1 text-[11px] text-gray-400"><span>Fórmula</span><input value={extra.formula} onChange={(event) => updateExtra(index, { formula: event.target.value })} placeholder="1d6" className="w-full rounded border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-sm text-gray-200 focus:border-amber-500 focus:outline-none" /></label>
                  <label className="space-y-1 text-[11px] text-gray-400"><span>Tipo de Dano</span><DamageTypeSelect label={`Tipo do dano extra ${index + 1}`} value={extra.tipoDano} onChange={(tipoDano) => updateExtra(index, { tipoDano })} /></label>
                  <button type="button" onClick={() => update({ danoExtra: draft.danoExtra.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`Remover dano extra ${index + 1}`} className="mb-0.5 flex h-9 items-center justify-center text-gray-500 hover:text-red-400"><X size={15} /></button>
                </div>
              ))}
            </section>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
              <div className="space-y-2">
                <span className="block text-xs text-amber-500">Imagem</span>
                <Portrait src={draft.imagem} onChange={(imagem) => update({ imagem })} />
              </div>
              <div className="space-y-2">
                <label htmlFor="attack-notes" className="block text-xs text-amber-500">Anotações</label>
                <div className="flex items-center gap-1 rounded-t border border-zinc-800 bg-zinc-900/50 p-1">
                  <button type="button" onClick={() => formatSelection("**")} aria-label="Negrito dourado" title="Negrito dourado" className="min-w-8 rounded px-2 py-1 text-xs font-bold text-amber-500 hover:bg-zinc-800">B</button>
                  <button type="button" onClick={() => formatSelection("*", "*")} aria-label="Itálico" title="Itálico" className="min-w-8 rounded px-2 py-1 text-xs italic text-gray-300 hover:bg-zinc-800">I</button>
                  <button type="button" onClick={() => formatSelection("__", "__")} aria-label="Sublinhado" title="Sublinhado" className="min-w-8 rounded px-2 py-1 text-xs text-gray-300 underline hover:bg-zinc-800">U</button>
                </div>
                <textarea id="attack-notes" ref={notesRef} rows={4} value={draft.anotacoes} onChange={(event) => update({ anotacoes: event.target.value })} placeholder="Detalhes do ataque" className="w-full resize-y rounded-b border border-t-0 border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-gray-200 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none" />
              </div>
            </div>
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          </div>

          <footer className="mt-6 flex justify-end gap-2 border-t border-zinc-800 pt-4">
            <button type="button" onClick={onClose} className="rounded border border-zinc-700 px-4 py-2 text-sm text-gray-300 hover:bg-zinc-900">Cancelar</button>
            <button type="submit" className="rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400">{isEditing ? "Salvar" : "Adicionar"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function AttackCard({ attack, expanded, bonus, onToggle, onEdit, onRemove, onRoll }) {
  const attribute = ATTRS.find(({ key }) => key === attack.atributo) || ATTRS[0];
  const handleKeyDown = (event) => {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onEdit();
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={handleKeyDown}
      aria-label={`Editar ataque ${attack.nome || "sem nome"}`}
      className="mb-2 rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 outline-none transition-colors hover:border-amber-500/50 focus-visible:border-amber-500"
    >
      <div className="flex items-center gap-2">
        <button type="button" onClick={(event) => { event.stopPropagation(); onToggle(); }} aria-label={`${expanded ? "Recolher" : "Expandir"} ${attack.nome}`} className="shrink-0 text-amber-500">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-gray-100">{attack.nome || "Ataque sem nome"}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-amber-500">
            <span>Dano: {attack.dano}</span>
            <span>Crítico: {attack.critico}/{attack.multiplicador}</span>
            <span className="text-gray-500">{attack.tipoDano}</span>
            {attack.danoExtra.map((extra, index) => <span key={index} className="rounded border border-amber-500/30 px-1.5 py-0.5">+ {extra.formula} {extra.tipoDano}</span>)}
          </div>
        </div>
        <span className="shrink-0 text-sm font-semibold text-amber-500">{fmtMod(bonus)}</span>
        <button type="button" onClick={(event) => { event.stopPropagation(); onRoll(); }} aria-label={`Rolar ataque ${attack.nome}`} title="Rolar ataque" className="shrink-0 text-gray-400 hover:text-amber-400"><Dices size={16} /></button>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-zinc-800 pt-3" onClick={(event) => event.stopPropagation()}>
          <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-3">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
              <div><dt className="inline text-amber-500">Ataque Bônus: </dt><dd className="inline text-gray-300">{fmtMod(toNumber(attack.ataqueBonus, 0))}</dd></div>
              <div><dt className="inline text-amber-500">Tipo de Dano: </dt><dd className="inline text-gray-300">{attack.tipoDano}</dd></div>
              <div><dt className="inline text-amber-500">Alcance: </dt><dd className="inline text-gray-300">{attack.alcance || "-"}</dd></div>
              <div><dt className="inline text-amber-500">Perícia: </dt><dd className="inline text-gray-300">{attack.pericia || "-"}</dd></div>
              <div><dt className="inline text-amber-500">Atributo Dano: </dt><dd className="inline text-gray-300">{attribute.label}</dd></div>
              {attack.danoExtra.map((extra, index) => (
                <div key={index} className="sm:col-span-2"><dt className="inline text-amber-500">Dano Extra: </dt><dd className="inline text-gray-300">{extra.formula || "-"} ({extra.tipoDano})</dd></div>
              ))}
            </dl>
            {attack.imagem && <img src={attack.imagem} alt={`Imagem de ${attack.nome}`} className="h-[72px] w-[72px] rounded border border-zinc-800 object-cover" />}
          </div>
          {attack.anotacoes && <p className="mt-3 whitespace-pre-wrap border-t border-zinc-800 pt-2 text-xs leading-relaxed text-gray-300">{formatAttackNotes(attack.anotacoes)}</p>}
          <footer className="mt-3 flex justify-between border-t border-zinc-800 pt-2 text-xs">
            <button type="button" onClick={(event) => { event.stopPropagation(); onRemove(); }} className="text-red-400 hover:text-red-300">Remover</button>
            <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(); }} className="text-amber-500 hover:text-amber-300">Editar</button>
          </footer>
        </div>
      )}
    </article>
  );
}

function ConfirmAttackRemoval({ attack, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={(event) => event.target === event.currentTarget && onCancel()}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="remove-attack-title" className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-950 p-5 text-gray-200 shadow-2xl">
        <h2 id="remove-attack-title" className="text-sm font-semibold text-gray-100">Remover ataque?</h2>
        <p className="mt-2 text-sm text-gray-400">Tem certeza que deseja remover {attack.nome || "este ataque"}? Essa ação não pode ser desfeita.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded border border-zinc-700 px-3 py-2 text-sm text-gray-300 hover:bg-zinc-900">Cancelar</button>
          <button type="button" onClick={onConfirm} className="rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500">Remover</button>
        </div>
      </section>
    </div>
  );
}

/* ----------------------------------- Sections ----------------------------------- */

function HeaderPanel({ char, setHeader, updateChar, statusLabel, onShare, onOpenSettings }) {
  return (
    <header className="px-6 pt-5 pb-4 border-b border-zinc-900">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-4">
          <Portrait src={char.portrait} onChange={(v) => updateChar((c) => ({ ...c, portrait: v }))} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2.5 w-full max-w-[440px]">
            <HField label="Personagem" value={char.header.nome} onChange={(v) => setHeader("nome", v)} />
            <HField label="Jogador" value={char.header.jogador} onChange={(v) => setHeader("jogador", v)} />
            <HField label="Origem" value={char.header.origem} onChange={(v) => setHeader("origem", v)} />
            <HField label="Região" value={char.header.regiao} onChange={(v) => setHeader("regiao", v)} />
            <HField label="Passado" value={char.header.passado} onChange={(v) => setHeader("passado", v)} />
            <HField label="Moral" value={char.header.moral} onChange={(v) => setHeader("moral", v)} />
            <HField label="Classe" value={char.header.classe} onChange={(v) => setHeader("classe", v)} />
            <HField
              label="Nível"
              value={char.header.nivel}
              type="number"
              onChange={(v) => setHeader("nivel", clampLevel(v))}
            />
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <MessageSquare size={16} className="text-gray-600" strokeWidth={1.6} />
            <div>
              <label htmlFor="campaign-name" className="block text-right text-[10px] tracking-[0.15em] uppercase text-gray-500">
                Campanha
              </label>
              <Underline
                id="campaign-name"
                name="campanha"
                value={char.campanha}
                onChange={(v) => updateChar((c) => ({ ...c, campanha: v }))}
                className="text-right w-48 placeholder:text-zinc-500"
                placeholder="Nome da campanha"
                aria-label="Nome da campanha"
                autoComplete="off"
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
            <button type="button" onClick={onShare} title="Compartilhar site" aria-label="Compartilhar site" className="text-gray-600 hover:text-gray-300">
              <Share2 size={15} strokeWidth={1.6} />
            </button>
            <button type="button" onClick={onOpenSettings} title="Configurações e backup" aria-label="Configurações e backup" className="text-gray-600 hover:text-gray-300">
              <Settings size={15} strokeWidth={1.6} />
            </button>
          </div>
          <span className="text-[9px] tracking-[0.12em] uppercase text-zinc-700">{statusLabel}</span>
        </div>
      </div>
    </header>
  );
}

function LeftPanel({ char, ex, prof, caTotal, iniciativa, setExtra, setNumberField, updateChar, doRoll, locked, setLocked, setAttrScore, theme }) {
  return (
    <div className="col-span-1 md:col-span-4 flex flex-col space-y-5">
      <AttrHex
        attrs={char.attrs}
        locked={locked}
        onToggleLock={() => setLocked((l) => !l)}
        onScoreChange={setAttrScore}
        onRoll={(label, m) => doRoll(`Teste de ${label}`, m)}
      />

      <div className="flex justify-center gap-2.5 flex-wrap">
        <StatBox label="B.P." icon={Award} extra={<ExtraBonus value={ex.prof} onChange={(v) => setExtra("prof", v)} />}>
          <NumberInput
            value={prof}
            onChange={(value) => setExtra("prof", toNumber(value, 0) - profBonus(char.header.nivel))}
            className="w-10 bg-transparent text-center text-lg font-semibold text-gray-100 focus:outline-none"
            aria-label="Bônus de proficiência"
          />
        </StatBox>
        <StatBox label="Inspiração" icon={Sparkles}>
          <NumberInput
            value={char.inspiracao}
            aria-label="Inspiração"
            onChange={(value) => setNumberField("inspiracao", value)}
            className="w-10 bg-transparent text-center focus:outline-none"
          />
        </StatBox>
        <StatBox
          label="Iniciativa"
          icon={Dices}
          extra={<ExtraBonus value={ex.iniciativa} onChange={(v) => setExtra("iniciativa", v)} />}
        >
          <NumberInput
            value={iniciativa}
            onChange={(value) => setExtra("iniciativa", toNumber(value, 0) - mod(char.attrs.des.score))}
            className="w-10 bg-transparent text-center text-lg font-semibold text-gray-100 focus:outline-none"
            aria-label="Iniciativa"
          />
        </StatBox>
        <StatBox label="Desloc." icon={Footprints}>
          <input
            value={char.deslocamento}
            onChange={(e) => updateChar((c) => ({ ...c, deslocamento: e.target.value }))}
            className="w-full bg-transparent text-center text-base focus:outline-none"
          />
        </StatBox>
        <div className="flex flex-col items-center gap-1.5">
          <div className="relative w-16 h-14 flex items-center justify-center">
            <Shield size={44} className="absolute text-gray-500" strokeWidth={1.2} />
            <NumberInput
              value={caTotal}
              onChange={(value) =>
                updateChar((c) => ({
                  ...c,
                  caExtra: toNumber(value, 0) - 10 - mod(c.attrs.des.score) - toNumber(c.caEscudo, 0),
                }))
              }
              className="relative z-10 w-10 bg-transparent text-center text-lg font-semibold text-gray-100 focus:outline-none"
              aria-label="Classe de armadura"
            />
          </div>
          <Label className="text-center">CA</Label>
        </div>
      </div>

      <div className="flex justify-center gap-4 -mt-3 flex-wrap">
        <div className="flex items-center gap-1 text-[10px] text-zinc-600">
          <span>CA = 10 + DES +</span>
          <NumberInput
            value={char.caExtra}
            onChange={(value) => setNumberField("caExtra", value)}
            className="w-8 bg-transparent border-b border-zinc-800 text-center focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1 text-[10px] text-zinc-600">
          <span>Bônus de Escudo</span>
          <NumberInput
            value={char.caEscudo}
            onChange={(value) => setNumberField("caEscudo", value)}
            className="w-8 bg-transparent border-b border-zinc-800 text-center focus:outline-none"
          />
        </div>
      </div>

      <StatusBar
        label="Vida"
        icon={Heart}
        cur={char.hp.cur}
        max={char.hp.max}
        color={char.hp.color}
        staticFill
        allowOverflow
        overflowLabel="vida extra"
        numberColor={char.hp.numberColor}
        defaultNumberColor={theme === "light" ? "#292619" : "#f4f4f5"}
        onNumberColorChange={(numberColor) => updateChar((c) => ({ ...c, hp: { ...c.hp, numberColor } }))}
        from="from-red-950/60 to-red-950/20"
        to="from-red-800 to-red-600"
        onColorChange={(color) => updateChar((c) => ({ ...c, hp: { ...c.hp, color } }))}
        onChange={(patch) => updateChar((c) => ({ ...c, hp: { ...c.hp, ...patch } }))}
      />

      <div className="flex items-center justify-center gap-5 -mt-2 text-[10px] text-zinc-600">
        <div className="flex items-center gap-1.5">
          <span className="uppercase tracking-[0.1em]">PV Temp.</span>
          <NumberInput
            value={char.hp.temp}
            onChange={(value) => updateChar((c) => ({ ...c, hp: { ...c.hp, temp: toNumber(value, 0) } }))}
            className="w-9 bg-transparent border-b border-zinc-800 text-center focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="uppercase tracking-[0.1em]">Dados de Vida</span>
          <input
            value={char.hitDice}
            onChange={(e) => updateChar((c) => ({ ...c, hitDice: e.target.value }))}
            className="w-12 bg-transparent border-b border-zinc-800 text-center focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Label>Morte</Label>
          {['success', 'fail'].map((k) => (
            <div key={k} className="flex items-center gap-0.5">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  onClick={() =>
                    updateChar((c) => ({
                      ...c,
                      deathSaves: { ...c.deathSaves, [k]: c.deathSaves[k] === i + 1 ? i : i + 1 },
                    }))
                  }
                  className={`w-2.5 h-2.5 rounded-full border ${
                    char.deathSaves[k] > i
                      ? k === 'success'
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'bg-red-600 border-red-600'
                      : 'bg-transparent border-zinc-700'
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Label>Exaustão</Label>
          <div className="flex items-center gap-0.5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                onClick={() => updateChar((c) => ({ ...c, exhaustion: c.exhaustion === i + 1 ? i : i + 1 }))}
                className={`w-2.5 h-2.5 rounded-full border ${
                  char.exhaustion > i ? 'bg-amber-500 border-amber-500' : 'bg-transparent border-zinc-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-1 text-[10px] text-zinc-600">
        <span className="uppercase tracking-[0.1em]">Pontos de Experiência</span>
        <NumberInput
          value={char.xp}
          onChange={(value) => setNumberField('xp', value)}
          className="w-16 bg-transparent border-b border-zinc-800 text-center text-gray-300 focus:outline-none"
        />
      </div>

      <StatusBar
        label={char.magia.label || 'Pontos de Mana'}
        icon={Sparkles}
        cur={char.magia.cur}
        max={char.magia.max}
        color={char.magia.color}
        numberColor={char.magia.numberColor}
        defaultNumberColor={theme === "light" ? "#292619" : "#f4f4f5"}
        onNumberColorChange={(numberColor) => updateChar((c) => ({ ...c, magia: { ...c.magia, numberColor } }))}
        from="from-violet-950/60 to-violet-950/20"
        to="from-violet-700 to-cyan-500"
        editableLabel
        allowOverflow
        overflowLabel="mana extra"
        onToggleLabel={() =>
          updateChar((c) => ({
            ...c,
            magia: {
              ...c.magia,
              label: c.magia.label.toLowerCase().includes("ki") ? "Pontos de Mana" : "Pontos de Ki",
            },
          }))
        }
        onColorChange={(color) => updateChar((c) => ({ ...c, magia: { ...c.magia, color } }))}
        onChange={(patch) => updateChar((c) => ({ ...c, magia: { ...c.magia, ...patch } }))}
      />

      <div className="space-y-3 pt-1">
        <div>
          <Label>Resistências / Imunidades</Label>
          <Underline value={char.resistencias} onChange={(v) => updateChar((c) => ({ ...c, resistencias: v }))} placeholder="—" />
        </div>
        <div>
          <Label>Proficiências (armas / armaduras)</Label>
          <Underline
            value={char.proficienciasArmas}
            onChange={(v) => updateChar((c) => ({ ...c, proficienciasArmas: v }))}
            placeholder="—"
          />
        </div>
        <div>
          <Label>Idiomas e Ofícios</Label>
          <Underline value={char.linguas} onChange={(v) => updateChar((c) => ({ ...c, linguas: v }))} placeholder="—" />
        </div>
      </div>
    </div>
  );
}

function SkillsPanel({
  char,
  ex,
  prof,
  passivaPercepcao,
  passivaIntuicao,
  setExtra,
  toggleSaveTreino,
  toggleSkillTreino,
  setSkillOutros,
  doRoll,
}) {
  return (
    <div className="col-span-1 md:col-span-4 flex flex-col md:border-l md:border-zinc-900 md:pl-6">
      <h2 className="text-xs tracking-[0.25em] uppercase text-gray-400 mb-3 font-medium">Salva-Guardas</h2>
      <div className="grid grid-cols-3 gap-x-4 gap-y-2 mb-6 pb-5 border-b border-dotted border-zinc-800">
        {ATTRS.map((a) => {
          const trained = !!char.savesTreino[a.key];
          const m = mod(char.attrs[a.key].score) + (trained ? prof : 0);
          return (
            <div key={a.key} className="flex items-center gap-2">
              <button
                onClick={() => toggleSaveTreino(a.key)}
                className={`w-2.5 h-2.5 rounded-full border shrink-0 ${
                  trained ? 'bg-red-700 border-red-700' : 'bg-transparent border-zinc-700'
                }`}
              />
              <RollIcon size={12} onClick={() => doRoll(`Salvaguarda de ${a.label}`, m)} />
              <span className="text-xs text-gray-400">{a.short}</span>
              <span className="text-sm font-semibold ml-auto text-gray-100">{fmtMod(m)}</span>
            </div>
          );
        })}
      </div>

      <h2 className="text-xs tracking-[0.25em] uppercase text-gray-400 mb-3 font-medium">Perícias</h2>
      <div className="flex items-center justify-between px-1 pb-1.5 mb-1 border-b border-zinc-800 text-[9px] tracking-[0.15em] uppercase text-zinc-600">
        <span className="flex-1">Perícia</span>
        <span className="w-10 text-center">Atrib.</span>
        <span className="w-12 text-center">Bônus</span>
        <span className="w-14 text-center">Prof.</span>
        <span className="w-10 text-center">Outros</span>
      </div>
      <div>
        {SKILLS.map((s) => {
          const trained = !!char.skillsTreino[s.name];
          const outros = Number(char.skillsOutros[s.name] || 0);
          const bonus = mod(char.attrs[s.attr].score) + (trained ? prof : 0) + outros;
          return (
            <div
              key={s.name}
              className="flex items-center justify-between px-1 py-1.5 border-b border-dotted border-zinc-900 hover:bg-white/[0.02]"
            >
              <span className="flex-1 flex items-center gap-1.5 min-w-0">
                <RollIcon size={13} onClick={() => doRoll(s.name, bonus)} />
                <span className={`text-sm truncate ${trained ? 'text-emerald-400' : 'text-gray-300'}`}>{s.name}</span>
              </span>
              <span className="w-10 text-center text-[10px] text-zinc-500">
                {ATTRS.find((a) => a.key === s.attr).short}
              </span>
              <span className="w-12 text-center text-sm font-semibold text-gray-100">{fmtMod(bonus)}</span>
              <span className="w-14 flex justify-center">
                <button onClick={() => toggleSkillTreino(s.name)}>
                  <div
                    className={`w-3.5 h-3.5 rounded-full border ${
                      trained ? 'bg-red-700 border-red-700' : 'bg-transparent border-zinc-700'
                    }`}
                  />
                </button>
              </span>
              <NumberInput
                value={char.skillsOutros[s.name] || 0}
                onChange={(value) => setSkillOutros(s.name, toNumber(value, 0))}
                className="w-10 bg-transparent text-center text-xs text-zinc-500 focus:outline-none focus:text-white"
              />
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-dotted border-zinc-800 grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between">
            <Label>Percepção Passiva</Label>
            <span className="text-xl font-bold text-gray-100">{passivaPercepcao}</span>
          </div>
          <div className="flex justify-end mt-0.5">
            <ExtraBonus value={ex.percepcao} onChange={(v) => setExtra('percepcao', v)} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label>Intuição Passiva</Label>
            <span className="text-xl font-bold text-gray-100">{passivaIntuicao}</span>
          </div>
          <div className="flex justify-end mt-0.5">
            <ExtraBonus value={ex.intuicao} onChange={(v) => setExtra('intuicao', v)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CombatTab({ char, setChar, doRoll, prof }) {
  const [draft, setDraft] = useState(null);
  const [editingExisting, setEditingExisting] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [expandedAttacks, setExpandedAttacks] = useState({});

  const openNewAttack = () => {
    setDraft({
      id: uid(), nome: "", dano: "1d6", critico: 20, multiplicador: "x2", ataqueBonus: 0,
      tipoDano: "Cortante", alcance: "", pericia: "", atributo: "des", danoExtra: [], imagem: null, anotacoes: "",
    });
    setEditingExisting(false);
  };
  const openEditAttack = (attack) => {
    setDraft(migrateAttack(attack, prof, char.attrs));
    setEditingExisting(true);
  };
  const saveAttack = (attack) => {
    setChar((current) => ({
      ...current,
      attacks: editingExisting
        ? current.attacks.map((item) => item.id === attack.id ? attack : item)
        : [...current.attacks, attack],
    }));
    setDraft(null);
  };
  const confirmRemove = () => {
    const attackId = pendingRemoval?.id;
    setChar((current) => ({ ...current, attacks: current.attacks.filter((attack) => attack.id !== attackId) }));
    setExpandedAttacks((current) => {
      const next = { ...current };
      delete next[attackId];
      return next;
    });
    setPendingRemoval(null);
  };
  const filteredAttacks = char.attacks.filter((attack) => {
    const query = char.attackFilter.trim().toLowerCase();
    return !query || (attack.nome || "").toLowerCase().includes(query);
  });

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            value={char.attackFilter}
            onChange={(event) => setChar((current) => ({ ...current, attackFilter: event.target.value }))}
            placeholder="Filtrar ataques"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 py-2 pl-8 pr-3 text-xs text-gray-200 placeholder:text-zinc-500 focus:border-amber-500 focus:outline-none"
          />
        </div>
        <button type="button" onClick={openNewAttack} className="flex shrink-0 items-center gap-1 rounded border border-zinc-800 px-3 py-2 text-[11px] uppercase tracking-wide text-amber-500 hover:border-amber-500">
          <Plus size={13} /> Novo Ataque
        </button>
      </div>

      <div className="space-y-2">
        {filteredAttacks.map((attack) => {
          const attribute = ATTRS.find(({ key }) => key === attack.atributo) || ATTRS[0];
          const totalBonus = prof + mod(char.attrs[attribute.key]?.score) + toNumber(attack.ataqueBonus, 0);
          return (
            <AttackCard
              key={attack.id}
              attack={attack}
              bonus={totalBonus}
              expanded={!!expandedAttacks[attack.id]}
              onToggle={() => setExpandedAttacks((current) => ({ ...current, [attack.id]: !current[attack.id] }))}
              onEdit={() => openEditAttack(attack)}
              onRemove={() => setPendingRemoval(attack)}
              onRoll={() => doRoll(`Ataque: ${attack.nome || "sem nome"}`, totalBonus)}
            />
          );
        })}
        {filteredAttacks.length === 0 && <p className="py-5 text-center text-xs text-zinc-500">Nenhum ataque encontrado.</p>}
      </div>

      {draft && (
        <AttackEditorModal
          key={draft.id}
          attack={draft}
          isEditing={editingExisting}
          onClose={() => setDraft(null)}
          onSave={saveAttack}
        />
      )}
      {pendingRemoval && (
        <ConfirmAttackRemoval
          attack={pendingRemoval}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={confirmRemove}
        />
      )}
    </div>
  );
}

function MagicTab({ char, setChar, prof, halfLevel, ex, setExtra }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Magias</Label>
          <select
            value={char.magia.attr}
            onChange={(e) => setChar((c) => ({ ...c, magia: { ...c.magia, attr: e.target.value } }))}
            className="bg-zinc-950 border border-zinc-800 rounded text-[10px] uppercase tracking-wide text-gray-400 px-1.5 py-1 focus:outline-none focus:border-red-800"
            title="Atributo de conjuração"
          >
            <option value="int">Conjura por INT</option>
            <option value="sab">Conjura por SAB</option>
            <option value="car">Conjura por CAR</option>
          </select>
        </div>
        <EditableList
          items={char.magias}
          onChange={(magias) => setChar((c) => ({ ...c, magias }))}
          addLabel="Nova magia"
          fields={[
            { key: 'nome', placeholder: 'Nome' },
            { key: 'custo', placeholder: 'Custo', width: '70px' },
            { key: 'desc', placeholder: 'Efeito', area: true },
          ]}
        />
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-dotted border-zinc-800 text-center">
          <div>
            <Label className="text-center">Pontos de Mana</Label>
            <div className="text-sm font-semibold text-gray-100 mt-0.5">
              {char.magia.cur}/{char.magia.max}
            </div>
          </div>
          <div>
            <Label className="text-center">CD de Magias</Label>
            <div className="text-sm font-semibold text-gray-100 mt-0.5">
              {8 + prof + mod(char.attrs[char.magia.attr].score) + Number(ex.magiaCD || 0)}
            </div>
            <div className="flex justify-center mt-0.5">
              <ExtraBonus value={ex.magiaCD} onChange={(v) => setExtra('magiaCD', v)} />
            </div>
          </div>
          <div>
            <Label className="text-center">Acerto de Magias</Label>
            <div className="text-sm font-semibold text-gray-100 mt-0.5">
              {fmtMod(prof + mod(char.attrs[char.magia.attr].score) + Number(ex.magiaAtk || 0))}
            </div>
            <div className="flex justify-center mt-0.5">
              <ExtraBonus value={ex.magiaAtk} onChange={(v) => setExtra('magiaAtk', v)} />
            </div>
          </div>
        </div>
      </div>

      <div>
        <Label className="mb-2">Runas</Label>
        <textarea
          rows={6}
          value={char.runas}
          onChange={(e) => setChar((c) => ({ ...c, runas: e.target.value }))}
          placeholder="Pulso Rúnico, runas conhecidas e seus efeitos…"
          className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-red-800 resize-y"
        />
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-dotted border-zinc-800 text-center">
          <div>
            <Label className="text-center">CD de Runas</Label>
            <div className="text-sm font-semibold text-gray-100 mt-0.5">
              {8 + prof + halfLevel + Number(ex.runaCD || 0)}
            </div>
            <div className="text-[9px] text-zinc-600">8 + prof. + ½ nível</div>
            <div className="flex justify-center mt-0.5">
              <ExtraBonus value={ex.runaCD} onChange={(v) => setExtra('runaCD', v)} />
            </div>
          </div>
          <div>
            <Label className="text-center">Acerto de Runas</Label>
            <div className="text-sm font-semibold text-gray-100 mt-0.5">
              {fmtMod(prof + halfLevel + Number(ex.runaAtk || 0))}
            </div>
            <div className="text-[9px] text-zinc-600">prof. + ½ nível</div>
            <div className="flex justify-center mt-0.5">
              <ExtraBonus value={ex.runaAtk} onChange={(v) => setExtra('runaAtk', v)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeritageTab({ char, setChar }) {
  return (
    <div>
      <Label className="mb-2">Heranças e Aprimoramentos</Label>
      <EditableList
        items={char.habilidades}
        onChange={(habilidades) => setChar((c) => ({ ...c, habilidades }))}
        addLabel="Nova habilidade"
        fields={[
          { key: 'nome', placeholder: 'Nome' },
          { key: 'desc', placeholder: 'Descrição / efeito', area: true },
        ]}
      />
    </div>
  );
}

function InventoryTab({ char, setChar }) {
  return (
    <div>
      <Label className="mb-2">Moedas</Label>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {['pp', 'pe', 'po', 'pl'].map((k) => (
          <div key={k} className="text-center">
            <Label className="text-center">{k.toUpperCase()}</Label>
            <NumberInput
              value={char.moedas[k]}
              onChange={(value) => setChar((c) => ({ ...c, moedas: { ...c.moedas, [k]: toNumber(value, 0) } }))}
              className="w-full bg-transparent border-b border-zinc-800 text-center text-sm py-1 focus:outline-none focus:border-red-800"
            />
          </div>
        ))}
      </div>
      <Label className="mb-2">Pertences</Label>
      <EditableList
        items={char.inventario}
        onChange={(inventario) => setChar((c) => ({ ...c, inventario }))}
        addLabel="Novo item"
        fields={[
          { key: 'item', placeholder: 'Item' },
            { key: 'qtd', type: 'number', placeholder: '0', width: '60px' },
          { key: 'notas', placeholder: 'Notas' },
        ]}
      />
    </div>
  );
}

function NotesTab({ char, setChar }) {
  return (
    <div>
      <Label className="mb-2">Anotações Pessoais</Label>
      <textarea
        rows={16}
        value={char.bio}
        onChange={(e) => setChar((c) => ({ ...c, bio: e.target.value }))}
        placeholder="Origem, motivações, ganchos de história, relações…"
        className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-red-800 resize-y"
      />
    </div>
  );
}

function RightPanel({
  char,
  tab,
  setTab,
  doRoll,
  setChar,
  updateChar,
  prof,
  halfLevel,
  ex,
  setExtra,
}) {
  return (
    <div className="col-span-1 md:col-span-4 flex flex-col md:border-l md:border-zinc-900 md:pl-6">
      <nav className="flex flex-wrap items-center gap-x-3 gap-y-0 border-b border-zinc-900 pb-2 mb-4">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.name;
          return (
            <button
              key={t.name}
              onClick={() => setTab(t.name)}
              className={`flex items-center gap-1 pb-1 text-[10px] tracking-[0.05em] uppercase whitespace-nowrap border-b-2 transition-colors ${
                active ? 'text-violet-400 border-violet-500' : 'text-gray-600 border-transparent hover:text-gray-400'
              }`}
            >
              <Icon size={13} strokeWidth={1.8} />
              {t.name}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            value={char.freeRoll}
            onChange={(e) => setChar((c) => ({ ...c, freeRoll: e.target.value }))}
            placeholder="Rolar dados (ex: +3)"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-8 pr-3 py-2 text-xs text-gray-200 placeholder:text-zinc-600 focus:outline-none focus:border-red-800"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                doRoll(char.freeRoll || 'Rolagem livre', parseModifier(char.freeRoll));
              }
            }}
          />
        </div>
        <RollIcon
          onClick={() => doRoll(char.freeRoll || 'Rolagem livre', parseModifier(char.freeRoll))}
        />
      </div>

      {tab === "Combate" && <CombatTab char={char} setChar={setChar} doRoll={doRoll} prof={prof} />}

      {tab === 'Magias/Runas' && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Magias</Label>
              <select
                value={char.magia.attr}
                onChange={(e) => setChar((c) => ({ ...c, magia: { ...c.magia, attr: e.target.value } }))}
                className="bg-zinc-950 border border-zinc-800 rounded text-[10px] uppercase tracking-wide text-gray-400 px-1.5 py-1 focus:outline-none focus:border-red-800"
                title="Atributo de conjuração"
              >
                <option value="int">Conjura por INT</option>
                <option value="sab">Conjura por SAB</option>
                <option value="car">Conjura por CAR</option>
              </select>
            </div>
            <EditableList
              items={char.magias}
              onChange={(magias) => setChar((c) => ({ ...c, magias }))}
              addLabel="Nova magia"
              fields={[
                { key: 'nome', placeholder: 'Nome' },
                { key: 'custo', placeholder: 'Custo', width: '70px' },
                { key: 'desc', placeholder: 'Efeito', area: true },
              ]}
            />
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-dotted border-zinc-800 text-center">
              <div>
                <div className="flex items-center justify-center gap-1">
                  <Label className="text-center">{char.magia.label || "Pontos de Mana"}</Label>
                  <button
                    type="button"
                    onClick={() =>
                      setChar((c) => ({
                        ...c,
                        magia: {
                          ...c.magia,
                          label: (c.magia.label || "").toLowerCase().includes("ki") ? "Pontos de Mana" : "Pontos de Ki",
                        },
                      }))
                    }
                    className="text-[9px] uppercase text-violet-400 hover:text-violet-300"
                    title="Alternar entre Mana e Ki"
                  >
                    {(char.magia.label || "").toLowerCase().includes("ki") ? "Mana" : "Ki"}
                  </button>
                </div>
                <div className="mt-0.5 flex items-baseline justify-center gap-1 text-sm font-semibold text-gray-100">
                  <NumberInput
                    value={char.magia.cur}
                    maxLength={12}
                    aria-label="Pontos de Mana atuais"
                    onChange={(value) =>
                      setChar((c) => {
                        const cur = Math.max(0, toNumber(value, 0));
                        const max = Math.max(0, toNumber(c.magia.max, 0));
                        return { ...c, magia: { ...c.magia, cur, max: Math.max(max, cur) } };
                      })
                    }
                    className="w-12 bg-transparent text-center text-sm font-semibold focus:outline-none"
                  />
                  <span className="text-white/50">/</span>
                  <NumberInput
                    value={char.magia.max}
                    maxLength={12}
                    aria-label="Pontos de Mana máximos"
                    onChange={(value) =>
                      setChar((c) => ({ ...c, magia: { ...c.magia, max: Math.max(0, toNumber(value, 0)) } }))
                    }
                    onBlur={() =>
                      setChar((c) => {
                        const max = Math.max(0, toNumber(c.magia.max, 0));
                        return { ...c, magia: { ...c.magia, max, cur: Math.min(max, Math.max(0, toNumber(c.magia.cur, 0))) } };
                      })
                    }
                    className="w-12 bg-transparent text-center text-sm font-semibold focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <Label className="text-center">CD de Magias</Label>
                <div className="text-sm font-semibold text-gray-100 mt-0.5">
                  {8 + prof + mod(char.attrs[char.magia.attr].score) + Number(ex.magiaCD || 0)}
                </div>
                <div className="flex justify-center mt-0.5">
                  <ExtraBonus value={ex.magiaCD} onChange={(v) => setExtra('magiaCD', v)} />
                </div>
              </div>
              <div>
                <Label className="text-center">Acerto de Magias</Label>
                <div className="text-sm font-semibold text-gray-100 mt-0.5">
                  {fmtMod(prof + mod(char.attrs[char.magia.attr].score) + Number(ex.magiaAtk || 0))}
                </div>
                <div className="flex justify-center mt-0.5">
                  <ExtraBonus value={ex.magiaAtk} onChange={(v) => setExtra('magiaAtk', v)} />
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label className="mb-2">Runas</Label>
            <textarea
              rows={6}
              value={char.runas}
              onChange={(e) => setChar((c) => ({ ...c, runas: e.target.value }))}
              placeholder="Pulso Rúnico, runas conhecidas e seus efeitos…"
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-red-800 resize-y"
            />
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-dotted border-zinc-800 text-center">
              <div>
                <Label className="text-center">CD de Runas</Label>
                <div className="text-sm font-semibold text-gray-100 mt-0.5">
                  {8 + prof + halfLevel + Number(ex.runaCD || 0)}
                </div>
                <div className="text-[9px] text-zinc-600">8 + prof. + ½ nível</div>
                <div className="flex justify-center mt-0.5">
                  <ExtraBonus value={ex.runaCD} onChange={(v) => setExtra('runaCD', v)} />
                </div>
              </div>
              <div>
                <Label className="text-center">Acerto de Runas</Label>
                <div className="text-sm font-semibold text-gray-100 mt-0.5">
                  {fmtMod(prof + halfLevel + Number(ex.runaAtk || 0))}
                </div>
                <div className="text-[9px] text-zinc-600">prof. + ½ nível</div>
                <div className="flex justify-center mt-0.5">
                  <ExtraBonus value={ex.runaAtk} onChange={(v) => setExtra('runaAtk', v)} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'Heranças' && (
        <div>
          <Label className="mb-2">Heranças e Aprimoramentos</Label>
          <EditableList
            items={char.habilidades}
            onChange={(habilidades) => setChar((c) => ({ ...c, habilidades }))}
            addLabel="Nova habilidade"
            fields={[
              { key: 'nome', placeholder: 'Nome' },
              { key: 'desc', placeholder: 'Descrição / efeito', area: true },
            ]}
          />
        </div>
      )}

      {tab === 'Inventário' && (
        <div>
          <Label className="mb-2">Moedas</Label>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {['pp', 'pe', 'po', 'pl'].map((k) => (
              <div key={k} className="text-center">
                <Label className="text-center">{k.toUpperCase()}</Label>
                  <NumberInput
                  value={char.moedas[k]}
                  onChange={(value) => setChar((c) => ({ ...c, moedas: { ...c.moedas, [k]: toNumber(value, 0) } }))}
                  className="w-full bg-transparent border-b border-zinc-800 text-center text-sm py-1 focus:outline-none focus:border-red-800"
                />
              </div>
            ))}
          </div>
          <Label className="mb-2">Pertences</Label>
          <EditableList
            items={char.inventario}
            onChange={(inventario) => setChar((c) => ({ ...c, inventario }))}
            addLabel="Novo item"
            fields={[
              { key: 'item', placeholder: 'Item' },
              { key: 'qtd', type: 'number', placeholder: '0', width: '60px' },
              { key: 'notas', placeholder: 'Notas' },
            ]}
          />
        </div>
      )}

      {tab === 'Anotações' && (
        <div>
          <Label className="mb-2">Anotações Pessoais</Label>
          <textarea
            rows={16}
            value={char.bio}
            onChange={(e) => setChar((c) => ({ ...c, bio: e.target.value }))}
            placeholder="Origem, motivações, ganchos de história, relações…"
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-red-800 resize-y"
          />
        </div>
      )}
    </div>
  );
}

function SettingsModal({ onClose, onExport, onImport, onReset, theme, onThemeChange }) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");

  const handleImport = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      onImport(JSON.parse(await file.text()));
      setError("");
    } catch (importError) {
      setError("Não foi possível importar. Selecione um backup JSON válido da ficha.");
    } finally {
      input.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="settings-title" className="text-sm font-semibold uppercase tracking-widest text-gray-200">
            Configurações da ficha
          </h2>
          <button type="button" onClick={onClose} title="Fechar" aria-label="Fechar configurações" className="text-zinc-500 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="mb-5">
          <Label className="mb-2">Tema</Label>
          <div role="group" aria-label="Tema do site" className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={theme === "light"}
              onClick={() => onThemeChange("light")}
              className={`rounded border px-3 py-2 text-sm transition-colors ${theme === "light" ? "border-amber-500 text-amber-500" : "border-zinc-800 text-gray-400"}`}
            >
              Claro: branco e dourado
            </button>
            <button
              type="button"
              aria-pressed={theme === "dark"}
              onClick={() => onThemeChange("dark")}
              className={`rounded border px-3 py-2 text-sm transition-colors ${theme === "dark" ? "border-amber-500 text-amber-500" : "border-zinc-800 text-gray-400"}`}
            >
              Escuro: preto e dourado
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <button type="button" onClick={onExport} className="w-full rounded border border-zinc-800 px-3 py-2 text-left text-sm text-gray-200 hover:border-zinc-600">
            Exportar backup da ficha (.json)
          </button>
          <button type="button" onClick={() => inputRef.current?.click()} className="w-full rounded border border-zinc-800 px-3 py-2 text-left text-sm text-gray-200 hover:border-zinc-600">
            Importar backup da ficha (.json)
          </button>
          <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
          <button type="button" onClick={onReset} className="w-full rounded border border-red-950 px-3 py-2 text-left text-sm text-red-300 hover:border-red-700">
            Restaurar ficha padrão
          </button>
        </div>
        {error && <p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}
        <p className="mt-4 text-xs text-zinc-500">Os dados ficam salvos neste navegador. Use o backup para transferir a ficha entre dispositivos.</p>
      </section>
    </div>
  );
}

export default function RunarcanaSheet() {
  const [char, setChar] = useState(defaultChar());
  const [roll, setRoll] = useState(null);
  const [preferences] = useState(loadPreferences);
  const [tab, setTab] = useState(preferences.tab);
  const [theme, setTheme] = useState(preferences.theme);
  const [status, setStatus] = useState("loading");
  const [locked, setLocked] = useState(preferences.locked);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const saveTimer = useRef(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    savePreferences({ tab, locked, theme });
  }, [tab, locked, theme]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const loaded = await loadChar();
      if (!mounted) return;
      if (loaded) setChar(restoreCharacter(loaded));
      setStatus("ready");
    })().catch(() => {
      if (mounted) setStatus("offline");
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    if (status === "loading") return;
    setStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const ok = await saveChar(char);
      setStatus(ok ? "saved" : "offline");
    }, 500);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char]);

  const updateChar = (updater) => setChar((current) => updater(current));
  const setHeader = (key, val) => updateChar((c) => ({ ...c, header: { ...c.header, [key]: val } }));
  const setAttrScore = (key, score) => updateChar((c) => ({ ...c, attrs: { ...c.attrs, [key]: { score } } }));
  const toggleSaveTreino = (key) => updateChar((c) => ({ ...c, savesTreino: { ...c.savesTreino, [key]: !c.savesTreino[key] } }));
  const toggleSkillTreino = (name) => updateChar((c) => ({ ...c, skillsTreino: { ...c.skillsTreino, [name]: !c.skillsTreino[name] } }));
  const setSkillOutros = (name, val) => updateChar((c) => ({ ...c, skillsOutros: { ...c.skillsOutros, [name]: val } }));
  const setNumberField = (field, value) => updateChar((c) => ({ ...c, [field]: toNumber(value, 0) }));

  const doRoll = useCallback((label, m, mode = "normal", die = 20) => {
    const r1 = secureRoll(die);
    const r2 = mode === "normal" ? null : secureRoll(die);
    setRoll({ label, mod: m, die, mode, r1, r2 });
  }, []);
  const reroll = useCallback((mode) => roll && doRoll(roll.label, roll.mod, mode, roll.die), [roll, doRoll]);
  const sharePage = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Ficha Runarcana", url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        window.prompt("Copie o link da ficha:", url);
      }
    } catch (error) {
      if (error.name !== "AbortError") window.prompt("Copie o link da ficha:", url);
    }
  };
  const importCharacter = (data) => {
    setChar(restoreCharacter(data));
    setSettingsOpen(false);
  };
  const resetCharacter = () => {
    if (!window.confirm("Restaurar a ficha padrão? Os dados atuais serão substituídos.")) return;
    setChar(defaultChar());
    setSettingsOpen(false);
  };

  const ex = char.extras;
  const setExtra = (key, val) => setChar((c) => ({ ...c, extras: { ...c.extras, [key]: toNumber(val, 0) } }));
  const prof = profBonus(char.header.nivel) + toNumber(ex.prof, 0);
  const caTotal = 10 + mod(char.attrs.des.score) + toNumber(char.caExtra, 0) + toNumber(char.caEscudo, 0);
  const iniciativa = mod(char.attrs.des.score) + toNumber(ex.iniciativa, 0);
  const halfLevel = Math.floor(clampLevel(char.header.nivel) / 2);
  const passivaPercepcao =
    10 + mod(char.attrs.sab.score) + (char.skillsTreino["Percepção"] ? prof : 0) + toNumber(ex.percepcao, 0);
  const passivaIntuicao =
    10 + mod(char.attrs.sab.score) + (char.skillsTreino["Intuição"] ? prof : 0) + toNumber(ex.intuicao, 0);

  const filteredAttacks = useMemo(() => {
    const q = char.attackFilter.trim().toLowerCase();
    if (!q) return char.attacks;
    return char.attacks.filter((a) => (a.nome || "").toLowerCase().includes(q));
  }, [char.attacks, char.attackFilter]);

  const statusLabel = { loading: "Carregando…", saving: "Salvando…", saved: "Salvo", offline: "Alterações locais" }[status];

  return (
    <div data-theme={theme} className="min-h-screen w-full bg-black text-gray-300 font-sans">

      <div
        className="h-[2px] w-full"
        style={{ background: "linear-gradient(90deg, transparent, var(--sheet-accent), transparent)" }}
      />

      <HeaderPanel
        char={char}
        setHeader={setHeader}
        updateChar={updateChar}
        statusLabel={statusLabel}
        onShare={sharePage}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full max-w-7xl mx-auto mt-8 px-6 pb-10 items-start">
        <LeftPanel
          char={char}
          theme={theme}
          ex={ex}
          prof={prof}
          caTotal={caTotal}
          iniciativa={iniciativa}
          setExtra={setExtra}
          setNumberField={setNumberField}
          updateChar={updateChar}
          doRoll={doRoll}
          locked={locked}
          setLocked={setLocked}
          setAttrScore={setAttrScore}
        />

        <SkillsPanel
          char={char}
          ex={ex}
          prof={prof}
          passivaPercepcao={passivaPercepcao}
          passivaIntuicao={passivaIntuicao}
          setExtra={setExtra}
          toggleSaveTreino={toggleSaveTreino}
          toggleSkillTreino={toggleSkillTreino}
          setSkillOutros={setSkillOutros}
          doRoll={doRoll}
        />

        <RightPanel
          char={char}
          tab={tab}
          setTab={setTab}
          doRoll={doRoll}
          setChar={setChar}
          prof={prof}
          halfLevel={halfLevel}
          ex={ex}
          setExtra={setExtra}
        />
      </div>

      <DiceToast roll={roll} onClose={() => setRoll(null)} onReroll={reroll} />
      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onExport={() => downloadCharacter(char)}
          onImport={importCharacter}
          onReset={resetCharacter}
          theme={theme}
          onThemeChange={setTheme}
        />
      )}
    </div>
  );
}
