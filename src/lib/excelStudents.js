import * as XLSX from "xlsx";

const HEADER_ALIASES = {
  name: ["nombre", "alumno", "estudiante", "name", "student"],
  tutorName: ["tutor", "nombre del tutor", "nombre tutor", "padre", "madre", "tutor name"],
  tutorPhone: ["telefono", "teléfono", "whatsapp", "phone", "celular", "tel"],
};

function norm(cell) {
  return String(cell ?? "").trim().toLowerCase();
}

function matchHeader(cell) {
  const n = norm(cell);
  if (!n) return null;
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some((a) => n === a || n.includes(a))) return key;
  }
  return null;
}

// Lee un archivo .xlsx/.xls y devuelve [{name, tutorName, tutorPhone}], detectando
// automáticamente si la primera fila es un encabezado (Nombre/Tutor/Teléfono en
// cualquier orden) o si es simplemente una lista de nombres en la columna A.
export async function parseStudentsExcel(file) {
  const wb = XLSX.read(await file.arrayBuffer());
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  if (!rows.length) return [];

  const detected = {};
  let looksLikeHeader = false;
  (rows[0] || []).forEach((cell, i) => {
    const key = matchHeader(cell);
    if (key) {
      detected[key] = i;
      looksLikeHeader = true;
    }
  });

  const colMap = looksLikeHeader && detected.name !== undefined ? detected : { name: 0 };
  const dataRows = looksLikeHeader && detected.name !== undefined ? rows.slice(1) : rows;

  return dataRows
    .map((r) => {
      const name = String(r[colMap.name] ?? "").trim();
      if (!name) return null;
      const tutorName = colMap.tutorName != null ? String(r[colMap.tutorName] ?? "").trim() : "";
      const tutorPhone = colMap.tutorPhone != null ? String(r[colMap.tutorPhone] ?? "").trim() : "";
      return { name, tutorName, tutorPhone };
    })
    .filter(Boolean);
}

export function downloadStudentsTemplate() {
  const rows = [
    ["Nombre", "Tutor", "Teléfono"],
    ["Juan Pérez", "María Pérez", "3312345678"],
    ["Ana García", "", ""],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Alumnos");
  XLSX.writeFile(wb, "plantilla_alumnos.xlsx");
}
