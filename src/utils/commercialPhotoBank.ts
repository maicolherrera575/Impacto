/**
 * 📸 Banco Fotográfico Comercial HD V11 (más de 120 fotografías profesionales
 * reales de Unsplash en alta resolución) clasificadas en 20 categorías.
 *
 * V11.0: Pollinations.ai está saturado y devuelve un banner de bloqueo
 * ("🐝 pollinations.ai — At its limit right now") que el sistema viejo
 * estampaba en el afiche. Este banco reemplaza esas llamadas: el sistema
 * analiza las palabras del Brief, elige la categoría EXACTA y carga una foto
 * HD nueva y diferente en cada clic (convertida a dataURL vía fetch +
 * FileReader para que el PNG exportado NUNCA tenga problemas de CORS).
 */

export type PhotoCategory =
  | 'marketing_digital'
  | 'software_tech'
  | 'restaurante_almuerzo'
  | 'asadero_parrilla'
  | 'hamburguesa_rapida'
  | 'panaderia_cafe'
  | 'odontologia_salud'
  | 'drogueria_medicina'
  | 'belleza_spa'
  | 'barberia'
  | 'turismo_cabanas_piscinas'
  | 'agro_ganaderia'
  | 'veterinaria_mascotas'
  | 'ferreteria_construccion'
  | 'transporte_camioneta'
  | 'moda_ropa'
  | 'gimnasio_fitness'
  | 'educacion_cursos'
  | 'inmobiliaria_hogar'
  | 'eventos_fiestas'
  | 'servicios_profesionales';

