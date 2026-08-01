-- ============================================================================
-- Gyro Store v2 · Migración 0016 · Plantillas heredadas de v1
-- ============================================================================
-- Trae las plantillas que en v1 vivían como scripts de seed
-- (Gyro_Store_Web_Page_Version2/scripts/seedTemplate*.js). Se portan desde el
-- CÓDIGO, no desde Firestore: los scripts son la fuente de verdad de estos
-- moldes y así la migración es reproducible sin credenciales de producción.
--
-- ALCANCE: son las 5 plantillas que existían como script. Si en v1 se crearon
-- más desde el panel, esas solo viven en Firestore y hay que exportarlas aparte.
--
-- Idempotente: cada insert se salta si ya hay una plantilla con ese nombre, así
-- que re-correr la migración no duplica moldes.
-- ============================================================================

-- ── Categorías que v1 usaba y v2 todavía no tenía ──
-- Los moldes se enganchan a `categories` por slug, que es el mismo id que usaba
-- v1 en su `config.categories`.
insert into categories (name, slug) values
  ('Adaptadores Bluetooth', 'adaptador-bt'),
  ('Accesorios Gaming',     'accesorios-gaming')
on conflict (slug) do nothing;

-- ── Plantillas ──
-- `axes` es un array ORDENADO: ese orden define cómo se arma el nombre de cada
-- combinación ("Tipo C / Con micrófono"), que es la llave de `variant_mappings`.
insert into templates (name, description, category_id, axes, specs)
select
  v.name,
  v.description,
  (select id from categories where slug = v.category_slug),
  v.axes::jsonb,
  v.specs::jsonb
