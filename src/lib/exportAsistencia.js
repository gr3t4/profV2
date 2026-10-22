// Exportación a Excel con formato institucional (CONALEP): logo, encabezado
// con docente, grupo y materia, y colores por estado (asistencia, retardo,
// justificada, falta). Usa ExcelJS (se carga solo al exportar).

const VERDE = "FF007E67", GUINDA = "FF9D2449", DORADO = "FFB38E5D";

// Colores por estado: relleno y texto
const EST = {
  present: { code:"A", label:"Asistencia",  fill:"FFC6EFCE", font:"FF006100" },
  late:    { code:"R", label:"Retardo",     fill:"FFFFEB9C", font:"FF9C5700" },
  excused: { code:"J", label:"Justificada", fill:"FFBDD7EE", font:"FF1F4E79" },
  absent:  { code:"F", label:"Falta",       fill:"FFFFC7CE", font:"FF9C0006" },
  pending: { code:"-", label:"Sin registro",fill:"FFF2F2F2", font:"FF7F7F7F" },
};
const est = (s) => EST[s] || EST.pending;

const thin = { style:"thin", color:{ argb:"FFBFBFBF" } };
const BORDER = { top:thin, left:thin, bottom:thin, right:thin };

function fmtCorta(iso) { const [, m, d] = iso.split("-"); return `${d}/${m}`; }
function fmtLarga(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
}
const safeSheet = (n) => n.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);

async function logoBase64() {
  try {
    const r = await fetch("/logoConalepExcel.png");
    const buf = new Uint8Array(await r.arrayBuffer());
    let s = ""; for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
    return btoa(s);
  } catch { return null; }
}

// Encabezado común: logo, título, datos de la clase, franja de colores y leyenda.
// Devuelve el número de la siguiente fila libre.
function encabezado(wb, ws, logoId, nCols, titulo, lineas, conLeyenda = true) {
  for (let r = 1; r <= 4; r++) ws.getRow(r).height = 21;
  if (logoId !== null) ws.addImage(logoId, { tl:{ col:0.15, row:0.2 }, ext:{ width:100, height:72 }, editAs:"oneCell" });

  const fila = (r, text, font) => {
    ws.mergeCells(r, 2, r, nCols);   // la columna A queda para el logo
    const c = ws.getCell(r, 2);
    c.value = text; c.font = font; c.alignment = { horizontal:"center", vertical:"middle" };
  };
  fila(1, "CONALEP", { bold:true, size:16, color:{ argb:VERDE } });
  fila(2, titulo, { bold:true, size:13, color:{ argb:GUINDA } });
  fila(3, lineas[0] || "", { size:10, color:{ argb:"FF404040" } });
  fila(4, lineas[1] || "", { size:10, color:{ argb:"FF404040" } });

  // Franja guinda / verde / dorado
  ws.getRow(5).height = 5;
  const tercio = Math.max(1, Math.round(nCols / 3));
  for (let c = 1; c <= nCols; c++) {
    ws.getCell(5, c).fill = { type:"pattern", pattern:"solid", fgColor:{ argb: c <= tercio ? GUINDA : c <= tercio * 2 ? VERDE : DORADO } };
  }

  if (!conLeyenda) return 7;
  // Leyenda de colores (cada clave ocupa las columnas necesarias; si no caben, sigue en otra fila)
  const ancho = (c) => ws.getColumn(c).width || 9;
  let r = 7, col = 2;
  ws.getCell(r, 1).value = "Clave:"; ws.getCell(r, 1).font = { bold:true, size:9 };
  for (const k of ["present", "late", "excused", "absent"]) {
    let fin = col, w = ancho(col);
    while (w < 13 && fin < nCols) { fin++; w += ancho(fin); }
    if (fin > nCols || (w < 13 && col > 2)) { r++; col = 2; fin = col; w = ancho(col); while (w < 13 && fin < nCols) { fin++; w += ancho(fin); } }
    if (fin > col) ws.mergeCells(r, col, r, fin);
    const e = EST[k], c = ws.getCell(r, col);
    c.value = `${e.code} = ${e.label}`;
    c.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:e.fill } };
    c.font = { bold:true, size:9, color:{ argb:e.font } };
    c.alignment = { horizontal:"center", vertical:"middle" };
    c.border = BORDER;
    col = fin + 1;
    if (col > nCols) { r++; col = 2; }
  }
  return (col === 2 ? r : r + 1) + 1;
}

