import { today } from "./constants";

// Decoración de temporada (Halloween / Día de Muertos) en el inicio de sesión.
// Se muestra solo hasta esta fecha (hora de México); después desaparece sola.
export const HALLOWEEN_END = "2026-11-10";
export const halloweenActive = () => today() <= HALLOWEEN_END;
