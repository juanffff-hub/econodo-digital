# Correspondencia con `EcoNodo_estudio.blend`

La representación del hero se construye con HTML/CSS y se inspira en la geometría del archivo de Blender entregado con el Avance 2. El navegador **no carga el `.blend`** ni necesita Blender para mostrarla.

| Elemento del `.blend` | Evidencia del diseño | Traducción web |
| --- | --- | --- |
| `B09-cuerpo`, `B09-tapa`, `B09-empaque` | Volumen blanco vertical, tapa frontal y junta; envolvente total ≈ 110 mm ancho × 70 mm fondo × 150 mm alto | Caras frontal, lateral, superior e inferior con CSS 3D y proporción 214:70:290 |
| `B09-tornillos` | Cuatro fijaciones oscuras en las esquinas de la tapa | Cuatro cabezas visibles en el frente |
| `B10-ventana`, `B03-gy30-*` | Ventana superior de aproximadamente 42 × 28 mm; BH1750 justo debajo | Superficie óptica gris en la cara superior y hotspot BH1750 |
| `B02-dht22-*`, `B10-malla`, `B10-division` | DHT22 ubicado abajo, separado de la electrónica y asociado con la ventilación protegida | Ranuras laterales inferiores y hotspot DHT22; explicación de su posición interna |
| `B01-esp32-*`, `B05-protoboard` | ESP32 montado dentro de la caja | Hotspot sobre la tapa que señala una pieza interna, sin simular una placa exterior |
| `B08-led-*` | LED verde en la parte alta del frente | Punto luminoso frontal y hotspot de estado |
| `Etiqueta logo`, `Etiqueta QR` | Marca EcoNodo al centro; QR y etiqueta “Consultar” abajo | Logo local y miniatura del QR servido por `/acceso/qr.svg`. La etiqueta visible dice **«Acceso»** (no «Consultar»): con 12 px, el mínimo de texto del sistema visual, «Consultar» no cabe en el ancho del QR. Es un cambio de rotulado de la ilustración, no del diseño físico. |
| `B10-pg7`, `B07-usb-*` | Paso de alimentación USB por la base | Cara inferior con prensaestopa y señal “Paso USB / PG7” |

La captura de referencia también muestra en el lateral derecho una perforación circular superior y cuatro aberturas horizontales inferiores. Ambas aparecen en la escena web. El servidor se representa fuera de la caja porque en el proyecto corresponde al portátil reutilizado, no a un componente interno.

## Punto por resolver: ventilación del DHT22

El texto extraído del PDF del Avance 2 describe el DHT22 con una «abertura inferior ventilada», mientras que la escena web (siguiendo la captura de referencia) dibuja **ranuras laterales inferiores**. Las figuras del PDF y el archivo `.blend` no se abrieron en esta revisión, por lo que no se sabe cuál de las dos describe la pieza real. Confirma la ubicación de la abertura contra el modelo antes de fabricar o perforar la carcasa; la ilustración web debe ajustarse a esa decisión.

## Límite visual de esta versión

El objetivo es explicar la distribución y función del diseño, no reproducir la malla tridimensional ni los materiales exactos. Las curvas del ABS, el espesor de la junta, las piezas internas, tornillos, cables y tolerancias están simplificados. La posición de cada hotspot es didáctica; no equivale a un plano de perforación ni valida ventilación, temperatura, óptica o impermeabilidad reales. La rotación se limita para conservar el aspecto de la vista oblicua original y el rendimiento en móviles.