function cabeceraTabla(ws, r, headers) {
  const row = ws.getRow(r);
  headers.forEach((h, i) => {
    const c = row.getCell(i + 1);
    c.value = h;
    c.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:VERDE } };
    c.font = { bold:true, color:{ argb:"FFFFFFFF" }, size:10 };
    c.alignment = { horizontal:"center", vertical:"middle", wrapText:true };
    c.border = BORDER;
  });
  row.height = 30;
}

function celdaEstado(c, status, texto) {
  const e = est(status);
  c.value = texto ?? e.label;
  c.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:e.fill } };
  c.font = { bold:true, color:{ argb:e.font }, size:10 };
  c.alignment = { horizontal:"center", vertical:"middle" };
  c.border = BORDER;
}

function celda(c, v, opts = {}) {
  c.value = v; c.border = BORDER;
  c.alignment = { vertical:"middle", horizontal: opts.align || "left", wrapText: !!opts.wrap };
  if (opts.font) c.font = opts.font;
  if (opts.fill) c.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:opts.fill } };
}

function cuenta(statuses) {
  const n = { present:0, late:0, excused:0, absent:0 };
  statuses.forEach(s => { if (n[s] !== undefined) n[s]++; });
  return n;
}
const pct = (n, total) => total ? (n.present + n.late + n.excused) / total : null;

function celdaPct(c, p) {
  c.value = p; c.numFmt = "0%"; c.border = BORDER;
  c.alignment = { horizontal:"center", vertical:"middle" };
  if (p !== null) c.font = { bold:true, color:{ argb: p < 0.8 ? "FF9C0006" : "FF006100" } };
}

function pie(ws, r, nCols) {
  ws.mergeCells(r, 1, r, nCols);
  const c = ws.getCell(r, 1);
  c.value = `Generado con AppProf el ${new Date().toLocaleString("es-MX", { timeZone:"America/Mexico_City" })}`;
  c.font = { italic:true, size:8, color:{ argb:"FF7F7F7F" } };
}

function impresion(ws, horizontal) {
  ws.pageSetup = { orientation: horizontal ? "landscape" : "portrait", fitToPage:true, fitToWidth:1, fitToHeight:0, paperSize:9,
    margins:{ left:0.4, right:0.4, top:0.5, bottom:0.5, header:0.2, footer:0.2 } };
}

/**
 * @param type   "date" | "full" | "justify" | "student" | "all"
 * @param ctx    { docente, grupo, materia, clase, selectedDate, dates[], students[], attendanceDay{id:{status,reason}}, idx{id:{date:{status,reason}}} }
 */
