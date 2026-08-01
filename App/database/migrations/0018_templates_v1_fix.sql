-- ============================================================================
-- Gyro Store v2 · Migración 0018 · Corrección de las plantillas de v1
-- ============================================================================
-- `0016_seed_templates_v1.sql` se armó leyendo `scripts/seedTemplate*.js` del
-- WORKING TREE de v1, que está 28 commits atrás de `origin/main`. Resultado:
-- quedaron 5 plantillas viejas en lugar de las 8 reales, y una de ellas con un
-- modelo que v1 ya había abandonado.
--
-- Qué cambió en v1 y 0016 no refleja:
--   · «KZ Castor» tenía un eje `version` con opciones Harman / Bass Enhanced.
--     Eso se ELIMINÓ: ahora son tres plantillas separadas (Harman, Bass
--     Enhanced, Pro Bass), porque cada una tiene impedancia y sensibilidad
--     distintas — datos que un eje de variante no puede expresar.
--   · Faltan KZ AZ10, KZ Castor Bass Enhanced y KZ Castor Pro Bass.
--
-- Esta migración corrige en vez de editar 0016: esa ya pudo haberse aplicado, y
-- reescribir una migración aplicada deja las bases desincronizadas.
--
-- Idempotente y segura de re-correr: cada insert se salta si el nombre ya
-- existe, y la corrección de Castor solo actúa si todavía tiene el nombre viejo.
-- ============================================================================

-- ── 1. Corregir «KZ Castor» → «KZ Castor Harman» ──
-- Se le quita el eje `version` y se le fijan las specs de la variante Harman.
--
-- OJO: si algún producto ya mapeó variantes usando ese eje (ej. "Harman / Tipo
-- C / Con micrófono"), esas combinaciones quedan huérfanas. No se pierden: la
-- tabla de mapeo del editor las muestra marcadas como «ya no existe entre las
-- opciones activas» para poder rehacerlas a mano. Es visible, no silencioso.
update templates
   set name = 'KZ Castor Harman',
       description = E'🎛️ Doble driver dinámico y sonido personalizable de otro nivel\n\nLos audífonos in-ear KZ Castor representan una verdadera revolución gracias a su innovador diseño acústico de doble driver dinámico apilado. Un driver se encarga de entregar graves potentes y profundos, mientras que el otro se especializa en ofrecer frecuencias medias y altas con una claridad cristalina.\n\n✨ Características Destacadas:\n• Interruptores de ajuste (Switches): Cada auricular incorpora pequeños interruptores integrados que te permiten modificar y personalizar las frecuencias bajas y altas según tus gustos musicales.\n• Diseño premium: Su carcasa ergonómica combina resina de alta calidad con un panel frontal metálico brillante, asegurando comodidad, aislamiento y un estilo inigualable.\n• Cable profesional: Cable de cobre libre de oxígeno con conectores de 2 pines (0.75mm), totalmente desmontable y resistente a enredos.\n\nExperimenta el control total sobre tu música con los KZ Castor Harman, la fusión perfecta entre afinación profesional y tecnología acústica avanzada.',
       axes = '[{"key":"conector","label":"Conexión","options":["Tipo C","Jack 3.5mm"],"isColor":false},
                {"key":"microfono","label":"Micrófono","options":["Con micrófono","Sin micrófono"],"isColor":false}]'::jsonb,
       specs = '[{"label":"Controladores","value":"Doble Driver Dinámico"},
                 {"label":"Impedancia","value":"31 - 35 Ω"},
                 {"label":"Sensibilidad","value":"105 dB"},
                 {"label":"Respuesta de frecuencia","value":"20 Hz – 40 kHz"},
                 {"label":"Filtros acústicos","value":"Switches integrados ajustables"},
                 {"label":"Conector","value":"A elección (Tipo C o Jack 3.5mm)"}]'::jsonb
 where name = 'KZ Castor';

-- ── 2. Las tres plantillas que faltaban ──
insert into templates (name, description, category_id, axes, specs)
select
  v.name,
  v.description,
  (select id from categories where slug = v.category_slug),
  v.axes::jsonb,
  v.specs::jsonb
