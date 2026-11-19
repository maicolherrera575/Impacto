import type { Category, Offer } from '../types';
import { haversineMeters } from './geo';
import type { LatLng } from './geo';

/**
 * ⚡ V36.0 · Motor Híbrido Determinista de Recomendación de Radar (<5ms, 0 tokens IA).
 *
 * Parsea la intención del mensaje del comprador (presupuesto en COP, urgencia/tiempo,
 * rubro/palabras clave y distancia voluntaria si activó GPS) contra las ofertas activas
 * ya cargadas en memoria para devolver tarjetas interactivas reales al instante.
 */

export type RadarConversationalIntent =
  | 'greeting'
  | 'what_is_this'
  | 'clarify_followup'
  | 'how_to_reserve'
  | 'is_free_payment'
  | 'cheaper_followup'
  | 'where_followup'
  | 'thanks'
  | 'account_question'
  | 'shopping'
  | 'support'
  | 'general';

export interface RadarMatchResult {
  intent: RadarConversationalIntent;
  isShoppingIntent: boolean;
  isSupportOrReport: boolean;
  parsedBudget: number | null;
  isUrgent: boolean;
  detectedCategory: Category | null;
  keywords: string[];
  matches: Array<{ offer: Offer; score: number; distanceMeters: number | null }>;
}

const CATEGORY_SYNONYMS: Record<Category, string[]> = {
  agro_mercado: [
    'abono', 'agro', 'campo', 'finca', 'fertilizante', 'semilla', 'concentrado',
    'ganado', 'agricola', 'vereda', 'siembra', 'cultivo', 'insumo', 'insumos',
    'npk', 'bulto', 'papa', 'cafe', 'huerta', 'herramienta', 'veterinaria',
  ],
  comida: [
    'comida', 'almuerzo', 'almuerzos', 'hambre', 'desayuno', 'cena', 'comer',
    'trucha', 'pollo', 'carne', 'asado', 'arepa', 'pan', 'pandebono', 'croissant',
    'chocolate', 'empanada', 'pizza', 'hamburguesa', 'restaurante', 'panaderia',
    'postre', 'torta', 'jugo', 'sopa', 'ejecutivo', 'corrientazo', 'menu', 'antojo',
  ],
  transporte_flete: [
    'flete', 'transporte', 'camion', 'camioneta', 'mudanza', 'carga', 'domicilio',
    'viaje', 'bogota', 'acarreo', 'encomienda', 'moto', 'taxi', 'expreso',
  ],
  hoteles_turismo: [
    'hotel', 'cabana', 'piscina', 'hospedaje', 'turismo', 'glamping', 'mirador',
    'balneario', 'descanso', 'alojamiento', 'finca de recreo', 'paseo',
  ],
  salud_belleza: [
    'salud', 'drogueria', 'farmacia', 'medicina', 'botiquin', 'medico', 'odontologia',
    'belleza', 'peluqueria', 'barberia', 'corte', 'unas', 'spa', 'masaje', 'estetica',
  ],
  hogar_construccion: [
    'ferreteria', 'herramienta', 'herramientas', 'martillo', 'cemento', 'obra',
    'construccion', 'pintura', 'hogar', 'mueble', 'electrico', 'plomero', 'reparacion',
  ],
  servicios_comercios: [
    'servicio', 'servicios', 'taller', 'tecnico', 'ropa', 'tienda', 'almacen',
    'regalo', 'celular', 'computador', 'mantenimiento', 'promo', 'promocion', 'oferta', 'ofertas',
  ],
};

const STOP_WORDS = new Set([
  'hola', 'buenas', 'buenos', 'dias', 'tardes', 'noches', 'por', 'favor', 'para',
  'con', 'sin', 'una', 'uno', 'unos', 'unas', 'que', 'quiero', 'busco', 'necesito',
  'algo', 'tengo', 'menos', 'hasta', 'como', 'donde', 'aqui', 'hay', 'tienen',
  'aparte', 'apartame', 'apartar', 'ensename', 'muestrame', 'ver', 'recomiendame',
  'pesos', 'cop', 'mil', 'del', 'las', 'los', 'este', 'esta', 'esto', 'hoy', 'ahora',
  'porfa', 'gracias', 'radar', 'impulso', 'deme', 'dame', 'ayuda',
]);

