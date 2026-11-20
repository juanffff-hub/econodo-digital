# Capturas de esta versión

Capturas reales de la página servida por Flask, tomadas con Microsoft Edge (Chromium) controlado por su API de depuración, sin recortes ni retoques. Todos los datos son de **demostración** (bases temporales; no se usó `data/` ni `demo_data/`). Los anchos se emularon con el tamaño de ventana CSS; no son capturas de un teléfono o tableta físicos.

| Archivo | Qué muestra |
| --- | --- |
| `home-escritorio-1440.jpg` | Portada completa a 1440 px. |
| `home-pantalla-corta-1366x768.png` | Primera vista en una pantalla baja: titular, carcasa y botón principal. |
| `home-zoom-200-por-ciento.png` | Primera vista en 720 px de ancho CSS, equivalente al zoom del 200 % en una ventana de 1440 px. |
| `home-tablet-768.jpg` | Portada completa a 768 px. |
| `home-movil-390.jpg` | Portada completa a 390 px. |
| `observatorio-escritorio-noche.png` | Observatorio a 1440 px, primera lectura del día (00:02). |
| `observatorio-escritorio-mediodia.png` | Observatorio a 1440 px, hacia el mediodía. |
| `observatorio-tablet-768.png` | Observatorio a 768 px, media mañana. |
| `observatorio-movil-390-mediodia.png` | Observatorio a 390 px, controles apilados. |
| `observatorio-vacio-escritorio-1440.png` | Observatorio sin lecturas: «Sin lectura», cifras en «—», paisaje neutro. |
| `acceso-escritorio-1440.png` · `acceso-movil-390.png` | Hoja de acceso con QR. |
| `estado-vacio-escritorio-1440.jpg` | Portada sin lecturas. |
| `estado-atrasado-escritorio-1440.png` | Portada con la última lectura de hace más de tres horas. |
| `estado-extremos-escritorio-1440.jpg` · `estado-extremos-movil-390.jpg` | Valores en los límites del contrato (−40 y 80 °C, 0 y 100 %, 65 535 lx), id de nodo largo y una pausa de 95 minutos que corta las líneas. |
| `estado-defectuoso-escritorio-1440.png` | Portada con una API que devuelve filas y cifras defectuosas: las cifras no válidas se muestran como «—». |

Los estados se generaron con servidores temporales de prueba; no están en el código del proyecto. `tools/vista_prueba.py` produce estados equivalentes (`vacio`, `atrasado`, `error`, `lento`, `reciente`).