from (values
  (
    'KZ EDX Pro X',
    E'🎧 Descubre el sonido en su máxima expresión con los KZ EDX Pro X\n\nLos audífonos in-ear KZ EDX Pro X representan la evolución en monitoreo de audio. Diseñados tanto para amantes de la música como para músicos exigentes, ofrecen bajos profundos, medios claros y agudos cristalinos, garantizando una resolución de sonido de alta fidelidad (Hi-Fi).\n\n✨ Características Destacadas:\n• Ergonomía superior: Su diseño translúcido no solo es visualmente impresionante, sino que se adapta perfectamente al contorno de la oreja para brindar comodidad durante largas sesiones y un excelente aislamiento de ruido pasivo.\n• Cable desmontable: Incluyen un cable de cobre libre de oxígeno (OFC) que evita enredos y mejora la transmisión de la señal. Además, sus pines te permiten usar módulos Bluetooth en el futuro.\n• Fáciles de usar: Gracias a su baja impedancia, suenan increíble conectados directamente a tu celular o computadora sin necesidad de amplificadores extras.',
    'audifonos-kz',
    '[{"key":"conector","label":"Conexión","options":["Tipo C","Jack 3.5mm"],"isColor":false},
      {"key":"microfono","label":"Micrófono","options":["Con micrófono","Sin micrófono"],"isColor":false},
      {"key":"color","label":"Color","options":["Negro","Transparente","Turquesa","Gris"],"isColor":true}]',
    '[{"label":"Impedancia","value":"24 Ω"},
      {"label":"Sensibilidad","value":"112 dB"},
      {"label":"Respuesta de frecuencia","value":"20 Hz – 40 kHz"},
      {"label":"Conector","value":"A elección (Tipo C o Jack 3.5mm)"}]'
  ),
  (
    'KZ EDX Ultra',
    E'🎵 La evolución de un clásico con rendimiento superior\n\nLos KZ EDX Ultra son la versión mejorada de la famosa serie EDX, optimizados con un nuevo controlador dinámico dual-magnético de 10 mm. Este rediseño mejora significativamente la respuesta de frecuencia, brindando bajos más profundos, medios claros y agudos suaves.\n\n✨ Características Destacadas:\n• Diseño ergonómico superior: Su carcasa de resina ha sido moldeada para ajustarse perfectamente al oído, combinando estética moderna con comodidad extrema y aislamiento pasivo de ruido.\n• Cable premium: Incluye un cable de cobre de alta pureza chapado en plata (con conectores de 2 pines de 0.75 mm), diseñado para minimizar la pérdida de señal y evitar enredos.\n• Sonido todoterreno: Ideales tanto para escuchar música casual como para sesiones largas de gaming, gracias a su excelente separación de instrumentos y claridad vocal.',
    'audifonos-kz',
    '[{"key":"conector","label":"Conexión","options":["Tipo C","Jack 3.5mm"],"isColor":false},
      {"key":"microfono","label":"Micrófono","options":["Con micrófono","Sin micrófono"],"isColor":false}]',
    '[{"label":"Controlador","value":"Dinámico Magnético Dual (10mm)"},
      {"label":"Impedancia","value":"26 Ω"},
      {"label":"Sensibilidad","value":"112 dB"},
      {"label":"Respuesta de frecuencia","value":"20 Hz – 40 kHz"},
      {"label":"Conector","value":"A elección (Tipo C o Jack 3.5mm)"}]'
  ),
  (
    'KZ Castor',
    E'🎛️ Doble driver dinámico y sonido personalizable de otro nivel\n\nLos audífonos in-ear KZ Castor representan una verdadera revolución gracias a su innovador diseño acústico de doble driver dinámico apilado. Un driver se encarga de entregar graves potentes y profundos, mientras que el otro se especializa en ofrecer frecuencias medias y altas con una claridad cristalina.\n\n✨ Características Destacadas:\n• Versiones Harman o Bass Enhanced para adaptarse a tu estilo musical.\n• Interruptores de ajuste (Switches): Cada auricular incorpora pequeños interruptores integrados que te permiten modificar y personalizar las frecuencias bajas y altas según tus gustos musicales.\n• Diseño premium: Su carcasa ergonómica combina resina de alta calidad con un panel frontal metálico brillante, asegurando comodidad, aislamiento y un estilo inigualable.\n• Cable profesional: Cable de cobre libre de oxígeno con conectores de 2 pines (0.75mm), totalmente desmontable y resistente a enredos.',
    'audifonos-kz',
    '[{"key":"version","label":"Versión","options":["Harman","Bass Enhanced"],"isColor":true},
      {"key":"conector","label":"Conexión","options":["Tipo C","Jack 3.5mm"],"isColor":false},
      {"key":"microfono","label":"Micrófono","options":["Con micrófono","Sin micrófono"],"isColor":false}]',
    '[{"label":"Controladores","value":"Doble Driver Dinámico"},
      {"label":"Impedancia","value":"31 - 35 Ω (Harman) / 16 - 20 Ω (Bass)"},
      {"label":"Sensibilidad","value":"103 - 105 dB"},
      {"label":"Respuesta de frecuencia","value":"20 Hz – 40 kHz"},
      {"label":"Filtros acústicos","value":"Switches integrados ajustables"},
      {"label":"Conector","value":"A elección (Tipo C o Jack 3.5mm)"}]'
  ),
  (
    'KZ AZ09',
    E'📶 Convierte tus audífonos KZ en una experiencia 100% inalámbrica\n\nEl módulo Bluetooth KZ AZ09 transforma tus audífonos KZ con cable en verdaderos auriculares inalámbricos. Diseñado para ofrecer máxima libertad sin sacrificar la calidad del sonido, este adaptador es el complemento perfecto para tus audífonos favoritos.\n\n✨ Características Destacadas:\n• Conexión ultrarrápida: Equipado con Bluetooth 5.2, ofrece una conexión más estable, mayor rango de alcance y menor consumo de energía.\n• Baja latencia: Ideal para disfrutar de tus videojuegos y videos favoritos sin molestos retrasos entre la imagen y el audio.\n• Estuche de gran capacidad: El estuche de carga incluido cuenta con una batería de 800 mAh, asegurando múltiples recargas para horas de reproducción continua.\n• Ganchos ergonómicos: Su diseño sobre la oreja se ajusta de manera segura y cómoda, ideal para hacer deporte o moverte sin preocupaciones.',
    'adaptador-bt',
    '[{"key":"tipo-pin","label":"Tipo de Pin","options":["Pin C","Pin B"],"isColor":false}]',
    '[{"label":"Versión Bluetooth","value":"5.2"},
      {"label":"Alcance inalámbrico","value":"Hasta 15 metros"},
      {"label":"Batería del módulo","value":"50 mAh (cada uno)"},
      {"label":"Batería del estuche","value":"800 mAh"},
      {"label":"Tiempo de reproducción","value":"Aprox. 6 horas por carga"}]'
  ),
  (
    'Attack Shark X11',
    E'🖱️ Mouse inalámbrico ultraligero con dock de carga magnética\n\nEl Attack Shark X11 redefine el gaming con su sensor PixArt PAW3311 de alta precisión y un peso ultraligero de tan solo 63g. Diseñado para ofrecer la máxima comodidad y rendimiento, cuenta con conexión de tres modos (Tri-mode) y una base de carga magnética con iluminación RGB para mantener siempre tu setup impecable.\n\n✨ Características Destacadas:\n• Conectividad Tri-mode: Juega sin límites gracias a su soporte para conexión Inalámbrica 2.4GHz, Bluetooth 5.2 y cable USB Tipo-C.\n• Precisión Extrema: Equipado con el sensor PixArt PAW3311, alcanza hasta 22,000 DPI para un rastreo perfecto.\n• Dock de Carga Magnética: Olvídate de los cables. Incluye una base de carga magnética RGB súper conveniente.\n• Diseño Ultraligero: Con solo 63g de peso, su diseño ambidiestro permite movimientos rápidos y reduce la fatiga tras largas horas de uso.',
    'accesorios-gaming',
    '[{"key":"color","label":"Color","options":["Blanco","Negro","Rojo"],"isColor":true}]',
    '[{"label":"Sensor","value":"PixArt PAW3311"},
      {"label":"DPI","value":"Hasta 22,000 DPI"},
      {"label":"Tasa de sondeo (Polling Rate)","value":"1000 Hz"},
      {"label":"Conectividad","value":"2.4Ghz Inalámbrico / Bluetooth 5.2 / Cable Tipo-C"},
      {"label":"Peso","value":"63g (±3g)"},
      {"label":"Switches","value":"Mecánicos Huano"},
      {"label":"Batería","value":"Aprox. 65 horas"}]'
  )
) as v(name, description, category_slug, axes, specs)
where not exists (select 1 from templates t where t.name = v.name);

-- ============================================================================
-- Cierre de archivo de migración 0016_seed_templates_v1.sql
-- ============================================================================
