/**
 * Datos del modo SUPERMERCADO.
 *
 * Productos: cada uno tiene ID estable, nombre en español, sección y un icono
 * dibujado por código (forma + colores). Ningún producto es «correcto» para un
 * plato: el servidor solo valida reglas de interacción, inventario y tiempos.
 *
 * Comidas: 100 nombres generales y reconocibles. Solo se guarda el nombre y un
 * tipo amplio (salado/dulce) para comprobar que el catálogo tiene variedad; no
 * hay recetas, ingredientes recomendados ni listas que invaliden un aporte.
 */

export type SectionId =
  | 'fruta' | 'verdura' | 'carne' | 'pescado' | 'lacteos' | 'panaderia' | 'pasta'
  | 'conservas' | 'especias' | 'refrigerados' | 'reposteria';

export type IconShape =
  | 'round' | 'banana' | 'long' | 'leafy' | 'bunch' | 'berry' | 'melon' | 'pepper' | 'root' | 'bulb' | 'mushroom'
  | 'meat' | 'sausage' | 'fish' | 'shell' | 'shrimp' | 'octopus' | 'carton' | 'bottle' | 'jar' | 'can' | 'box'
  | 'bag' | 'bread' | 'loaf' | 'egg' | 'cheese' | 'tub' | 'spice' | 'tube' | 'block' | 'herb' | 'cone' | 'corn' | 'pod';

export interface Product {
  id: string;
  name: string;
  section: SectionId;
  shape: IconShape;
  c1: string;
  c2: string;
}

export const SECTIONS: { id: SectionId; name: string; icon: string }[] = [
  { id: 'fruta', name: 'Fruta', icon: 'apple' },
  { id: 'verdura', name: 'Verdura', icon: 'carrot' },
  { id: 'carne', name: 'Carnicería', icon: 'meat' },
  { id: 'pescado', name: 'Pescadería', icon: 'fish' },
  { id: 'lacteos', name: 'Lácteos y huevos', icon: 'milk' },
  { id: 'panaderia', name: 'Panadería', icon: 'bread' },
  { id: 'pasta', name: 'Pasta, arroz y legumbres', icon: 'pasta' },
  { id: 'conservas', name: 'Conservas', icon: 'can' },
  { id: 'especias', name: 'Especias y salsas', icon: 'spice' },
  { id: 'refrigerados', name: 'Refrigerados', icon: 'snow' },
  { id: 'reposteria', name: 'Repostería y dulces', icon: 'cake' },
];

const P = (id: string, name: string, section: SectionId, shape: IconShape, c1: string, c2 = '#2b2d42'): Product => ({ id, name, section, shape, c1, c2 });

