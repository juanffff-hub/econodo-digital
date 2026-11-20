# Cómo entregar EcoNodo a Claude

Preparado a partir de la revisión del código local del 17 de noviembre de 2026.

## 1. Prompt principal

Para la entrega con ZIP, capturas de la web, render de la carcasa y Avance 2 en PDF, copia primero el contenido de `MENSAJE_PARA_CLAUDE.md` como mensaje en Claude. Ese archivo incorpora las referencias seleccionadas y explica cómo utilizar cada adjunto. Funciona también si tu ZIP ya descargado contiene únicamente los dos documentos originales de esta carpeta; no requiere volver a comprimir el proyecto.

Como alternativa, puedes abrir `PROMPT_CLAUDE_ECONODO.md` y copiar su contenido completo como mensaje, o adjuntarlo y enviar esta instrucción:

> Usa PROMPT_CLAUDE_ECONODO.md como mi encargo principal. Revisa el proyecto y los adjuntos, presenta brevemente tu diagnóstico y ejecuta el trabajo hasta entregar los archivos completos. Comprueba primero qué materiales puedes abrir.

El prompt detallado contiene el contexto, las restricciones y el formato de entrega. Si usas `MENSAJE_PARA_CLAUDE.md` y el ZIP ya incluye el prompt detallado, no necesitas pegar ambos: el mensaje le pide a Claude leerlo dentro del proyecto.

## 2. Adjuntos, en orden de prioridad

| Prioridad | Material | Qué aporta |
| --- | --- | --- |
| Imprescindible | ZIP del proyecto actual, preparado como se indica abajo | Código real, API, estilos, pruebas, firmware y documentación. |
| Imprescindible | Avance 2 en PDF; el DOCX puede acompañarlo si hace falta | Arquitectura, propósito académico y relación física/digital. |
| Muy recomendable | Capturas actuales del dashboard y del observatorio | Evidencia del punto de partida y de lo que debe mejorar. |
| Muy recomendable si el PDF no las muestra con claridad | Renders o capturas de la carcasa: exterior y distribución interna | Evitan deformar el dispositivo o inventar componentes. |
| Recomendable si no se lee bien en el PDF | Storyboard y diagrama de despliegue como PNG/PDF | Conectan la narrativa visual con la propuesta original. |
| Opcional | Dos fotografías reales de la zona verde y una del nodo instalado, si existe | Permiten dar identidad local sin inventar lugar, vegetación o instalación. |
| Ya resuelto en el mensaje | Emergence Magazine, Kew y NASA Earth Observatory | Referencias seleccionadas para relato/atmósfera, detalle botánico y evidencia. No necesitas buscar ni adjuntar ejemplos adicionales. |
| Opcional | Synthetic Architect | Referencia de método. El prompt ya incorpora sus principios útiles. |

No es necesario enviar el mismo contenido en varios formatos si ya resulta legible. Los enlaces y las pautas para interpretar las referencias están en `MENSAJE_PARA_CLAUDE.md`; las aplicaciones estéticas propuestas son una síntesis para EcoNodo, no una reproducción de esos sitios.

### Archivos que ya tienes identificados

- Documento del proyecto: `C:\Users\pipef\Downloads\Avance 2 Grupo 4(2).docx`.
- Versión Markdown: `C:\Users\pipef\Downloads\Avance 2 Grupo 4(2).md`.
- Guía metodológica: `C:\Users\pipef\Downloads\Synthetic Architect\Synthetic Architect.md`.

