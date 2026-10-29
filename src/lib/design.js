// ═══════════════════════════════════════════════════════════════════
//  Reglas de diseño de AppProf (tokens). Ver DESIGN.md para el detalle.
//  Toda pantalla nueva debe usar estos valores en lugar de números sueltos.
// ═══════════════════════════════════════════════════════════════════
export { C, BRAND } from "./constants";

// Espaciado: escala de 4 px
export const SPACE = { xxs:4, xs:8, sm:12, md:16, lg:20, xl:24, xxl:32 };

// Radios
export const RADIUS = { sm:8, md:10, lg:14, xl:20, pill:999 };

// Tipografía (px). Inter para texto, Space Grotesk/Sora para números y títulos grandes.
export const FONT = {
  family: "'Inter',sans-serif",
  display: "'Space Grotesk','Sora',sans-serif",
  size: { xs:11, sm:12, base:14, md:15, lg:18, xl:22, xxl:28 },
  weight: { regular:400, medium:500, semibold:600, bold:700, heavy:800 },
};

// Área táctil mínima (WCAG 2.5.5 / guías de iOS y Android)
export const TOUCH = 44;

// Movimiento (ms)
export const MOTION = { fast:120, base:180, slow:300 };

// Capas (z-index): siempre de esta lista
export const Z = { base:0, raised:1, header:100, dropdown:500, modal:2000, toast:2500, overlay:3000 };