export const PRODUCTS: Product[] = [
  // Fruta
  P('manzana', 'Manzana', 'fruta', 'round', '#e63946', '#2bb24c'),
  P('platano', 'Plátano', 'fruta', 'banana', '#f6d743', '#8d6e1f'),
  P('naranja', 'Naranja', 'fruta', 'round', '#f77f00', '#2bb24c'),
  P('limon', 'Limón', 'fruta', 'round', '#f9e04b', '#6a994e'),
  P('fresas', 'Fresas', 'fruta', 'berry', '#e63946', '#2bb24c'),
  P('uvas', 'Uvas', 'fruta', 'bunch', '#7b2cbf', '#6a994e'),
  P('pera', 'Pera', 'fruta', 'bulb', '#b5d33d', '#6a4e2f'),
  P('melocoton', 'Melocotón', 'fruta', 'round', '#ffa06b', '#e85d75'),
  P('pina', 'Piña', 'fruta', 'cone', '#e9b44c', '#2bb24c'),
  P('sandia', 'Sandía', 'fruta', 'melon', '#2b9348', '#e63946'),
  P('melon', 'Melón', 'fruta', 'melon', '#cbd67a', '#f4a261'),
  P('kiwi', 'Kiwi', 'fruta', 'round', '#8d6e3f', '#7cb518'),
  P('mango', 'Mango', 'fruta', 'bulb', '#ffb703', '#fb8500'),
  P('arandanos', 'Arándanos', 'fruta', 'berry', '#3a4fbf', '#1d2d7a'),
  P('cerezas', 'Cerezas', 'fruta', 'berry', '#b5172b', '#2bb24c'),
  P('coco', 'Coco', 'fruta', 'round', '#7f5539', '#f1e3d3'),
  P('aguacate', 'Aguacate', 'fruta', 'bulb', '#4f772d', '#c9b458'),
  P('frambuesas', 'Frambuesas', 'fruta', 'berry', '#e5383b', '#ff8fab'),
  // Verdura
  P('tomate', 'Tomate', 'verdura', 'round', '#e5383b', '#2bb24c'),
  P('lechuga', 'Lechuga', 'verdura', 'leafy', '#80b918', '#55a630'),
  P('cebolla', 'Cebolla', 'verdura', 'bulb', '#e9c46a', '#b5838d'),
  P('ajo', 'Ajo', 'verdura', 'bulb', '#f1f1e6', '#c9ada7'),
  P('patata', 'Patata', 'verdura', 'round', '#c9a227', '#8d6e3f'),
  P('zanahoria', 'Zanahoria', 'verdura', 'root', '#f77f00', '#2bb24c'),
  P('pimiento_rojo', 'Pimiento rojo', 'verdura', 'pepper', '#d00000', '#2bb24c'),
  P('pimiento_verde', 'Pimiento verde', 'verdura', 'pepper', '#38b000', '#1b5e20'),
  P('calabacin', 'Calabacín', 'verdura', 'long', '#2d6a4f', '#95d5b2'),
  P('berenjena', 'Berenjena', 'verdura', 'long', '#5a189a', '#2bb24c'),
  P('pepino', 'Pepino', 'verdura', 'long', '#40916c', '#b7e4c7'),
  P('champinones', 'Champiñones', 'verdura', 'mushroom', '#e8dcc8', '#a68a64'),
  P('espinacas', 'Espinacas', 'verdura', 'leafy', '#2d6a4f', '#1b4332'),
  P('brocoli', 'Brócoli', 'verdura', 'leafy', '#55a630', '#2b9348'),
  P('coliflor', 'Coliflor', 'verdura', 'leafy', '#f1ece2', '#80b918'),
  P('judias_verdes', 'Judías verdes', 'verdura', 'pod', '#52b788', '#2d6a4f'),
  P('guisantes', 'Guisantes', 'verdura', 'pod', '#70e000', '#38b000'),
  P('maiz', 'Mazorca de maíz', 'verdura', 'corn', '#ffd60a', '#80b918'),
  P('puerro', 'Puerro', 'verdura', 'long', '#d8f3dc', '#40916c'),
  P('calabaza', 'Calabaza', 'verdura', 'melon', '#f48c06', '#6a994e'),
  P('perejil', 'Perejil', 'verdura', 'herb', '#2b9348', '#1b4332'),
  P('albahaca', 'Albahaca', 'verdura', 'herb', '#38b000', '#1b5e20'),
  P('boniato', 'Boniato', 'verdura', 'root', '#b5651d', '#e76f51'),
  // Carnicería
  P('pollo', 'Pollo', 'carne', 'meat', '#f6d5b8', '#e9a178'),
  P('carne_picada', 'Carne picada', 'carne', 'meat', '#c1121f', '#ff8fa3'),
  P('ternera', 'Filetes de ternera', 'carne', 'meat', '#a4161a', '#e5989b'),
  P('cerdo', 'Chuletas de cerdo', 'carne', 'meat', '#e5989b', '#ffcad4'),
  P('costillas', 'Costillas', 'carne', 'meat', '#9d0208', '#f1c0b9'),
  P('salchichas', 'Salchichas', 'carne', 'sausage', '#e07a5f', '#b5523b'),
  P('chorizo', 'Chorizo', 'carne', 'sausage', '#ae2012', '#f4a261'),
  P('jamon', 'Jamón serrano', 'carne', 'meat', '#b23a48', '#fcd5ce'),
  P('bacon', 'Bacon', 'carne', 'meat', '#d62828', '#fcbf49'),
  P('pavo', 'Pechuga de pavo', 'carne', 'meat', '#f8e1d4', '#e5b9a8'),
  P('cordero', 'Cordero', 'carne', 'meat', '#9e2a2b', '#e9c46a'),
  P('morcilla', 'Morcilla', 'carne', 'sausage', '#3c1518', '#69140e'),
  P('lomo', 'Lomo de cerdo', 'carne', 'meat', '#f28482', '#f6bd60'),
  P('albondigas_crudas', 'Masa de albóndigas', 'carne', 'meat', '#b56576', '#e56b6f'),
  // Pescadería
  P('merluza', 'Merluza', 'pescado', 'fish', '#adb5bd', '#e9ecef'),
  P('salmon', 'Salmón', 'pescado', 'fish', '#fb8500', '#ffb703'),
  P('atun_fresco', 'Atún fresco', 'pescado', 'fish', '#9d0208', '#495057'),
  P('gambas', 'Gambas', 'pescado', 'shrimp', '#ff6b6b', '#ffd6a5'),
  P('langostinos', 'Langostinos', 'pescado', 'shrimp', '#e85d04', '#ffba08'),
  P('calamares', 'Calamares', 'pescado', 'octopus', '#f1e3d3', '#d4a373'),
  P('pulpo', 'Pulpo', 'pescado', 'octopus', '#c9184a', '#ff758f'),
  P('mejillones', 'Mejillones', 'pescado', 'shell', '#22223b', '#f2cc8f'),
  P('almejas', 'Almejas', 'pescado', 'shell', '#d6ccc2', '#a68a64'),
  P('sardinas', 'Sardinas', 'pescado', 'fish', '#8d99ae', '#5c677d'),
  P('boquerones', 'Boquerones', 'pescado', 'fish', '#adb5bd', '#4a4e69'),
  P('bacalao', 'Bacalao', 'pescado', 'fish', '#f1f3f5', '#ced4da'),
  P('sepia', 'Sepia', 'pescado', 'octopus', '#e9ecef', '#6c757d'),
  P('palitos_cangrejo', 'Palitos de cangrejo', 'pescado', 'sausage', '#ff7b7b', '#ffffff'),
  // Lácteos y huevos
  P('leche', 'Leche', 'lacteos', 'carton', '#ffffff', '#2f6fe0'),
  P('nata', 'Nata', 'lacteos', 'carton', '#fff8e7', '#ff8fab'),
  P('mantequilla', 'Mantequilla', 'lacteos', 'block', '#ffe066', '#f4a261'),
  P('queso_rallado', 'Queso rallado', 'lacteos', 'bag', '#ffd166', '#f6f6f6'),
  P('queso_fresco', 'Queso fresco', 'lacteos', 'tub', '#ffffff', '#90e0ef'),
  P('mozzarella', 'Mozzarella', 'lacteos', 'cheese', '#fdfcdc', '#57cc99'),
  P('queso_curado', 'Queso curado', 'lacteos', 'cheese', '#f4c95d', '#bb8b3b'),
  P('yogur', 'Yogur natural', 'lacteos', 'tub', '#ffffff', '#4ea8de'),
  P('huevos', 'Huevos', 'lacteos', 'egg', '#f3d5b5', '#bc8a5f'),
  P('leche_condensada', 'Leche condensada', 'lacteos', 'can', '#e63946', '#ffffff'),
  P('queso_crema', 'Queso crema', 'lacteos', 'tub', '#e0f2fe', '#2f6fe0'),
  // Panadería
  P('pan_barra', 'Barra de pan', 'panaderia', 'loaf', '#d4a373', '#a47148'),
  P('pan_molde', 'Pan de molde', 'panaderia', 'bread', '#e9c46a', '#f4a261'),
  P('pan_hamburguesa', 'Pan de hamburguesa', 'panaderia', 'bread', '#e09f3e', '#ffe8d6'),
  P('pan_perrito', 'Pan de perrito', 'panaderia', 'loaf', '#e9a03b', '#fff1e6'),
  P('tortillas_trigo', 'Tortillas de trigo', 'panaderia', 'bag', '#f1e3c6', '#e63946'),
  P('hojaldre', 'Masa de hojaldre', 'panaderia', 'box', '#ffe8a3', '#f77f00'),
  P('masa_pizza', 'Masa de pizza', 'panaderia', 'box', '#f4a261', '#2bb24c'),
  P('pan_rallado', 'Pan rallado', 'panaderia', 'bag', '#e9c46a', '#a47148'),
  P('obleas', 'Obleas de empanadilla', 'panaderia', 'box', '#fefae0', '#2f6fe0'),
  P('picos', 'Picos de pan', 'panaderia', 'bag', '#e5b769', '#8d5a3b'),
  // Pasta, arroz y legumbres
  P('macarrones', 'Macarrones', 'pasta', 'box', '#ffd166', '#2f6fe0'),
  P('espaguetis', 'Espaguetis', 'pasta', 'box', '#ffe169', '#e63946'),
  P('laminas_lasana', 'Láminas de pasta', 'pasta', 'box', '#fcefb4', '#2bb24c'),
  P('arroz', 'Arroz', 'pasta', 'bag', '#ffffff', '#e63946'),
  P('lentejas', 'Lentejas', 'pasta', 'bag', '#a47148', '#e9c46a'),
  P('garbanzos', 'Garbanzos', 'pasta', 'bag', '#e9c46a', '#a47148'),
  P('alubias', 'Alubias', 'pasta', 'bag', '#f8f9fa', '#8d5a3b'),
  P('fideos', 'Fideos', 'pasta', 'bag', '#ffe8a3', '#f77f00'),
  P('noodles', 'Fideos orientales', 'pasta', 'box', '#ffd6a5', '#d62828'),
  P('cuscus', 'Cuscús', 'pasta', 'box', '#f6e0b5', '#7b2cbf'),
  // Conservas
  P('atun_lata', 'Atún en lata', 'conservas', 'can', '#2f6fe0', '#ffd166'),
  P('tomate_triturado', 'Tomate triturado', 'conservas', 'can', '#e63946', '#2bb24c'),
  P('aceitunas', 'Aceitunas', 'conservas', 'jar', '#606c38', '#283618'),
  P('maiz_lata', 'Maíz dulce', 'conservas', 'can', '#ffd60a', '#2bb24c'),
  P('piquillos', 'Pimientos del piquillo', 'conservas', 'jar', '#d00000', '#ffba08'),
  P('anchoas', 'Anchoas', 'conservas', 'can', '#8d99ae', '#e63946'),
  P('melocoton_almibar', 'Melocotón en almíbar', 'conservas', 'jar', '#ffb703', '#fb8500'),
  P('alcaparras', 'Alcaparras', 'conservas', 'jar', '#6a994e', '#386641'),
  P('pepinillos', 'Pepinillos', 'conservas', 'jar', '#4f772d', '#90a955'),
  P('caldo', 'Caldo', 'conservas', 'carton', '#f4a261', '#e9c46a'),
  // Especias y salsas
  P('sal', 'Sal', 'especias', 'spice', '#ffffff', '#2f6fe0'),
  P('pimienta', 'Pimienta', 'especias', 'spice', '#343a40', '#adb5bd'),
  P('pimenton', 'Pimentón', 'especias', 'spice', '#c1121f', '#ffba08'),
  P('oregano', 'Orégano', 'especias', 'spice', '#606c38', '#dda15e'),
  P('comino', 'Comino', 'especias', 'spice', '#bc6c25', '#fefae0'),
  P('canela', 'Canela', 'especias', 'spice', '#8d5a3b', '#f4a261'),
  P('azafran', 'Azafrán', 'especias', 'spice', '#e85d04', '#9d0208'),
  P('curry', 'Curry', 'especias', 'spice', '#f4a300', '#7f5539'),
  P('laurel', 'Laurel', 'especias', 'herb', '#6a994e', '#386641'),
  P('aceite', 'Aceite de oliva', 'especias', 'bottle', '#a7c957', '#386641'),
  P('vinagre', 'Vinagre', 'especias', 'bottle', '#f8edeb', '#9d0208'),
  P('mayonesa', 'Mayonesa', 'especias', 'tube', '#fff3b0', '#2f6fe0'),
  P('ketchup', 'Kétchup', 'especias', 'tube', '#d00000', '#ffffff'),
  P('mostaza', 'Mostaza', 'especias', 'tube', '#ffd000', '#6a4c93'),
  P('soja', 'Salsa de soja', 'especias', 'bottle', '#3c1518', '#e63946'),
  P('tomate_frito', 'Tomate frito', 'especias', 'jar', '#d62828', '#f1faee'),
  P('salsa_picante', 'Salsa picante', 'especias', 'bottle', '#ff0a54', '#ffd60a'),
  P('salsa_barbacoa', 'Salsa barbacoa', 'especias', 'bottle', '#6f1d1b', '#ffbe0b'),
  P('ajo_polvo', 'Ajo en polvo', 'especias', 'spice', '#f1e3d3', '#bc6c25'),
  // Refrigerados y congelados
  P('helado', 'Helado de vainilla', 'refrigerados', 'tub', '#fff3c4', '#ff8fab'),
  P('guisantes_cong', 'Verduras congeladas', 'refrigerados', 'bag', '#80ed99', '#2f6fe0'),
  P('masa_quebrada', 'Masa quebrada', 'refrigerados', 'box', '#ffe5b4', '#e63946'),
  P('hielo', 'Hielo picado', 'refrigerados', 'bag', '#caf0f8', '#48cae4'),
  P('gulas', 'Gulas', 'refrigerados', 'box', '#f8edeb', '#3a86ff'),
  P('tofu', 'Tofu', 'refrigerados', 'block', '#fdfcdc', '#2bb24c'),
  P('nata_montar', 'Nata para montar', 'refrigerados', 'carton', '#ffffff', '#7b2cbf'),
  // Repostería y dulces
  P('harina', 'Harina', 'reposteria', 'bag', '#ffffff', '#f4a261'),
  P('azucar', 'Azúcar', 'reposteria', 'bag', '#ffffff', '#2f6fe0'),
  P('levadura', 'Levadura', 'reposteria', 'box', '#fff3b0', '#e63946'),
  P('chocolate', 'Chocolate negro', 'reposteria', 'block', '#5a3825', '#e63946'),
  P('cacao', 'Cacao en polvo', 'reposteria', 'jar', '#6f4518', '#f4a261'),
  P('miel', 'Miel', 'reposteria', 'jar', '#ffb703', '#8d5a3b'),
  P('galletas', 'Galletas', 'reposteria', 'box', '#e09f3e', '#2f6fe0'),
  P('mermelada', 'Mermelada', 'reposteria', 'jar', '#c9184a', '#ffffff'),
  P('vainilla', 'Esencia de vainilla', 'reposteria', 'bottle', '#3c2a21', '#fff3b0'),
  P('gelatina', 'Gelatina', 'reposteria', 'box', '#ff4d6d', '#ffffff'),
  P('fideos_chocolate', 'Virutas de chocolate', 'reposteria', 'jar', '#3c1518', '#ff8fab'),
  P('frutos_secos', 'Frutos secos', 'reposteria', 'bag', '#a47148', '#dda15e'),
  P('pasas', 'Pasas', 'reposteria', 'box', '#5e3023', '#e63946'),
  P('coco_rallado', 'Coco rallado', 'reposteria', 'bag', '#ffffff', '#7f5539'),
];

