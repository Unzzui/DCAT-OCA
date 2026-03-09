# Filosofia de Diseno — DCAT-OCA (Enel)

**Minimalismo Ejecutivo de Alto Impacto**

---

## 1. Proposito

El diseno no existe para decorar.
Existe para clarificar, jerarquizar y elevar decisiones.

Cada elemento visual debe responder a una pregunta concreta:

- Que decision habilita?
- Que riesgo evidencia?
- Que desempeno revela?

Si no aporta claridad estrategica, se elimina.

---

## 2. Principios Fundamentales

### 2.1 Claridad sobre Ornamentacion

No se utilizan emojis, iconos decorativos ni elementos visuales sin funcion analitica.
El diseno debe transmitir seriedad, precision y autoridad tecnica.

Todo recurso grafico debe justificar su presencia por su valor informativo.

### 2.2 Minimalismo con Intencion

Minimalismo no es vacio; es eliminacion de ruido.

Se prioriza:
- Espacios amplios y respiracion visual
- Jerarquia tipografica clara
- Uso limitado y estrategico del color
- Reduccion de bordes, sombras y efectos innecesarios

Cada elemento debe tener proposito y alineacion exacta.

### 2.3 Estetica Corporativa Premium

El diseno debe reflejar:
- Profesionalismo
- Rigor analitico
- Control
- Confianza ejecutiva

Se evita:
- Saturacion cromatica
- Colores infantiles
- Gradientes llamativos
- Exceso de contraste innecesario
- Estetica experimental o informal

Se priorizan:
- Paletas sobrias (grises, azul profundo, negro suave, blanco calido)
- Un solo color de acento para alertas o enfasis
- Consistencia absoluta en tamanos, pesos y alineaciones

### 2.4 Jerarquia Visual Estrategica

La informacion debe leerse en tres niveles:

1. **Panorama general** — impacto inmediato
2. **Indicadores clave** — rendimiento y riesgo
3. **Detalle analitico** — causa y profundidad

Los elementos criticos deben dominar visualmente.
Lo secundario debe ser discreto pero accesible.

### 2.5 Datos como Protagonistas

El diseno nunca compite con los datos.

Se evita:
- Graficos sobrecargados
- Leyendas innecesarias
- Etiquetas redundantes
- Efectos 3D
- Colores multiples sin logica

Se prioriza:
- Comparabilidad
- Simetria
- Escalas consistentes
- Claridad numerica
- Contexto temporal

### 2.6 Precision y Consistencia

Todo debe estar alineado con rigor geometrico.
No hay elementos "ligeramente desplazados".

Se mantiene:
- Grid estructurado
- Margenes uniformes
- Espaciado consistente
- Tipografias limitadas (maximo dos familias)

La consistencia transmite control.

### 2.7 Elegancia Silenciosa

Un diseno premium no grita.
No necesita efectos para impresionar.

Impacta por:
- Orden
- Limpieza
- Seguridad visual
- Profundidad conceptual

Debe provocar una reaccion interna de confianza, no de sorpresa.

---

## 3. Normas Operativas para la IA

Al construir cualquier visualizacion o interfaz:

1. Eliminar cualquier elemento decorativo sin valor analitico
2. Reducir el numero de colores al minimo necesario
3. Priorizar tipografia clara y profesional
4. Evitar iconografia innecesaria
5. No utilizar emojis
6. Evitar saturacion visual
7. Garantizar alineacion perfecta
8. Maximizar legibilidad sobre creatividad
9. **Si existe duda entre anadir o eliminar un elemento, eliminar**

---

## 4. Sensacion Objetivo

El resultado final debe sentirse:

- Ejecutivo
- Estrategico
- Profesional
- Controlado
- Premium
- Minimalista
- Atemporal

Debe parecer disenado para una sala de directorio de Enel, no para una presentacion academica.

---

## 5. Paleta de Referencia

| Rol | Color | Hex |
|-----|-------|-----|
| Primario (autoridad) | Steel blue | `#4f6d7a` |
| Secundario (exito neutro) | Sage green | `#7c9885` |
| Peligro (mal ejecutado) | Rojo vivido | `#dc2626` |
| Alerta (cautela) | Ambar/oro | `#c9963b` |
| Neutro | Slate | `#94a3b8` |
| Exito (bien ejecutado) | Verde vivido | `#16a34a` |
| Fondo | Slate 50 | `#f8fafc` |
| Texto principal | Slate 800 | `#1e293b` |
| Texto secundario | Slate 500 | `#64748b` |

Los colores de senal (rojo, verde, ambar) se reservan exclusivamente para indicar estado.
No se usan como decoracion.

---

## 6. Tipografia

- **Familia primaria:** Inter (sans-serif del sistema)
- **Pesos:** 400 (cuerpo), 500 (labels), 600 (titulos), 700 (KPIs)
- **Tamanos KPI:** `text-xl` a `text-2xl`
- **Tamanos labels:** `text-[10px]` uppercase tracking-wider
- **Tamanos cuerpo tabla:** `text-[11px]`

No se mezclan mas de dos familias tipograficas.

---

## 7. Componentes UI

### Cards
- Fondo blanco, borde `slate-200/60`, sombra `shadow-sm`
- Padding `px-4 py-3`
- Border radius `rounded-lg`
- Sin bordes gruesos ni sombras dramaticas

### Tablas
- Headers: `text-[10px]` uppercase slate-500
- Celdas: `text-[11px]` slate-600/700
- Hover sutil: `hover:bg-slate-50/80`
- Bordes minimos: solo `border-b border-slate-50`

### Badges/Tags
- Tamano pequeno, redondeados
- Color semantico: rojo=mal, verde=bien, ambar=alerta
- Sin iconos dentro de badges

### Graficos (ECharts)
- Tooltips blancos con borde slate-200
- Grid lines punteadas `#f1f5f9`
- Ejes sin linea, sin ticks
- Labels `fontSize: 10-11`, color `#64748b`
- barMaxWidth contenido (18-32px)
- Leyendas discretas en la parte inferior

### Modales
- Overlay `bg-slate-900/30 backdrop-blur-[2px]`
- Contenido blanco, `rounded-xl`, `shadow-2xl`
- Header con color semantico o slate-800
- Boton cerrar discreto (X, sin texto)
