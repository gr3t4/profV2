# Reglas de diseño de AppProf

Guía para que todas las pantallas se vean y se comporten igual. Los valores viven en
`src/lib/design.js` (tokens) y `src/lib/constants.js` (colores); los estilos globales y los
componentes base, en `src/components/Shared.jsx`. **No uses números o colores sueltos**: si
falta algo, agrégalo primero a los tokens.

---

## 1. Principios

1. **Primero el celular.** La mayoría de los docentes usa la app de pie, frente al grupo, con una mano. Todo se diseña a 360 px de ancho y luego se adapta a la computadora.
2. **Una acción principal por pantalla.** Pasar lista es lo más importante; lo demás queda en segundo plano.
3. **Nunca dejar al usuario sin respuesta.** Cada toque tiene una reacción visible y cada espera muestra un estado de carga (sección 6 y 7).
4. **Lenguaje de escuela, no de sistemas.** "Pasar lista", "Faltas", "Entregó"; nunca "registro", "error 500" o "null".

## 2. Color

| Uso | Token | Valor |
|---|---|---|
| Fondo de la app | `C.bg` | #07201a |
| Superficie (campos, barras) | `C.surface` | #0c2d24 |
| Tarjetas y ventanas | `C.card` | #0f3529 |
| Bordes | `C.border` | #1a5040 |
| Acción principal / marca | `C.accent` | #007E67 (verde CONALEP) |
| Texto | `C.text` | #e8f5f1 |
| Texto secundario | `C.muted` | #5a9e8a |
| Énfasis institucional | `C.gold` / `C.guinda` | #B38E5D / #9D2449 |

**Colores con significado (no usarlos para decorar):**

| Significado | Token | Dónde |
|---|---|---|
| Asistencia / entregó / bien | `C.success` | ✅ |
| Retardo / entregó tarde | `C.late` | 🕐 |
| Justificada | `C.excused` | 📝 |
| Falta / no entregó / reprobando | `C.danger` | ❌ 🔴 |
| En riesgo / advertencia | `C.warning` | 🟠 ⚠️ |

- El color **nunca va solo**: siempre acompáñalo de un ícono o texto (lectores de pantalla y daltonismo).
- Fondos tenues de estado: el color con transparencia `22` (≈13 %) y borde con `44`–`66`.
- Contraste mínimo 4.5:1 para texto normal. `C.muted` solo para texto secundario de 12 px o más.

## 3. Tipografía

| Rol | Tamaño (`FONT.size`) | Peso |
|---|---|---|
| Título de pantalla | `xl` 22 | 700 (Space Grotesk) |
| Título de tarjeta / ventana | `lg` 18 o `md` 15 | 700 |
| Texto normal | `base` 14 | 400–600 |
| Etiquetas de campos | `xs` 11 | 400, color `muted` |
| Números grandes (conteos, calificaciones) | 22–28 | 800 (Space Grotesk) |

- Los campos de texto usan **mínimo 15 px** para que el iPhone no haga zoom al escribir.
- Etiquetas de sección en MAYÚSCULAS, 11 px, `letter-spacing:1`, color `teal`.

## 4. Espaciado, radios y capas

- Escala de 4 px: `SPACE` = 4, 8, 12, 16, 20, 24, 32.
- Separación entre tarjetas: 8–12. Relleno de tarjeta: 12–16 (celular), 16–20 (computadora).
- Radios (`RADIUS`): botones y campos 8–10 · tarjetas 14 · ventanas 20 · etiquetas tipo píldora 999.
- Capas (`Z`): encabezado 100 · ventanas 2000 · avisos (toast) 2500 · barra de carga 3000. Ninguna otra.
- Las ventanas (modales) se dibujan con `createPortal(…, document.body)` para que ninguna animación de la página las desacomode.

## 5. Componentes

**Botones**
- Clase base `btn` en todos (da los estados de la sección 6).
- Área táctil mínima **44 × 44 px** (`TOUCH`); los botones de asistencia ocupan una fila completa de 4.
- Variantes: *principal* (degradado verde, texto blanco, uno por pantalla) · *secundario* (color al 13 % con borde) · *fantasma* (sin fondo, borde `border`) · *peligro* (rojo tenue; pide confirmación).
- Texto con verbo y, si ayuda, un emoji al inicio: "💾 Guardar", "📥 Excel", "+ Nueva clase".

**Chips (filtros)** — clase `btn chip`, con `aria-pressed` para el seleccionado.

**Tarjetas** — fondo `card`, borde `border`, radio 14. Si se pueden tocar: clase `row-hover`, `role="button"`, `tabIndex={0}` y activarse también con Enter.

**Campos** — clase `inp`; etiqueta arriba (11 px `muted`); error con `aria-invalid="true"` y el mensaje debajo en rojo.