export const PRODUCT_BY_ID: Record<string, Product> = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

export interface Dish {
  id: string;
  name: string;
  kind: 'salado' | 'dulce';
}

const DISH_NAMES: [string, Dish['kind']][] = [
  ['Macarrones', 'salado'], ['Espaguetis', 'salado'], ['Lasaña', 'salado'], ['Canelones', 'salado'], ['Raviolis', 'salado'],
  ['Pizza', 'salado'], ['Hamburguesa', 'salado'], ['Perrito caliente', 'salado'], ['Bocadillo', 'salado'], ['Sándwich', 'salado'],
  ['Tostadas', 'salado'], ['Ensalada', 'salado'], ['Ensaladilla', 'salado'], ['Paella', 'salado'], ['Arroz al horno', 'salado'],
  ['Arroz caldoso', 'salado'], ['Arroz a la cubana', 'salado'], ['Tortilla', 'salado'], ['Huevos revueltos', 'salado'], ['Huevos rellenos', 'salado'],
  ['Huevos rotos', 'salado'], ['Patatas asadas', 'salado'], ['Patatas fritas', 'salado'], ['Patatas bravas', 'salado'], ['Puré de patatas', 'salado'],
  ['Patatas guisadas', 'salado'], ['Lentejas', 'salado'], ['Cocido', 'salado'], ['Fabada', 'salado'], ['Potaje', 'salado'],
  ['Sopa', 'salado'], ['Crema de verduras', 'salado'], ['Gazpacho', 'salado'], ['Salmorejo', 'salado'], ['Pisto', 'salado'],
  ['Menestra', 'salado'], ['Verduras al horno', 'salado'], ['Verduras a la plancha', 'salado'], ['Berenjenas rellenas', 'salado'], ['Calabacines rellenos', 'salado'],
  ['Pimientos rellenos', 'salado'], ['Croquetas', 'salado'], ['Empanada', 'salado'], ['Empanadillas', 'salado'], ['Albóndigas', 'salado'],
  ['Filetes empanados', 'salado'], ['Carne guisada', 'salado'], ['Pollo asado', 'salado'], ['Pollo en salsa', 'salado'], ['Pollo empanado', 'salado'],
  ['Costillas al horno', 'salado'], ['Salchichas en salsa', 'salado'], ['Brochetas', 'salado'], ['Pinchos morunos', 'salado'], ['Parrillada de carne', 'salado'],
  ['Pescado al horno', 'salado'], ['Pescado rebozado', 'salado'], ['Fritura de pescado', 'salado'], ['Mariscada', 'salado'], ['Calamares rebozados', 'salado'],
  ['Pulpo a la gallega', 'salado'], ['Gambas al ajillo', 'salado'], ['Mejillones en salsa', 'salado'], ['Almejas en salsa', 'salado'], ['Sepia a la plancha', 'salado'],
  ['Boquerones en vinagre', 'salado'], ['Sardinas asadas', 'salado'], ['Ensalada de pasta', 'salado'], ['Sushi', 'salado'], ['Kebab', 'salado'],
  ['Tacos', 'salado'], ['Fajitas', 'salado'], ['Burritos', 'salado'], ['Nachos', 'salado'], ['Fish and chips', 'salado'],
  ['Rollitos de primavera', 'salado'], ['Arroz tres delicias', 'salado'], ['Tortitas', 'dulce'], ['Crepes', 'dulce'], ['Gofres', 'dulce'],
  ['Bizcocho', 'dulce'], ['Magdalenas', 'dulce'], ['Galletas', 'dulce'], ['Flan', 'dulce'], ['Natillas', 'dulce'],
  ['Arroz con leche', 'dulce'], ['Torrijas', 'dulce'], ['Tarta de queso', 'dulce'], ['Tarta de chocolate', 'dulce'], ['Tarta de manzana', 'dulce'],
  ['Brownie', 'dulce'], ['Churros', 'dulce'], ['Helado', 'dulce'], ['Batido', 'dulce'], ['Macedonia', 'dulce'],
  ['Yogur con fruta', 'dulce'], ['Pudin', 'dulce'], ['Rosquillas', 'dulce'], ['Buñuelos', 'dulce'], ['Tarta de cumpleaños', 'dulce'],
];

