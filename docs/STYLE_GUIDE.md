# Guia de Estilos - Dashboard DCAT-OCA

## Colores Corporativos

### Primarios
| Color | Hex | Uso |
|-------|-----|-----|
| Azul OCA | `#294D6D` | Headers, botones primarios, textos destacados |
| Rojo OCA | `#DE473C` | Alertas, acciones destructivas, KPIs negativos |

### Secundarios (derivados)
| Color | Hex | Uso |
|-------|-----|-----|
| Azul claro | `#4A7BA7` | Hover states, bordes, iconos secundarios |
| Azul muy claro | `#E8F1F8` | Backgrounds de cards, filas alternadas |
| Rojo claro | `#FDEAEA` | Background alertas, estados de error |
| Gris oscuro | `#374151` | Texto principal |
| Gris medio | `#6B7280` | Texto secundario, labels |
| Gris claro | `#F3F4F6` | Backgrounds, separadores |
| Blanco | `#FFFFFF` | Background principal |

### Estados
| Estado | Color | Uso |
|--------|-------|-----|
| Success | `#10B981` | Efectivas, bien ejecutados, completados |
| Warning | `#F59E0B` | Pendientes, en proceso |
| Error | `#DE473C` | No efectivas, mal ejecutados, rechazados |
| Info | `#294D6D` | Informativo, neutral |

---

## Tipografia

### Font Family
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Escala Tipografica
| Elemento | Tamano | Peso | Uso |
|----------|--------|------|-----|
| H1 | 30px | 700 | Titulo de pagina |
| H2 | 24px | 600 | Titulos de seccion |
| H3 | 18px | 600 | Titulos de cards |
| Body | 14px | 400 | Texto general |
| Small | 12px | 400 | Labels, captions |
| KPI Value | 36px | 700 | Numeros destacados |

---

## Componentes

### Cards
```
- Border radius: 8px
- Padding: 24px
- Shadow: 0 1px 3px rgba(0,0,0,0.1)
- Background: #FFFFFF
- Border: 1px solid #E5E7EB (opcional)
```

### Botones

**Primario**
```
- Background: #294D6D
- Color: #FFFFFF
- Border radius: 6px
- Padding: 10px 16px
- Hover: #1E3A52
```

**Secundario**
```
- Background: transparent
- Color: #294D6D
- Border: 1px solid #294D6D
- Hover: background #E8F1F8
```

**Destructivo**
```
- Background: #DE473C
- Color: #FFFFFF
- Hover: #C73C32
```

### Inputs
```
- Border: 1px solid #D1D5DB
- Border radius: 6px
- Padding: 10px 12px
- Focus: border-color #294D6D, ring 2px #294D6D/20%
```

### Tablas
```
- Header background: #F9FAFB
- Header text: #374151, peso 600
- Row border: 1px solid #E5E7EB
- Row hover: #F3F4F6
- Row alternada: #FAFAFA (opcional)
- Padding celdas: 12px 16px
```

### KPI Cards
```
- Icono: 24x24px, color segun estado
- Valor: 36px, peso 700, color #374151
- Label: 12px, color #6B7280
- Tendencia: flecha + porcentaje, color segun direccion
```

---

## Graficos

### Paleta para series
```javascript
const chartColors = [
  '#294D6D', // Azul OCA (primario)
  '#DE473C', // Rojo OCA
  '#4A7BA7', // Azul claro
  '#10B981', // Verde
  '#F59E0B', // Amarillo
  '#8B5CF6', // Purpura
  '#EC4899', // Rosa
  '#6B7280', // Gris
];
```

### Configuracion base
```
- Grid lines: #E5E7EB, 1px dashed
- Axis labels: #6B7280, 12px
- Tooltip: background #1F2937, color #FFFFFF, radius 6px
- Legend: posicion bottom, font 12px
```

---

## Espaciado

### Sistema de spacing (base 4px)
| Token | Valor | Uso |
|-------|-------|-----|
| xs | 4px | Gaps minimos |
| sm | 8px | Padding interno pequeno |
| md | 16px | Padding estandar |
| lg | 24px | Separacion entre secciones |
| xl | 32px | Margenes de pagina |
| 2xl | 48px | Separacion mayor |

---

## Responsive Breakpoints

| Breakpoint | Valor | Descripcion |
|------------|-------|-------------|
| sm | 640px | Mobile landscape |
| md | 768px | Tablet |
| lg | 1024px | Desktop pequeno |
| xl | 1280px | Desktop |
| 2xl | 1536px | Desktop grande |

---

## Iconografia

- Libreria: **Lucide React** (ligera, consistente)
- Tamano default: 20px
- Stroke width: 1.5px
- Color: heredado del contexto

---

## Estados de carga

### Skeleton
```
- Background: linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)
- Animation: shimmer 1.5s infinite
- Border radius: igual al componente
```

### Spinner
```
- Color: #294D6D
- Tamano: 24px (default), 16px (small), 32px (large)
```

---

## Accesibilidad

- Contraste minimo: 4.5:1 para texto normal
- Focus visible en todos los elementos interactivos
- Labels en todos los inputs
- Alt text en imagenes
- Keyboard navigation completa
