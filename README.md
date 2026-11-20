# Malla Interactiva

Malla curricular interactiva: marca las materias aprobadas, mira cuáles se desbloquean
y calcula cuánto te falta para graduarte. Funciona para **varias carreras y planes**.

## Estructura

```
malla-interactiva/
├── index.html                  → estructura de la página
├── css/styles.css              → diseño (colores, tarjetas, animaciones)
├── js/
│   ├── app.js                  → arranque, selectores de carrera/plan y clics
│   ├── malla.js                → dibuja la grilla, tarjetas y conexiones
│   ├── reglas.js               → lógica: disponibilidad, tiempo, plan mes a mes
│   └── storage.js              → guarda el avance en el navegador
└── data/
    ├── carreras.json           → catálogo de carreras y sus planes
    ├── plantilla-plan.json     → plantilla para crear una carrera nueva
    └── carreras/
        └── ingenieria-sistemas/
            ├── plan-antiguo.json
            └── plan-nuevo.json
```

**Regla de oro:** el código (`js/`) no sabe nada de ninguna carrera. Todo lo específico vive en `data/`.

## Cómo abrirlo

Los archivos JSON se leen con `fetch`, y los navegadores lo bloquean si abres `index.html` con doble clic.
Ábrelo con un servidor:

- **VS Code:** extensión *Live Server* → clic derecho en `index.html` → "Open with Live Server".
- **Python:** en la carpeta, ejecuta `python -m http.server` y abre `http://localhost:8000`.
- **GitHub Pages:** funciona directo al publicarlo.

## Agregar una carrera nueva (sin tocar código)

1. Crea la carpeta `data/carreras/<id-de-la-carrera>/` (ej. `ingenieria-comercial`).
2. Copia `data/plantilla-plan.json` dentro, renómbralo (ej. `plan-nuevo.json`) y llénalo con sus materias.
3. Agrégala al catálogo `data/carreras.json`:

```json
{
  "id": "ingenieria-comercial",
  "nombre": "Ingeniería Comercial",
  "planPorDefecto": "nuevo",
  "planes": [
    { "id": "nuevo", "nombre": "Malla nueva", "archivo": "carreras/ingenieria-comercial/plan-nuevo.json" }
  ]
}
```

Listo: aparece en el selector de carreras, con un botón por cada plan.

## Formato de un plan

| Campo | Qué es |
|---|---|
| `descripcion` | Texto bajo el título (ej. "Plan 320-04") |
| `mostrarCodigos` | `true` muestra el código de la materia; `false` muestra los créditos |
| `areas` | Áreas de la malla con su nombre y color, ej. `{ "id": "cb", "nombre": "Ciencias Básicas", "color": "#cddb7b" }`. Aparecen en la leyenda |
| `reglas.mesesPorMateria` | Meses que dura cada materia (por defecto 1) |
| `reglas.duraciones` | Materias con otra duración, ej. `{ "MDG-01": 4 }` |
| `reglas.requiereHastaSemestre` | Por tipo de materia, hasta qué semestre hay que aprobar todo. Ej. `{ "electiva": 5, "practica": 5 }` |
| `semestres[].nombre` | `"I"`, `"II"`… se muestra como "SEMESTRE I". Otro texto (ej. `"Grado"`) se muestra tal cual |

Cada materia:

```json
{ "id": "SIS-0121", "nombre": "Programación I", "area": "sis", "ht": 40, "hp": 60, "cr": 5, "requiere": ["SIS-0120"] }
```

- `id`: único dentro del plan. Es lo que se usa en `requiere`.
- `area`: `id` de su área en `areas`; define el color de la tarjeta (el mismo de la malla original).
- `requiere`: lista de `id` que hay que aprobar antes.
- `"tipo": "electiva"` o `"tipo": "practica"`: la materia sigue la regla `requiereHastaSemestre` de su tipo.
  Puede tener además su propio `requiere` (ej. Práctica II también pide Práctica I).
- Para nombres muy largos puedes usar `­` (guion opcional), ej. `"Emprende­durismo"`.

> Si escribes mal un `id` en `requiere`, la consola del navegador (F12) muestra un aviso
> indicando qué materia pide algo que no existe.

## Al cambiar CSS o JavaScript: sube la versión

Los navegadores guardan en caché los archivos `.css` y `.js`. Para que todos vean tu cambio,
sube el número de versión **en todos estos lugares** (ej. de `?v=5` a `?v=6`):

- `index.html` → `css/styles.css?v=…` y `js/app.js?v=…`
- `js/app.js` → los tres `import … from "./….js?v=…"`
- `js/malla.js` → `import … from "./reglas.js?v=…"`

Los archivos de `data/` no necesitan esto: se piden con una marca de tiempo (`?t=…`), así que siempre llegan actualizados.

## Links directos

Cada malla tiene su propio link: `index.html#ingenieria-sistemas--nuevo`.
Sirve para compartir una carrera y plan específicos.