export async function exportarAsistencia(type, ctx) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = ctx.docente || "AppProf";
  wb.created = new Date();
  const b64 = await logoBase64();
  const logoId = b64 ? wb.addImage({ base64:b64, extension:"png" }) : null;

  const info1 = `Docente: ${ctx.docente || "—"}   ·   Grupo: ${ctx.grupo || "—"}   ·   Materia: ${ctx.materia || "—"}`;
  const dates = ctx.dates;
  const periodo = dates.length ? `Periodo: ${fmtCorta(dates[0])}/${dates[0].slice(0,4)} al ${fmtCorta(dates[dates.length-1])}/${dates[dates.length-1].slice(0,4)}   ·   ${dates.length} clase${dates.length===1?"":"s"} registrada${dates.length===1?"":"s"}` : "Sin clases registradas";

  // ── Asistencia del día ──
  function hojaDia() {
    const ws = wb.addWorksheet(safeSheet(`Día ${fmtCorta(ctx.selectedDate)}`), { views:[{ showGridLines:false }] });
    ws.columns = [{ width:5 }, { width:38 }, { width:16 }, { width:34 }];
    let r = encabezado(wb, ws, logoId, 4, "Lista de asistencia", [info1, `Fecha: ${fmtLarga(ctx.selectedDate)}`]);
    cabeceraTabla(ws, r, ["No.", "Alumno", "Estado", "Motivo (justificada)"]);
    ws.views = [{ state:"frozen", ySplit:r, showGridLines:false }];
    const statuses = [];
    ctx.students.forEach((s, i) => {
      r++;
      const rec = ctx.attendanceDay[s.id] || {};
      const st = rec.status || "pending"; statuses.push(st);
      celda(ws.getCell(r, 1), i + 1, { align:"center" });
      celda(ws.getCell(r, 2), s.name);
      celdaEstado(ws.getCell(r, 3), st);
      celda(ws.getCell(r, 4), st === "excused" ? (rec.reason || "") : "", { wrap:true });
    });
    const n = cuenta(statuses);
    r += 2;
    for (const [k, v] of [["present", n.present], ["late", n.late], ["excused", n.excused], ["absent", n.absent]]) {
      celdaEstado(ws.getCell(r, 2), k, `Total ${EST[k].label.toLowerCase()}s`);
      ws.getCell(r, 2).alignment = { horizontal:"left", indent:1 };
      celda(ws.getCell(r, 3), v, { align:"center", font:{ bold:true } });
      r++;
    }
    pie(ws, r + 1, 4);
    impresion(ws, false);
  }

  // ── Reporte completo (alumnos × fechas) ──
  function hojaCompleta() {
    const nCols = 2 + dates.length + 5;
    const ws = wb.addWorksheet("Reporte completo", { views:[{ showGridLines:false }] });
    ws.columns = [{ width:5 }, { width:36 }, ...dates.map(() => ({ width:5.5 })), { width:9 }, { width:9 }, { width:10 }, { width:8 }, { width:9 }];
    let r = encabezado(wb, ws, logoId, nCols, "Reporte de asistencia", [info1, periodo]);
    cabeceraTabla(ws, r, ["No.", "Alumno", ...dates.map(fmtCorta), "Asist.", "Retardos", "Justif.", "Faltas", "% Asist."]);
    // Fechas en vertical para que quepan
    dates.forEach((_, i) => { ws.getCell(r, 3 + i).alignment = { horizontal:"center", vertical:"middle", textRotation:90 }; });
    ws.getRow(r).height = 42;
    ws.views = [{ state:"frozen", xSplit:2, ySplit:r, showGridLines:false }];
    ctx.students.forEach((s, i) => {
      r++;
      celda(ws.getCell(r, 1), i + 1, { align:"center" });
      celda(ws.getCell(r, 2), s.name);
      const sts = dates.map((d, j) => {
        const st = ctx.idx[s.id]?.[d]?.status || "pending";
        celdaEstado(ws.getCell(r, 3 + j), st, est(st).code);
        return st;
      });
      const n = cuenta(sts), c0 = 3 + dates.length;
      celda(ws.getCell(r, c0),     n.present, { align:"center", font:{ bold:true, color:{ argb:EST.present.font } } });
      celda(ws.getCell(r, c0 + 1), n.late,    { align:"center", font:{ bold:true, color:{ argb:EST.late.font } } });
      celda(ws.getCell(r, c0 + 2), n.excused, { align:"center", font:{ bold:true, color:{ argb:EST.excused.font } } });
      celda(ws.getCell(r, c0 + 3), n.absent,  { align:"center", font:{ bold:true, color:{ argb:EST.absent.font } }, fill: n.absent ? EST.absent.fill : undefined });
      celdaPct(ws.getCell(r, c0 + 4), pct(n, dates.length));
    });
    r += 2;
    ws.mergeCells(r, 1, r, Math.min(nCols, 8));
    ws.getCell(r, 1).value = "El % de asistencia cuenta asistencias, retardos y justificadas. En rojo: menos de 80 %.";
    ws.getCell(r, 1).font = { size:9, italic:true, color:{ argb:"FF595959" } };
    pie(ws, r + 1, Math.min(nCols, 8));
    impresion(ws, true);
  }

  // ── Justificaciones ──
  function hojaJustificaciones() {
    const ws = wb.addWorksheet("Justificaciones", { views:[{ showGridLines:false }] });
    ws.columns = [{ width:5 }, { width:36 }, { width:14 }, { width:46 }];
    let r = encabezado(wb, ws, logoId, 4, "Faltas justificadas", [info1, periodo]);
    cabeceraTabla(ws, r, ["No.", "Alumno", "Fecha", "Motivo"]);
    let n = 0;
    for (const s of ctx.students) for (const d of dates) {
      const rec = ctx.idx[s.id]?.[d];
      if (rec?.status !== "excused") continue;
      r++; n++;
      celda(ws.getCell(r, 1), n, { align:"center" });
      celda(ws.getCell(r, 2), s.name);
      celdaEstado(ws.getCell(r, 3), "excused", fmtCorta(d) + "/" + d.slice(0, 4));
      celda(ws.getCell(r, 4), rec.reason || "(sin motivo)", { wrap:true });
    }
    if (!n) { r++; ws.mergeCells(r, 1, r, 4); celda(ws.getCell(r, 1), "Sin faltas justificadas", { align:"center", font:{ italic:true, color:{ argb:"FF7F7F7F" } } }); }
    pie(ws, r + 2, 4);
    impresion(ws, false);
  }

  // ── Una hoja por alumno ──
  function hojasAlumno() {
    const usados = new Set();
    ctx.students.forEach((s) => {
      let nombre = safeSheet(s.name), k = 2;
      while (usados.has(nombre.toLowerCase()) || ["reporte completo", "justificaciones"].includes(nombre.toLowerCase())) nombre = safeSheet(s.name.slice(0, 27)) + " " + k++;
      usados.add(nombre.toLowerCase());
      const ws = wb.addWorksheet(nombre, { views:[{ showGridLines:false }] });
      ws.columns = [{ width:5 }, { width:30 }, { width:16 }, { width:36 }];
      let r = encabezado(wb, ws, logoId, 4, s.name, [info1, periodo]);
      cabeceraTabla(ws, r, ["No.", "Fecha", "Estado", "Motivo (justificada)"]);
      const sts = [];
      dates.forEach((d, i) => {
        r++;
        const rec = ctx.idx[s.id]?.[d]; const st = rec?.status || "pending"; sts.push(st);
        celda(ws.getCell(r, 1), i + 1, { align:"center" });
        celda(ws.getCell(r, 2), fmtLarga(d));
        celdaEstado(ws.getCell(r, 3), st);
        celda(ws.getCell(r, 4), st === "excused" ? (rec.reason || "") : "", { wrap:true });
      });
      const n = cuenta(sts);
      r += 2;
      for (const [key, v] of [["present", n.present], ["late", n.late], ["excused", n.excused], ["absent", n.absent]]) {
        celdaEstado(ws.getCell(r, 2), key, `${EST[key].label}s`);
        ws.getCell(r, 2).alignment = { horizontal:"left", indent:1 };
        celda(ws.getCell(r, 3), v, { align:"center", font:{ bold:true } });
        r++;
      }
      celda(ws.getCell(r, 2), "% de asistencia", { font:{ bold:true } });
      celdaPct(ws.getCell(r, 3), pct(n, dates.length));
      pie(ws, r + 2, 4);
      impresion(ws, false);
    });
  }

  const base = (ctx.clase || "clase").replace(/[^\wáéíóúñÁÉÍÓÚÑ -]/g, "").trim().replace(/\s+/g, "_");
  let file;
  if (type === "date")         { hojaDia(); file = `asistencia_${base}_${ctx.selectedDate}.xlsx`; }
  else if (type === "full")    { hojaCompleta(); file = `reporte_${base}.xlsx`; }
  else if (type === "justify") { hojaJustificaciones(); file = `justificaciones_${base}.xlsx`; }
  else if (type === "student") { if (!ctx.students.length) return false; hojasAlumno(); file = `alumnos_${base}.xlsx`; }
  else                         { hojaDia(); hojaCompleta(); hojaJustificaciones(); hojasAlumno(); file = `completo_${base}.xlsx`; }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = file;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