/** Catálogo de 100 comidas con ID estable (dXXX). */
export const DISHES: Dish[] = DISH_NAMES.map(([name, kind], i) => ({ id: `d${String(i + 1).padStart(3, '0')}`, name, kind }));
export const DISH_BY_ID: Record<string, Dish> = Object.fromEntries(DISHES.map((d) => [d.id, d]));

/** Secciones con productos versátiles para cada tipo de comida (solo para validar variedad del catálogo). */
export const KIND_SECTIONS: Record<Dish['kind'], SectionId[]> = {
  salado: ['verdura', 'carne', 'pescado', 'lacteos', 'panaderia', 'pasta', 'conservas', 'especias', 'refrigerados'],
  dulce: ['fruta', 'lacteos', 'reposteria', 'refrigerados', 'panaderia', 'especias'],
};

/**
 * Elige la comida de una partida nueva evitando las recientes de la sala.
 * `breadth` (1–3) limita a nombres más abiertos cuando es alto; nunca introduce
 * platos especializados porque el catálogo no los contiene.
 */
export function pickDish(rnd: () => number, recent: string[], breadth = 2): Dish {
  const open = new Set(['d001', 'd002', 'd006', 'd007', 'd009', 'd010', 'd011', 'd012', 'd018', 'd031', 'd042', 'd043', 'd053', 'd070', 'd071', 'd079', 'd081', 'd093', 'd094', 'd100']);
  let pool = DISHES.filter((d) => !recent.includes(d.id));
  if (breadth >= 3) {
    const o = pool.filter((d) => open.has(d.id));
    if (o.length) pool = o;
  }
  if (!pool.length) pool = DISHES;
  return pool[Math.floor(rnd() * pool.length) % pool.length];
}