const unsplash = (id: string): string =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1080&q=85`;

/** Categoría por defecto cuando el brief no coincide con ningún giro. */
const DEFAULT_CATEGORY: PhotoCategory = 'servicios_profesionales';

/** Palabras clave del brief → categoría exacta del banco (20 categorías). */
const CATEGORY_MATCHERS: Array<{ cat: PhotoCategory; re: RegExp }> = [
  { cat: 'marketing_digital', re: /marketing|publicidad|redes|agencia|social media|anuncio|branding|seo|emprendimien|ventas online|community/ },
  { cat: 'software_tech', re: /web|p[aá]gina|computador|software|tecnolog|datos|sistema|celular|m[oó]vil|app|reparaci[oó]n de equipos|servicio t[eé]cnico|programa/ },
  { cat: 'odontologia_salud', re: /odont|diente|dental|brackets|blanqueamien/ },
  { cat: 'drogueria_medicina', re: /droguer|farmacia|medicament|vacuna|laboratorio|salud|doctor|m[eé]dico|cl[ií]nica|enfermer/ },
  { cat: 'belleza_spa', re: /belleza|peluquer|spa|est[eé]tica|u[nñ]as|masaje|cosm[eé]tic|maquillaje|sal[oó]n/ },
  { cat: 'barberia', re: /barber|barbero|corte de cabello|cortes|barba/ },
  { cat: 'asadero_parrilla', re: /asado|asadero|parrilla|carne|pollo|chuzo|costilla|brasa|le[nñ]a/ },
  { cat: 'hamburguesa_rapida', re: /hamburguesa|comida r[aá]pida|perro caliente|pizza|salchipapa| snacks/ },
  { cat: 'panaderia_cafe', re: /panader|pan\b|pastel|postre|dulce|reposter|torta|bolo|caf[eé]|bebida|jugo|malteada|desayun/ },
  { cat: 'restaurante_almuerzo', re: /restaurante|almuerzo|men[uú]|comida|gastronom|corrientazo|saz[oó]n|fiesta (de|en) plato/ },
  // V13: el matcher de turismo va ANTES que el de agro (que ya captura "finca").
  { cat: 'turismo_cabanas_piscinas', re: /caba[nñ]|piscina|balneario|glamping|turismo|tur[íi]stic|hospedaje|alojamiento|hotel|hostal|mirador|paseo|finca de recreo|descanso|pozo|trucha\s*de|campestre/ },
  { cat: 'agro_ganaderia', re: /agro|ganado|vaca|finca|cultivo|semilla|concentrado|abono|campa|trucha|campo|siembra|fertilizante/ },
  { cat: 'veterinaria_mascotas', re: /veterinar|perro|mascota|gato|canino|felino/ },
  { cat: 'ferreteria_construccion', re: /construcci[oó]n|obra|ferreter|alba[nñ]il|electricis|plomero|materiales|herramienta|remodela|pintura|hogar/ },
  { cat: 'transporte_camioneta', re: /transporte|flete|camion|domicilio|despacho|log[ií]stica|camioneta|carga|mudanza|expreso|moto|taxi/ },
  { cat: 'moda_ropa', re: /ropa|moda|boutique|tienda|almac[eé]n|supermercado|comercio|calzado|regalo|vestido/ },
  { cat: 'gimnasio_fitness', re: /gimnasio|fitness|gym|entrenamien|ejercicio|crossfit|musculaci[oó]n/ },
  { cat: 'educacion_cursos', re: /curso|clase|educaci[oó]n|escuela|academia|refuerzo|ingl[eé]s|tutor[ií]a|capacitaci[oó]n/ },
  { cat: 'inmobiliaria_hogar', re: /inmobiliar|arriendo|venta de casa|apartament|lote|mueble|decoraci[oó]n/ },
  { cat: 'eventos_fiestas', re: /evento|fiesta|cumplea[nñ]os|quince|boda|decoraci[oó]n de eventos|sal[oó]n de eventos|catering/ },
  { cat: 'servicios_profesionales', re: /abogad|jur[ií]dic|notar[ií]|contab|contador|impuesto|asesor|consultor|profesional|arquitecto|gestor[ií]a|tr[aá]mite/ },
];

/** El banco: 20 categorías × 6+ fotografías reales verificadas = 120+. */
export const PHOTO_BANK: Record<PhotoCategory, string[]> = {
  marketing_digital: [
    unsplash('photo-1460925895917-afdab627c93f'),
    unsplash('photo-1551288049-bebda4e38f71'),
    unsplash('photo-1518770660439-4636190af55'),
    unsplash('photo-1531297484001-80022131f5a1'),
    unsplash('photo-1519389950473-47ba0277781c'),
    unsplash('photo-1553877522-43269d52ea94'),
    unsplash('photo-1504639725590-34d2148a1888'),
  ],
  software_tech: [
    unsplash('photo-1498050108023-c5249f4df085'),
    unsplash('photo-1461749280684-dccba630e2f6'),
    unsplash('photo-1550745165-9bc0b252726f'),
    unsplash('photo-1526374965328-7f61d4dc18c5'),
    unsplash('photo-1517077304055-6e89abbf09b0'),
    unsplash('photo-1512499617640-c74ae3a79d37'),
    unsplash('photo-1511707171634-5f897ff02aa9'),
  ],
  restaurante_almuerzo: [
    unsplash('photo-1568901346375-23c9450c5869'),
    unsplash('photo-1600891964092-4316c288032e'),
    unsplash('photo-1514933651103-005eec06c04b'),
    unsplash('photo-1504674900247-0877df9cc836'),
    unsplash('photo-1414235077428-338989a2e8c0'),
    unsplash('photo-1559339352-11d035aa65de'),
    unsplash('photo-1552566626-52f8b828add9'),
  ],
  asadero_parrilla: [
    unsplash('photo-1544025162-d76694265947'),
    unsplash('photo-1555939594-58d7cb561ad1'),
    unsplash('photo-1558030006-450675393462'),
    unsplash('photo-1529193591184-b1d58069ecdd'),
    unsplash('photo-1603360946369-dc9bb6258143'),
    unsplash('photo-1594041680534-e8c8cdebd659'),
  ],
  hamburguesa_rapida: [
    unsplash('photo-1565299624946-b28f40a0ae38'),
    unsplash('photo-1571091718767-18b5b1457add'),
    unsplash('photo-1550547660-d9450f859349'),
    unsplash('photo-1551782450-a2132b4ba21d'),
    unsplash('photo-1586190848861-99aa4a171e90'),
    unsplash('photo-1568901346375-23c9450c5869'),
  ],
  panaderia_cafe: [
    unsplash('photo-1509440159596-0249088772ff'),
    unsplash('photo-1565958011703-44f9829ba187'),
    unsplash('photo-1551024506-0bccd828d307'),
    unsplash('photo-1509042239860-f550ce710b93'),
    unsplash('photo-1495474472287-4d71bcdd2085'),
    unsplash('photo-1447933601403-0c6688de566e'),
    unsplash('photo-1511920170033-f8396924c348'),
  ],
  odontologia_salud: [
    unsplash('photo-1606811841689-23dfddce3e95'),
    unsplash('photo-1588776814546-1ffcf47267a5'),
    unsplash('photo-1576091160399-112ba8d25d1d'),
    unsplash('photo-1631217868264-e5b90bb88267'),
    unsplash('photo-1629909613654-28e377c37b09'),
    unsplash('photo-1588771930296-88c2cb06df7e'),
  ],
  drogueria_medicina: [
    unsplash('photo-1587854692152-cbe660dbde88'),
    unsplash('photo-1584308666744-24d5c474f2ae'),
    unsplash('photo-1471864190281-a93a3070b6de'),
    unsplash('photo-1576091160550-2173dba999ef'),
    unsplash('photo-1559839734-2b71ea197ec2'),
    unsplash('photo-1583912267550-d6c2ac3196c0'),
    unsplash('photo-1512069772995-ec65ed45afd6'),
  ],
  belleza_spa: [
    unsplash('photo-1560066984-138dadb34c00'),
    unsplash('photo-1596462502278-27bfdc403348'),
    unsplash('photo-1560750588-73207b1fef5c'),
    unsplash('photo-1570172619644-dfd03ed5d881'),
    unsplash('photo-1487412947147-5cebf100ffc2'),
    unsplash('photo-1512290923902-8a9f81dc236c'),
  ],
  barberia: [
    unsplash('photo-1503951914875-452162b0f3f1'),
    unsplash('photo-1585747860715-2ba37e788b70'),
    unsplash('photo-1521491397923-38b44b49bed8'),
    unsplash('photo-1567861911437-538298d94e63'),
    unsplash('photo-1519500856806-d7c49f31e03a'),
    unsplash('photo-1599351431202-1e0f0137899a'),
  ],
  turismo_cabanas_piscinas: [
    unsplash('photo-1520250497591-112f2f40a3f4'),
    unsplash('photo-1566073791250-1a19d5686b7a'),
    unsplash('photo-1582719508461-905c673771fd'),
    unsplash('photo-1540541338287-41700207dee6'),
    unsplash('photo-1476514525535-07fb3b4ae5f1'),
    unsplash('photo-1470770841072-f978cf4d019e'),
    unsplash('photo-1506929562872-bb421503ef21'),
  ],
  agro_ganaderia: [
    unsplash('photo-1500595046743-cd271d694d30'),
    unsplash('photo-1500382017468-9049fed747ef'),
    unsplash('photo-1560493676-04071c5f467b'),
    unsplash('photo-1625246333195-78d9c8adad30'),
    unsplash('photo-1574943320219-553eb213f72d'),
    unsplash('photo-1500076656116-558758c991c1'),
    unsplash('photo-1523348847154-909a4216f814'),
  ],
  veterinaria_mascotas: [
    unsplash('photo-1552053831-71594a27632d'),
    unsplash('photo-1517849845537-4d257902454a'),
    unsplash('photo-1548199973-03cce0bbc87b'),
    unsplash('photo-1601758228041-f3b2795255f1'),
    unsplash('photo-1543466835-00a7907e9de1'),
    unsplash('photo-1535268647677-f30019e2b21f'),
  ],
  ferreteria_construccion: [
    unsplash('photo-1504148455328-c376907d081c'),
    unsplash('photo-1541888946425-d81bb19240f5'),
    unsplash('photo-1581094794329-c8112a89af12'),
    unsplash('photo-1600585154340-be6161a56a0c'),
    unsplash('photo-1416331108676-a22ccb276e35'),
    unsplash('photo-1486406146926-c627a92ad1ab'),
    unsplash('photo-1503387762-592deb58ef4e'),
  ],
  transporte_camioneta: [
    unsplash('photo-1501700493788-fa1a4fc9fe62'),
    unsplash('photo-1601584115197-04ecc0da31d7'),
    unsplash('photo-1519003722824-194ddf4c2e91'),
    unsplash('photo-1568607918850-51c8d6ac40e5'),
    unsplash('photo-1558618666-fcd25c85cd64'),
    unsplash('photo-1519125323398-675f0ddb6304'),
    unsplash('photo-1558981403-c5f9899a28bc'),
  ],
  moda_ropa: [
    unsplash('photo-1521572163474-6864f9cf17ab'),
    unsplash('photo-1445205170230-e053b7e0c1a1'),
    unsplash('photo-1441986300917-64674bd600d8'),
    unsplash('photo-1483985988355-763728e1935b'),
    unsplash('photo-1472851294608-062f824d29cc'),
    unsplash('photo-1489987707025-afc232f7ea0f'),
    unsplash('photo-1467086322280-714415ca9be9'),
  ],
  gimnasio_fitness: [
    unsplash('photo-1534438327276-14e5300c3a48'),
    unsplash('photo-1571019613454-1cb2f99b2d8b'),
    unsplash('photo-1541534741688-6078c6bfb5c5'),
    unsplash('photo-1583454110551-21f2fa2afa61'),
    unsplash('photo-1517836357463-d25dfeac3438'),
    unsplash('photo-1540497077202-7c8a3999166f'),
  ],
  educacion_cursos: [
    unsplash('photo-1522202176988-66273c2fd55f'),
    unsplash('photo-1523240795612-9a054b0db644'),
    unsplash('photo-1509062522246-3755977927d7'),
    unsplash('photo-1456513080510-7bf3a84b82f8'),
    unsplash('photo-1434030216411-0b793f4b4173'),
    unsplash('photo-1524995997946-a1c2e315a42f'),
  ],
  inmobiliaria_hogar: [
    unsplash('photo-1564013799919-ab600027ffc6'),
    unsplash('photo-1600596542815-ffad4c1539a9'),
    unsplash('photo-1560448075-bb485b067938'),
    unsplash('photo-1512917774080-9991f1c4c750'),
    unsplash('photo-1600607687939-ce8a6c25118c'),
    unsplash('photo-1600585154526-990dced4db0d'),
  ],
  eventos_fiestas: [
    unsplash('photo-1530103862671-de83c484dad3'),
    unsplash('photo-1519671482749-fd09be7ccebf'),
    unsplash('photo-1492684223066-81342ee5ff30'),
    unsplash('photo-1470229722913-7c0e2dbbafd3'),
    unsplash('photo-1519225421980-715cb0215aed'),
    unsplash('photo-1517457373958-b7bdd4587205'),
  ],
  servicios_profesionales: [
    unsplash('photo-1589829545856-d10d557cf95f'),
    unsplash('photo-1454165804606-c3d57bc86b40'),
    unsplash('photo-1554224155-672265f51298'),
    unsplash('photo-1450101499163-c8848c66ca85'),
    unsplash('photo-1521791136064-7986c2920216'),
    unsplash('photo-1507003211169-0a1dd7228f2d'),
    unsplash('photo-1573496359142-b8d87734a5a2'),
  ],
};

/** Detecta la categoría exacta del banco a partir del brief (20 giros). */
export function guessPhotoCategory(text: string): PhotoCategory {
  const t = text.toLowerCase();
  for (const m of CATEGORY_MATCHERS) {
    if (m.re.test(t)) return m.cat;
  }
  return DEFAULT_CATEGORY;
}

/**
 * 🐝 Detector del banner de bloqueo de Pollinations: inspecciona una copia
 * 16×16 de la imagen; si las esquinas superiores tienen el color crema del
 * cartel "At its limit right now" (R>245, G>240, B>225) la descarta.
 */
export function isPollinationsBlockImage(img: HTMLImageElement): boolean {
  try {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, 16, 16);
    const corners: Array<[number, number]> = [[1, 1], [14, 1], [1, 4], [14, 4]];
    let cream = 0;
    for (const [x, y] of corners) {
      const d = ctx.getImageData(x, y, 1, 1).data;
      if (d[0] > 245 && d[1] > 240 && d[2] > 225) cream += 1;
    }
    return cream >= 3;
  } catch {
    return false;
  }
}

/** Descarga una foto del banco y la convierte a dataURL (cero CORS). */
async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Carga una fotografía HD NUEVA del banco según las palabras del brief.
 * Cada llamada rota la foto (semilla/salt) y prueba hasta 6 URLs de la
 * categoría; si la categoría no tiene fotos disponibles cae a otra categoría.
 */
export async function loadBankPhoto(text: string, salt = Math.floor(Math.random() * 1000)): Promise<string | null> {
  const cat = guessPhotoCategory(text);
  const order: PhotoCategory[] = [cat, ...Object.keys(PHOTO_BANK).filter((c) => c !== cat) as PhotoCategory[]];
  for (const c of order) {
    const pool = [...PHOTO_BANK[c]];
    // Rotación determinista por salt: cada clic trae una foto diferente.
    const start = salt % pool.length;
    const rotated = [...pool.slice(start), ...pool.slice(0, start)];
    for (const url of rotated) {
      try {
        return await fetchAsDataUrl(url);
      } catch {
        // Foto no disponible: prueba la siguiente del banco.
      }
    }
  }
  return null;
}