// ══════════════════════════════════════════════════════════════════
//  Calificaciones (resumen + una hoja por parcial con sus actividades)
// ══════════════════════════════════════════════════════════════════
const SIT = {
  2: { label:"Reprobando", fill:"FFFFC7CE", font:"FF9C0006" },
  1: { label:"En riesgo",  fill:"FFFFEB9C", font:"FF9C5700" },
  0: { label:"Bien",       fill:"FFC6EFCE", font:"FF006100" },
};

function celdaCal(c, v, aprobatoria) {
  c.value = v ?? "—"; c.border = BORDER; c.numFmt = "0.0";
  c.alignment = { horizontal:"center", vertical:"middle" };
  if (v !== null && v !== undefined) {
    const malo = v < aprobatoria;
    c.font = { bold:true, color:{ argb: malo ? "FF9C0006" : "FF006100" } };
    if (malo) c.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FFFFC7CE" } };
  } else c.font = { color:{ argb:"FF7F7F7F" } };
}

/**
 * ctx: { docente, grupo, materia, clase, students, acts, marks, ev (resultado de evaluar), cfg }
 */
export async function exportarCalificaciones(ctx) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = ctx.docente || "AppProf"; wb.created = new Date();
  const b64 = await logoBase64();
  const logoId = b64 ? wb.addImage({ base64:b64, extension:"png" }) : null;
  const { cfg, ev } = ctx;
  const apr = Number(cfg.aprobatoria);
  const info1 = `Docente: ${ctx.docente || "—"}   ·   Grupo: ${ctx.grupo || "—"}   ·   Materia: ${ctx.materia || "—"}`;
  const reglas = `Aprobatoria: ${apr}   ·   Asistencia mínima: ${cfg.asistencia_min}%   ·   Asistencia en la calificación: ${cfg.pct_asistencia}%`;

  // ── Resumen ──
  {
    const ws = wb.addWorksheet("Calificaciones", { views:[{ showGridLines:false }] });
    ws.columns = [{ width:5 }, { width:36 }, { width:8 }, { width:8 }, { width:8 }, { width:9 }, { width:11 }, { width:10 }, { width:13 }, { width:44 }];
    let r = encabezado(wb, ws, logoId, 10, "Concentrado de calificaciones", [info1, reglas], false);
    cabeceraTabla(ws, r, ["No.", "Alumno", "Parcial 1", "Parcial 2", "Parcial 3", "Final", "Asistencia", "Entregas", "Situación", "Observaciones"]);
    ws.views = [{ state:"frozen", ySplit:r, showGridLines:false }];
    ctx.students.forEach((s, i) => {
      r++;
      const e = ev.porAlumno[s.id];
      celda(ws.getCell(r, 1), i + 1, { align:"center" });
      celda(ws.getCell(r, 2), s.name);
      e.parciales.forEach((p, j) => celdaCal(ws.getCell(r, 3 + j), p.cal, apr));
      celdaCal(ws.getCell(r, 6), e.final, apr);
      const ca = ws.getCell(r, 7);
      ca.value = e.asist.pct === null ? "—" : e.asist.pct / 100; ca.numFmt = "0%"; ca.border = BORDER; ca.alignment = { horizontal:"center" };
      if (e.asist.pct !== null) ca.font = { bold:true, color:{ argb: e.asist.pct < Number(cfg.asistencia_min) ? "FF9C0006" : "FF006100" } };
      celda(ws.getCell(r, 8), e.totCalif ? `${e.totEnt}/${e.totCalif}` : "—", { align:"center" });
      const sit = SIT[e.nivel];
      celda(ws.getCell(r, 9), sit.label, { align:"center", fill:sit.fill, font:{ bold:true, color:{ argb:sit.font } } });
      celda(ws.getCell(r, 10), e.motivos.join(" · "), { wrap:true, font:{ size:9 } });
    });
    r += 2;
    ws.mergeCells(r, 1, r, 10);
    ws.getCell(r, 1).value = `Reprobando: ${ev.resumen.reprobando}   ·   En riesgo: ${ev.resumen.riesgo}   ·   Bien: ${ctx.students.length - ev.resumen.reprobando - ev.resumen.riesgo}`;
    ws.getCell(r, 1).font = { bold:true, size:10, color:{ argb:GUINDA } };
    pie(ws, r + 2, 10);
    impresion(ws, true);
  }

  // ── Una hoja por parcial ──
  [0, 1, 2].forEach(i => {
    const acts = ev.actsPorParcial[i];
    if (!acts.length) return;
    const nCols = 2 + acts.length + 3;
    const ws = wb.addWorksheet(`Parcial ${i + 1}`, { views:[{ showGridLines:false }] });
    ws.columns = [{ width:5 }, { width:34 }, ...acts.map(() => ({ width:9 })), { width:10 }, { width:10 }, { width:10 }];
    const p = cfg.parciales[i];
    const rango = p.inicio || p.fin ? `Del ${p.inicio ? fmtCorta(p.inicio) : "inicio"} al ${p.fin ? fmtCorta(p.fin) : "fin"}` : "Asistencia de todo el periodo";
    let r = encabezado(wb, ws, logoId, nCols, `Parcial ${i + 1} — actividades`, [info1, `${rango}   ·   Entregó sin calificación = 10 · Tarde = ${cfg.nota_tarde} · No entregó = 0`], false);
    cabeceraTabla(ws, r, ["No.", "Alumno", ...acts.map(a => `${a.title}${Number(a.peso) !== 1 ? ` (x${Number(a.peso)})` : ""}`), "Prom. act.", "Asistencia", "Calificación"]);
    ws.getRow(r).height = 54;
    ws.views = [{ state:"frozen", xSplit:2, ySplit:r, showGridLines:false }];
    const M = {}; ctx.marks.forEach(m => { (M[m.activity_id] ||= {})[m.student_id] = m; });
    ctx.students.forEach((s, k) => {
      r++;
      const e = ev.porAlumno[s.id].parciales[i];
      celda(ws.getCell(r, 1), k + 1, { align:"center" });
      celda(ws.getCell(r, 2), s.name);
      acts.forEach((a, j) => {
        const m = M[a.id]?.[s.id];
        const c = ws.getCell(r, 3 + j);
        if (!m) { celda(c, "—", { align:"center", font:{ color:{ argb:"FF7F7F7F" } } }); return; }
        const pts = m.score !== null && m.score !== undefined ? Number(m.score) : m.status === "delivered" ? 10 : m.status === "late" ? Number(cfg.nota_tarde) : 0;
        const key = m.status === "missing" ? "absent" : m.status === "late" ? "late" : "present";
        celdaEstado(c, key, pts);
        c.numFmt = "0.#";
      });
      celdaCal(ws.getCell(r, 3 + acts.length), e.promAct, apr);
      const ca = ws.getCell(r, 4 + acts.length);
      ca.value = e.asis.pct === null ? "—" : e.asis.pct / 100; ca.numFmt = "0%"; ca.border = BORDER; ca.alignment = { horizontal:"center" };
      celdaCal(ws.getCell(r, 5 + acts.length), e.cal, apr);
    });
    r += 2;
    ws.mergeCells(r, 1, r, Math.min(nCols, 8));
    ws.getCell(r, 1).value = "Verde: entregó · Amarillo: entregó tarde · Rojo: no entregó · —: sin registro";
    ws.getCell(r, 1).font = { size:9, italic:true, color:{ argb:"FF595959" } };
    pie(ws, r + 1, Math.min(nCols, 8));
    impresion(ws, true);
  });

  const base = (ctx.clase || "clase").replace(/[^\wáéíóúñÁÉÍÓÚÑ -]/g, "").trim().replace(/\s+/g, "_");
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `calificaciones_${base}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