**Ventanas** — fondo oscurecido al 75 %, ventana `card` radio 20, máximo 94 % del alto con scroll interno; botón principal a la izquierda y "Cancelar" (fantasma) a la derecha.

**Avisos (toast)** — abajo al centro, 3 s, empiezan con emoji de resultado: ✅ éxito · ❌ error · ⚠️ advertencia · ⏳ en proceso.

## 6. Estados de interacción

Todo elemento que se puede tocar debe tener **los cinco estados**. Ya los dan las clases `btn`, `chip`, `row-hover` e `inp`; no los reescribas con estilos en línea.

| Estado | Cómo se ve | Regla CSS |
|---|---|---|
| Reposo | Su color normal | — |
| Hover (solo con mouse) | 15 % más brillante; en tarjetas, fondo un poco más claro | `@media (hover:hover)` |
| Presionado | Se encoge (escala 0.96) y se oscurece un poco | `:active` |
| Foco con teclado | Contorno dorado de 2 px separado 2 px | `:focus-visible` |
| Deshabilitado | 50 % de opacidad y cursor "no permitido"; no reacciona | `:disabled` |
| Ocupado (guardando) | Spinner + texto ("Guardando…"), no acepta otro toque | `aria-busy="true"` |
| Seleccionado | Relleno sólido del color de estado y borde interior claro | `aria-pressed="true"` |

- En celular no existe hover: la reacción al tocar es el estado *presionado*.
- Al marcar asistencia el botón elegido hace un pequeño "pop" (`className="pop"`) para confirmar el toque.
- Nunca quites el contorno de foco sin poner otro igual de visible.

## 7. Estados de carga

| Situación | Qué mostrar | Componente |
|---|---|---|
| Arranque de la app | Figura animada + "Cargando…" a pantalla completa | `<LoadingScreen/>` |
| Primera carga de una lista (clases, actividades, grupos, calificaciones) | Tarjetas "fantasma" con brillo, del mismo tamaño que las reales | `<SkeletonList/>` |
| Cargas que no bloquean (abrir clase, cambiar fecha, recalcular, generar Excel) | Barra delgada de colores arriba de la pantalla | `<TopProgress show/>` |
| Abrir una clase | Spinner y "Abriendo…" en la tarjeta tocada; las demás se atenúan y no responden | `aria-busy` + `is-loading` |
| Cambiar de fecha | La lista se atenúa y junto a "Fecha" aparece "cargando…" | `is-loading` |
| Botón que guarda | Spinner dentro del botón + "Guardando…"; el botón queda deshabilitado | `<BusyLabel busy/>` |
| Guardado automático de la lista | Etiqueta junto a la fecha: "💾 Autoguardado activo", "⏳ Guardando…", "✅ Guardado automático", "📴 Sin internet · N en el celular", "⏳ Enviando N…" | ya existente |

Reglas:
- Si la espera dura **menos de 300 ms**, no muestres nada extra; si dura más, usa la tabla anterior.
- Los esqueletos imitan la forma real del contenido; nunca muestres "No hay datos" mientras todavía se está cargando.
- Todo estado de carga lleva `role="status"` o `aria-busy` para lectores de pantalla.
- Si la carga falla: aviso ❌ en lenguaje sencillo y una forma de reintentar.

## 8. Movimiento

- Duraciones (`MOTION`): 120 ms (presionar) · 180 ms (hover, color) · 300 ms (entrada de pantallas).
- Entradas: `fadeUp` (pantallas y ventanas) y `slideIn` (filas), con retraso escalonado de 25–50 ms.
- Con "reducir movimiento" activado en el teléfono, las animaciones se apagan (solo queda un spinner lento).

## 9. Accesibilidad (mínimos)

- Área táctil ≥ 44 px · contraste ≥ 4.5:1 · color siempre con ícono o texto.
- Elementos que se tocan y no son `<button>`: `role="button"`, `tabIndex={0}`, Enter/Espacio.
- Botones solo con ícono (✏️ 🗑️ 📅): `title` y/o `aria-label`.
- Mensajes de estado con `aria-live="polite"`.

## 10. Lista de revisión para una pantalla nueva

- [ ] Se ve bien a 360 px y no hay scroll horizontal.
- [ ] Usa tokens (colores, espacios, radios, capas) y las clases `btn`, `chip`, `inp`, `row-hover`.
- [ ] Tiene estado de carga (esqueleto o barra), estado vacío y estado de error.
- [ ] Cada botón que guarda muestra "Guardando…" y no permite doble toque.
- [ ] Se puede usar con teclado (foco visible) y los íconos tienen texto alternativo.
- [ ] Los textos están en español sencillo y los avisos empiezan con ✅ ❌ ⚠️ ⏳.
