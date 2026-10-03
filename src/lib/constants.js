// Colores institucionales CONALEP (Guía de identidad 2023): verde Pantone 335 C #007E67,
// guinda Pantone 7420 C #9D2449 y dorado Pantone 465 C #B38E5D.
export const BRAND = {
  name: "CONALEP",
  logo: "/conalep-logo-blanco.png",
  stripe: "linear-gradient(90deg,#9D2449 0 33%,#007E67 33% 66%,#B38E5D 66% 100%)",
};

export const C = {
  bg:"#07201a", surface:"#0c2d24", card:"#0f3529", border:"#1a5040",
  accent:"#007E67", success:"#00a87e", danger:"#e53935", warning:"#d29922",
  text:"#e8f5f1", muted:"#5a9e8a", purple:"#00897b", teal:"#00796b",
  gold:"#B38E5D", guinda:"#9D2449", late:"#b84a00", excused:"#0097a7",
};

export const STATUS = {
  present: { label:"Presente",    icon:"✅", color:C.success, short:"P", bg:"#10b98122" },
  absent:  { label:"Ausente",     icon:"❌", color:C.danger,  short:"F", bg:"#ef444422" },
  late:    { label:"Retardo",     icon:"🕐", color:C.late,    short:"R", bg:"#f9731622" },
  excused: { label:"Justificada", icon:"📝", color:C.excused, short:"J", bg:"#06b6d422" },
  pending: { label:"Sin reg.",    icon:"⏳", color:C.muted,   short:"-", bg:"#64748b22" },
};

export const TURNOS = {
  matutino:   { label:"Matutino",   icon:"🌅" },
  vespertino: { label:"Vespertino", icon:"🌇" },
};

// Fecha de hoy en hora de Ciudad de México (YYYY-MM-DD). Antes se usaba UTC, y
// desde las 18:00 la app creía que ya era el día siguiente.
const MX_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" });
export const today   = () => MX_DATE.format(new Date());
export const fmtDate = (d) => new Date(d+"T12:00:00").toLocaleDateString("es-MX",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
export const fmtDT   = (iso) => new Date(iso).toLocaleDateString("es-MX",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