const SHOPPING_INTENT_RE =
  /busco|quiero|necesito|apart|compr|recomiend|mu[eé]str|ens[eé][nñ]|oferta|promo|barat|econ[oó]mic|presupuesto|tengo\s+\$?\d|menos\s+de|que\s+hay|qu[eé]\s+hay|donde\s+consigo|hambre|comer|almuerz|abono|agro|campo|flete|pan|trucha|ferreter|droguer|hotel|caba[nñ]|descuento|hoy/i;

const SUPPORT_REPORT_RE =
  /error|no\s+(funciona|carga|abre|sirve|deja|llega)|fall[ao]|bug|roto|congel|bloque|duplicad|cobr[oó]|descont[oó]|estafa|fraude|enga[nñ]|robo|reportar|soporte|contrase[nñ]a|huella|biometr|recarg|cr[eé]dito|nequi\s+oficial|gps\s+no/i;

const URGENCY_RE = /\bya\b|ahora|r[aá]pido|urgente|1\s*hora|una\s+hora|inmediato|pronto|cerca|ahorita|hoy\s+mismo/i;

/** Clasifica intención conversacional natural (incluyendo preguntas cortas de seguimiento). */
export function detectConversationalIntent(raw: string): RadarConversationalIntent {
  const norm = normalizeText(raw);
  if (!norm) return 'general';
  if (SUPPORT_REPORT_RE.test(raw)) return 'support';
  if (/^(hola+|buenas|buenos\s+dias|buenas\s+tardes|buenas\s+noches|hey|que\s+mas|quiubo|saludos)\b/.test(norm) && norm.length <= 28) {
    return 'greeting';
  }
  if (/^(gracias|muchas\s+gracias|mil\s+gracias|vale|listo|perfecto|genial|super|bacano|ok|dale)\b/.test(norm) && norm.length <= 36) {
    return 'thanks';
  }
  if (/que\s+es\s+(esto|impulso|radar|esta\s+app|esta\s+pagina)|para\s+que\s+sirve|como\s+funciona(\s+esto|\s+impulso)?|de\s+que\s+trata|quien\s+eres/.test(norm)) {
    return 'what_is_this';
  }
  if (/^(como\s+asi|no\s+entendi|explicame|expliqueme|que\s+quieres\s+decir|y\s+eso|a\s+ver|y\s+como|como\s+es\s+eso|me\s+explicas)\b/.test(norm)) {
    return 'clarify_followup';
  }
  if (/como\s+(aparto|apartar|reservo|reservar|compro|comprar|pido|pedir)|tengo\s+que\s+pagar\s+aqui|como\s+pago/.test(norm)) {
    return 'how_to_reserve';
  }
  if (/es\s+gratis|cobran|cuanto\s+cuesta\s+(usar|entrar|apartar)|piden\s+tarjeta|pago\s+en\s+linea/.test(norm)) {
    return 'is_free_payment';
  }
  if (/cuenta|registrar|perfil|comercio|soy\s+cliente|vender\s+aqui|publicar\s+mi\s+negocio/.test(norm)) {
    return 'account_question';
  }
  if (/mas\s+barat|algo\s+mas\s+econom|menos\s+plata|otra\s+opcion|otras\s+opciones|que\s+mas\s+hay/.test(norm)) {
    return 'cheaper_followup';
  }
  if (/donde\s+(queda|esta|quedan|estan|es|recojo)|direccion|ubicacion|en\s+el\s+mapa/.test(norm)) {
    return 'where_followup';
  }
  return 'general';
}