Para preservar diagramas y renders, exporta el Word como PDF desde Word. Según la documentación de Claude, los documentos que no son PDF se procesan mediante extracción de texto; sus imágenes incrustadas no se interpretan por esa vía. Por eso, el DOCX o Markdown por sí solos no son la mejor referencia visual. Fuente: [Upload files to Claude](https://support.claude.com/en/articles/8241126-upload-files-to-claude).

El archivo Markdown de Synthetic Architect referencia PNG locales. Si decides enviarlo para mostrar su apariencia, acompáñalo de sus imágenes o usa una exportación PDF. Su apariencia no es un modelo obligatorio para EcoNodo.

El archivo `EcoNodo_estudio.blend` se menciona en la documentación del proyecto; no se encontró dentro del árbol de archivos del proyecto revisado. Si lo tienes, puedes añadirlo como material opcional, pero acompáñalo de renders legibles: el prompt no presupone que Claude pueda abrir Blender.

## 3. Capturas concretas que conviene preparar

Inicia la demostración desde la carpeta del proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File .\iniciar_demo.ps1
```

Abre `http://127.0.0.1:5000` y `http://127.0.0.1:5000/experiencia`. Conserva visible el aviso de demostración. Usa zoom al 100 % y espera a que termine la carga.

Prepara estas cinco imágenes:

1. `01-portada-escritorio.png`: encabezado, titular y carcasa a unos 1440 px de ancho.
2. `02-diario-datos-escritorio.png`: diario, ritmo y gráficas; puedes separarla en dos imágenes para mantener la legibilidad.
3. `03-observatorio-escritorio.png`: paisaje, lectura seleccionada y controles.
4. `04-dashboard-movil.png`: portada y métricas a 390 px de ancho.
5. `05-observatorio-movil.png`: observatorio a 390 px de ancho.

Opcional: captura de `/acceso` y del estado sin datos.

Evita reducir una captura de página muy larga hasta que su texto sea ilegible. Es preferible dividirla por secciones. Para referencias artísticas, explica qué quieres tomar: por ejemplo, “me gusta la jerarquía tipográfica”, “la profundidad del paisaje” o “el uso del espacio”.

Estas capturas no se generaron en esta revisión; hay que adjuntarlas si quieres que Claude valore la apariencia renderizada de la versión actual.

## 4. Contenido del ZIP

Crea una copia limpia con una única carpeta raíz llamada `econodo-digital`, preservando sus rutas. Incluye:

```text
econodo-digital/
  app.py
  run_server.py
  config.json
  requirements.txt
  iniciar.ps1
  iniciar.sh
  iniciar_demo.ps1
  iniciar_demo.sh
  README.md
  CONTRATO_API.md
  INTEGRACION_FISICA.md
  REFERENCIA_CARCASA.md
  VERIFICACION.md
  THIRD_PARTY_NOTICES.md
  LICENSE
  templates/
  static/                 # Incluye Chart.js local, licencia y favicon.
  econodo/                # Solo código, sin cachés.
  firmware/EcoNodo/       # EcoNodo.ino y config.h de ejemplo.
  tools/
  tests/
```

Omite de la copia para compartir:
- `.venv/`, `__pycache__/`, archivos `.pyc` y cachés de herramientas.
- `.git/`, copias anteriores del proyecto, ZIP antiguos y carpetas temporales.
- `data/` y `demo_data/`: los datos de ejemplo se regeneran mediante los scripts.
- `config.local.json`, `firmware/EcoNodo/config.local.h`, `.env` y cualquier archivo que contenga claves o credenciales.
- Configuración personal del editor o del agente que no sea necesaria para ejecutar EcoNodo.

Conserva los originales en tu equipo. Estas exclusiones se aplican al paquete para compartir; no son instrucciones para borrar archivos del proyecto.

No es necesario incluir esta carpeta `entregables/claude/` en el ZIP si envías el prompt por separado.

## 5. Uso en Claude Pro y alternativas si el ZIP falla

Usa una conversación con capacidad de ejecución y creación de archivos. Si no está disponible, revisa Ajustes → Capacidades, donde puede aparecer como “Code execution and file creation” o “Create and edit files”. Fuente: [Create and edit files with Claude](https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude).

La lista general de formatos admitidos no garantiza el tratamiento de ZIP en todas las superficies. El prompt pide comprobar que el archivo realmente puede abrirse. Si tu interfaz rechaza el ZIP o Claude no puede leerlo:

- Extrae el proyecto localmente.
- Adjunta primero las plantillas, CSS y JavaScript propios, los documentos de contrato, `app.py` y `econodo/narrative.py`.
- Si necesitas usar TXT, conserva una copia original y encabeza cada archivo convertido con su ruta de origen.
- Entrega después los demás archivos que Claude identifique como necesarios.
- No pegues el código minificado de Chart.js en el chat: conserva el proveedor original para la entrega final.

No asumas que una vista previa dentro del chat ejecuta Flask o se conecta a tus sensores. Pide el proyecto integrado, sus archivos completos y el informe de verificación como establece el prompt.

## 6. Hallazgos que guiaron el encargo

La revisión se basó en código y documentación; no se realizó una inspección nueva en navegador.

- La arquitectura de sensores ya está implementada y el contrato debe preservarse.
- Hay una escena de carcasa, un diario determinista y un observatorio con defensas para datos extremos.
- Los estilos incorporan varias capas sucesivas de redefiniciones. El prompt pide consolidar los componentes intervenidos.
- Hay coordenadas geográficas fijas y una orientación decorativa sin respaldo en la configuración pública. El prompt pide corregir su significado visual.
- Algunas etiquetas decorativas usan 7–9 px; el rediseño debe separar ornamentación de información útil y priorizar legibilidad.
- Las mini curvas SVG de las tarjetas actuales son fijas; deben evitar aparentar un historial que no representan.
- El observatorio usa paneles con posiciones absolutas y cambios completos de `className`; el prompt pide comprobar solapamientos y persistencia de los nuevos estilos.
- La salida a estados vacíos y errores merece revisar también fecha, procedencia y etiquetas, además de las cifras.

Pruebas ejecutadas en esta revisión:
- `node tests/scene.test.cjs`: aprobada.
- `node tests/experience.test.cjs`: aprobada.
- `python -m unittest discover -s tests -p test_api.py -v`: 5 pruebas aprobadas usando el entorno virtual del proyecto.

No se modificó el código de la web, el firmware ni las bases de datos del proyecto para preparar este encargo. Las pruebas Python utilizan bases temporales. El prompt y esta guía son los entregables nuevos.