from (values
  (
    'KZ AZ10',
    E'📶 Tu experiencia in-ear, ahora totalmente inalámbrica y sin límites\n\nEl módulo Bluetooth KZ AZ10 da un salto a la nueva generación del audio inalámbrico. Diseñado para ofrecer máxima libertad sin sacrificar la calidad de tu música, este adaptador de nivel profesional convierte tus audífonos KZ con cable en verdaderos auriculares TWS.\n\n✨ Características Destacadas:\n• Tres modos de rendimiento: Disfruta de la versatilidad de sus modos de Sonido Espacial, Modo Gaming de baja latencia y Modo Estándar para música.\n• Conexión ultrarrápida y estable: Equipado con Bluetooth 5.2, ofrece un rango de alcance impecable y un emparejamiento automático al sacarlos del estuche.\n• Estuche de gran capacidad: El estuche de carga inteligente cuenta con una batería de 800 mAh, asegurando hasta 54 horas de reproducción total (aproximadamente 6 horas de batería en los ganchos).\n• Diseño ergonómico deportivo: Su diseño sobre la oreja se ajusta de manera segura y cómoda. Ideal para entrenamientos intensos gracias a su resistencia a salpicaduras y sudor.\n\nExperimenta el audio Hi-Fi sin las ataduras de los cables y lleva tu sonido KZ al siguiente nivel.',
    'adaptador-bt',
    '[{"key":"tipo-pin","label":"Tipo de Pin","options":["Pin C","Pin B"],"isColor":false}]',
    '[{"label":"Versión Bluetooth","value":"5.2"},
      {"label":"Alcance inalámbrico","value":"Hasta 15 metros"},
      {"label":"Batería del módulo","value":"50 mAh (cada uno)"},
      {"label":"Batería del estuche","value":"800 mAh"},
      {"label":"Tiempo de reproducción","value":"6 horas (hasta 54 horas con estuche)"},
      {"label":"Modos especiales","value":"Gaming / Espacial / Estándar"}]'
  ),
  (
    'KZ Castor Bass Enhanced',
    E'🎛️ Doble driver dinámico y sonido personalizable de otro nivel\n\nLos audífonos in-ear KZ Castor representan una verdadera revolución gracias a su innovador diseño acústico de doble driver dinámico apilado. Un driver se encarga de entregar graves potentes y profundos, mientras que el otro se especializa en ofrecer frecuencias medias y altas con una claridad cristalina.\n\n✨ Características Destacadas:\n• Improved Bass Edition: Ajustada específicamente para los amantes de los bajos extra profundos y potentes sin perder claridad.\n• Interruptores de ajuste (Switches): Cada auricular incorpora pequeños interruptores integrados que te permiten modificar y personalizar las frecuencias bajas y altas según tus gustos musicales.\n• Diseño premium: Su carcasa ergonómica combina resina de alta calidad con un panel frontal metálico brillante, asegurando comodidad, aislamiento y un estilo inigualable.\n• Cable profesional: Cable de cobre libre de oxígeno con conectores de 2 pines (0.75mm), totalmente desmontable y resistente a enredos.\n\nExperimenta el control total sobre tu música con los KZ Castor Bass Enhanced, la fusión perfecta entre afinación profesional y tecnología acústica avanzada.',
    'audifonos-kz',
    '[{"key":"conector","label":"Conexión","options":["Tipo C","Jack 3.5mm"],"isColor":false},
      {"key":"microfono","label":"Micrófono","options":["Con micrófono","Sin micrófono"],"isColor":false}]',
    '[{"label":"Controladores","value":"Doble Driver Dinámico"},
      {"label":"Impedancia","value":"16 - 20 Ω"},
      {"label":"Sensibilidad","value":"103 dB"},
      {"label":"Respuesta de frecuencia","value":"20 Hz – 40 kHz"},
      {"label":"Filtros acústicos","value":"Switches integrados ajustables"},
      {"label":"Conector","value":"A elección (Tipo C o Jack 3.5mm)"}]'
  ),
  (
    'KZ Castor Pro Bass',
    E'🎛️ Doble driver dinámico y sonido personalizable de otro nivel\n\nLos audífonos in-ear KZ Castor Pro Bass representan una verdadera revolución gracias a su innovador diseño acústico de doble driver dinámico apilado. Un driver se encarga de entregar graves potentes y profundos, mientras que el otro se especializa en ofrecer frecuencias medias y altas con una claridad cristalina.\n\n✨ Características Destacadas:\n• Pro Bass Edition: Ajustada específicamente para los amantes de los bajos extra profundos y potentes sin perder claridad ni detalle en el resto de las frecuencias.\n• Interruptores de ajuste (Switches): Cada auricular incorpora pequeños interruptores integrados que te permiten modificar y personalizar las frecuencias bajas y altas según tus gustos musicales.\n• Diseño premium: Su carcasa ergonómica combina resina de alta calidad con un panel frontal metálico brillante, asegurando comodidad, aislamiento y un estilo inigualable.\n• Cable profesional: Cable de cobre libre de oxígeno con conectores de 2 pines (0.75mm), totalmente desmontable y resistente a enredos.\n\nExperimenta el control total sobre tu música con los KZ Castor Pro Bass, la fusión perfecta entre afinación profesional y tecnología acústica avanzada.',
    'audifonos-kz',
    '[{"key":"conector","label":"Conexión","options":["Tipo C","Jack 3.5mm"],"isColor":false},
      {"key":"microfono","label":"Micrófono","options":["Con micrófono","Sin micrófono"],"isColor":false}]',
    '[{"label":"Controladores","value":"Doble Driver Dinámico"},
      {"label":"Impedancia","value":"16 - 20 Ω"},
      {"label":"Sensibilidad","value":"103 dB"},
      {"label":"Respuesta de frecuencia","value":"20 Hz – 40 kHz"},
      {"label":"Filtros acústicos","value":"Switches integrados ajustables"},
      {"label":"Conector","value":"A elección (Tipo C o Jack 3.5mm)"}]'
  )
) as v(name, description, category_slug, axes, specs)
where not exists (select 1 from templates t where t.name = v.name);

-- ============================================================================
-- Cierre de archivo de migración 0018_templates_v1_fix.sql
-- ============================================================================