/** Resumen ultra-compacto de ofertas vivas en memoria para contextualizar a Radar (<5ms, 0 tokens extra). */
export function buildLiveOffersDigest(offers: Offer[]): {
  activeCount: number;
  cheapest: Offer | null;
  categoriesLabel: string;
} {
  const now = Date.now();
  const active = offers.filter(
    (o) => o.status === 'active' && o.available_quota > 0 && new Date(o.expires_at).getTime() > now,
  );
  if (active.length === 0) {
    return { activeCount: 0, cheapest: null, categoriesLabel: '' };
  }
  const sortedByPrice = [...active].sort((a, b) => Number(a.promo_price) - Number(b.promo_price));
  const catNames: Record<Category, string> = {
    comida: 'Comida',
    transporte_flete: 'Transporte/Flete',
    agro_mercado: 'Agro/Campo',
    hoteles_turismo: 'Hoteles/Turismo',
    salud_belleza: 'Salud/Belleza',
    hogar_construccion: 'Hogar/Ferretería',
    servicios_comercios: 'Servicios',
  };
  const uniqueCats = Array.from(new Set(active.map((o) => catNames[o.category] ?? o.category))).slice(0, 5);
  return {
    activeCount: active.length,
    cheapest: sortedByPrice[0] ?? null,
    categoriesLabel: uniqueCats.join(', '),
  };
}

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s.$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrae presupuestos colombianos: "20.000", "20 mil", "15k", "$25.000", "menos de 30000". */
export function extractBudgetCop(raw: string): number | null {
  const norm = normalizeText(raw);

  // "20 mil", "15.5 mil", "20k"
  const milMatch = /(?:\$\s*)?(\d{1,3}(?:[.,]\d)?)\s*(?:mil|k)\b/i.exec(norm);
  if (milMatch) {
    const val = Number(milMatch[1].replace(',', '.'));
    if (Number.isFinite(val) && val > 0 && val <= 999) {
      return Math.round(val * 1000);
    }
  }

  // "20.000", "20000", "$15.000"
  const exactMatch = /(?:\$\s*)?(\d{1,3}(?:\.\d{3})+|\d{4,7})\b/.exec(norm);
  if (exactMatch) {
    const digits = exactMatch[1].replace(/\./g, '');
    const val = Number(digits);
    if (Number.isFinite(val) && val >= 1000 && val <= 50_000_000) {
      return Math.round(val);
    }
  }

  return null;
}

