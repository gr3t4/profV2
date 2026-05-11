export const C = {
  bg:"#07201a", surface:"#0c2d24", card:"#0f3529", border:"#1a5040",
  accent:"#007a5e", success:"#00a87e", danger:"#e53935", warning:"#d29922",
  text:"#e8f5f1", muted:"#5a9e8a", purple:"#00897b", teal:"#00796b",
  gold:"#c9a227", late:"#b84a00", excused:"#0097a7",
};

export const STATUS = {
  present: { label:"Presente",    icon:"✅", color:C.success, short:"P", bg:"#10b98122" },
  absent:  { label:"Ausente",     icon:"❌", color:C.danger,  short:"F", bg:"#ef444422" },
  late:    { label:"Retardo",     icon:"🕐", color:C.late,    short:"R", bg:"#f9731622" },
  excused: { label:"Justificada", icon:"📝", color:C.excused, short:"J", bg:"#06b6d422" },
  pending: { label:"Sin reg.",    icon:"⏳", color:C.muted,   short:"-", bg:"#64748b22" },
};

export const today   = () => new Date().toISOString().split("T")[0];
export const fmtDate = (d) => new Date(d+"T12:00:00").toLocaleDateString("es-MX",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
export const fmtDT   = (iso) => new Date(iso).toLocaleDateString("es-MX",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