export function matchLiveOffersForRadar(
  query: string,
  offers: Offer[],
  geoPos: LatLng | null = null,
  maxResults = 4,
): RadarMatchResult {
  const norm = normalizeText(query);
  const parsedBudget = extractBudgetCop(query);
  const isUrgent = URGENCY_RE.test(query);
  const isSupportOrReport = SUPPORT_REPORT_RE.test(query);
  const baseIntent = detectConversationalIntent(query);

  // Detectar categoría explícita o por sinónimos
  let detectedCategory: Category | null = null;
  let bestCatHits = 0;
  for (const [cat, words] of Object.entries(CATEGORY_SYNONYMS) as Array<[Category, string[]]>) {
    let hits = 0;
    for (const w of words) {
      if (norm.includes(w)) hits += 1;
    }
    if (hits > bestCatHits) {
      bestCatHits = hits;
      detectedCategory = cat;
    }
  }

  const keywords = norm
    .split(/\s+/)
    .map((w) => w.replace(/^\$+/, ''))
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  const isNonShoppingChat =
    baseIntent === 'greeting' ||
    baseIntent === 'what_is_this' ||
    baseIntent === 'clarify_followup' ||
    baseIntent === 'how_to_reserve' ||
    baseIntent === 'is_free_payment' ||
    baseIntent === 'thanks' ||
    baseIntent === 'account_question' ||
    baseIntent === 'where_followup';

  const isShoppingIntent =
    !isSupportOrReport &&
    !isNonShoppingChat &&
    (baseIntent === 'cheaper_followup' ||
      Boolean(detectedCategory) ||
      parsedBudget !== null ||
      SHOPPING_INTENT_RE.test(query));

  const intent: RadarConversationalIntent = isSupportOrReport
    ? 'support'
    : isShoppingIntent && baseIntent === 'general'
      ? 'shopping'
      : baseIntent;

  const now = Date.now();
  const activePool = offers.filter(
    (o) => o.status === 'active' && o.available_quota > 0 && new Date(o.expires_at).getTime() > now,
  );

  if (activePool.length === 0 || !isShoppingIntent) {
    return {
      intent,
      isShoppingIntent,
      isSupportOrReport,
      parsedBudget,
      isUrgent,
      detectedCategory,
      keywords,
      matches: [],
    };
  }

  const scored: Array<{ offer: Offer; score: number; distanceMeters: number | null }> = [];

  for (const offer of activePool) {
    const price = Number(offer.promo_price ?? 0);
    const titleNorm = normalizeText(offer.title);
    const descNorm = normalizeText(offer.description);
    const merchantNorm = normalizeText(offer.merchant?.business_name ?? '');
    const haystack = `${titleNorm} ${descNorm} ${merchantNorm} ${offer.category}`;

    // Si hay presupuesto estricto, descartar lo que supere el 110% del presupuesto
    if (parsedBudget !== null && price > parsedBudget * 1.1) {
      continue;
    }

    let score = 0;

    // Coincidencia directa de palabras clave
    let kwHits = 0;
    for (const kw of keywords) {
      if (titleNorm.includes(kw)) {
        score += 36;
        kwHits += 1;
      } else if (descNorm.includes(kw) || merchantNorm.includes(kw)) {
        score += 20;
        kwHits += 1;
      } else if (kw.length >= 4 && haystack.includes(kw.slice(0, -1))) {
        score += 12;
        kwHits += 1;
      }
    }

    // Coincidencia por categoría detectada
    if (detectedCategory && offer.category === detectedCategory) {
      score += 28;
    }

    // Coincidencia con sinónimos de categoría en el texto
    if (detectedCategory) {
      for (const syn of CATEGORY_SYNONYMS[detectedCategory]) {
        if (norm.includes(syn) && haystack.includes(syn)) {
          score += 18;
        }
      }
    }

    // Ajuste por presupuesto
    if (parsedBudget !== null) {
      if (price <= parsedBudget) {
        score += 22;
        // Más cercano o buen ahorro dentro del presupuesto
        const savings = offer.original_price && Number(offer.original_price) > price
          ? (Number(offer.original_price) - price) / Number(offer.original_price)
          : 0;
        score += Math.round(savings * 15);
      } else {
        score += 5;
      }
    }

    // Si pide genérico ("qué ofertas hay hoy", "algo barato"), todas las vigentes califican
    const isGenericBrowse = keywords.length === 0 || /oferta|promo|barat|econom|hoy|que hay|recomiend/i.test(norm);
    if (score === 0 && !isGenericBrowse) continue;
    if (score === 0 && isGenericBrowse) score = 10;

    // Urgencia: prioriza menor tiempo restante / entrega rápida / mayor cercanía
    const hoursLeft = Math.max(0.1, (new Date(offer.expires_at).getTime() - now) / 3_600_000);
    if (isUrgent) {
      if (hoursLeft <= 4) score += 14;
      if (offer.delivery_type === 'domicilio') score += 8;
    }

    // Distancia voluntaria (Ley 1581: solo si el usuario activó GPS en su pantalla)
    const distanceMeters =
      geoPos && offer.lat != null && offer.lng != null
        ? haversineMeters(geoPos, { lat: offer.lat, lng: offer.lng })
        : null;
    if (distanceMeters != null) {
      if (distanceMeters <= 400) score += 14;
      else if (distanceMeters <= 1200) score += 8;
    }

    // Confianza y verificación del comercio
    if (offer.merchant?.is_verified) score += 6;
    if (kwHits > 0 && detectedCategory && offer.category === detectedCategory) score += 10;

    scored.push({ offer, score, distanceMeters });
  }

  scored.sort((a, b) => b.score - a.score || Number(a.offer.promo_price) - Number(b.offer.promo_price));

  return {
    intent,
    isShoppingIntent,
    isSupportOrReport,
    parsedBudget,
    isUrgent,
    detectedCategory,
    keywords,
    matches: scored.slice(0, maxResults),
  };
}
