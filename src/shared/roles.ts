export type Team = 'worker' | 'impostor';
export type RoleId =
  | 'ingeniero' | 'analista' | 'rastreador' | 'observador' | 'tecnico' | 'explorador' | 'vigilante'
  | 'camuflador' | 'espectro' | 'saboteador' | 'interferente' | 'escapista' | 'senuelo';

export interface ParamDef {
  key: string;
  label: string;
  unit: 's' | '%' | 'u' | 'usos' | '';
  min: number;
  max: number;
  step: number;
  def: number;
  help?: string;
}

export interface RoleDef {
  id: RoleId;
  /** Nombre canónico: idéntico en tren, barco y avión. */
  name: string;
  team: Team;
  short: string;
  desc: string;
  /** Ventaja pasiva sin botón (no muestra duración ni enfriamiento). */
  passive?: boolean;
  params: ParamDef[];
}

const S = (key: string, label: string, min: number, max: number, def: number, step = 1, help?: string): ParamDef => ({ key, label, unit: 's', min, max, step, def, help });
const P = (key: string, label: string, min: number, max: number, def: number, help?: string): ParamDef => ({ key, label, unit: '%', min, max, step: 5, def, help });
const U = (key: string, label: string, min: number, max: number, def: number, help?: string): ParamDef => ({ key, label, unit: 'usos', min, max, step: 1, def, help });
const D = (key: string, label: string, min: number, max: number, def: number, help?: string): ParamDef => ({ key, label, unit: 'u', min, max, step: 10, def, help });

export const ROLES: RoleDef[] = [
  {
    id: 'ingeniero', name: 'Ingeniero', team: 'worker', short: 'Usa las trampillas',
    desc: 'Puede usar la red de trampillas del mapa con estancia limitada. Ventear no demuestra ser impostor.',
    params: [S('duration', 'Estancia máxima', 2, 20, 6), S('cooldown', 'Enfriamiento', 5, 90, 30)],
  },
  {
    id: 'analista', name: 'Analista', team: 'worker', short: 'Diagnóstico portátil',
    desc: 'Consulta el estado de los sistemas y del responsable. No ve identidades, posiciones ni autores. Comunicaciones bloquea la señal.',
    params: [S('battery', 'Batería máxima', 3, 30, 8), S('recharge', 'Recarga por tarea', 1, 15, 4), S('cooldown', 'Enfriamiento de apertura', 0, 60, 10)],
  },
  {
    id: 'rastreador', name: 'Rastreador', team: 'worker', short: 'Lecturas de posición',
    desc: 'Marca a alguien visible y cercano; recibe lecturas periódicas con antigüedad y nivel. Comunicaciones suspende las lecturas.',
    params: [S('delay', 'Retardo inicial', 0, 10, 2), S('interval', 'Intervalo de lectura', 1, 6, 2), S('duration', 'Duración del rastreo', 4, 30, 10), S('cooldown', 'Enfriamiento', 10, 120, 45), D('range', 'Alcance de marcado', 60, 400, 160)],
  },
  {
    id: 'observador', name: 'Observador', team: 'worker', short: 'Cámara remota',
    desc: 'Desde una posición válida consulta una cámara fija elegida. Queda quieto y distraído; enciende el piloto de la cámara.',
    params: [S('duration', 'Duración de consulta', 2, 20, 6), S('cooldown', 'Enfriamiento', 10, 120, 40), U('uses', 'Activaciones por partida', 1, 10, 3)],
  },
  {
    id: 'tecnico', name: 'Técnico', team: 'worker', short: 'Agiliza reparaciones',
    desc: 'Reduce las etapas de espera o esfuerzo de reparaciones no críticas. No salta pasos ni acorta el plazo de un crítico.',
    params: [S('duration', 'Duración de la ayuda', 3, 20, 8), S('cooldown', 'Enfriamiento', 10, 90, 35), P('intensity', 'Reducción de esperas', 5, 40, 15)],
  },
  {
    id: 'explorador', name: 'Explorador', team: 'worker', short: 'Carrera breve',
    desc: 'Aumenta su velocidad durante unos segundos. Sin teletransporte ni acceso extra; no funciona cargando una bandeja.',
    params: [S('duration', 'Duración', 1, 10, 4), S('cooldown', 'Enfriamiento', 10, 90, 35), P('intensity', 'Velocidad extra', 5, 40, 15)],
  },
  {
    id: 'vigilante', name: 'Vigilante', team: 'worker', short: 'Sensor de paso',
    desc: 'Instala un sensor visible junto a una puerta. Registra pasos anónimos; consulta el resultado volviendo al sensor.',
    params: [S('duration', 'Ventana de registro', 5, 60, 20), S('cooldown', 'Enfriamiento', 10, 120, 45), U('uses', 'Colocaciones por partida', 1, 6, 2), U('maxPasses', 'Pasos registrados máx.', 1, 10, 3), D('range', 'Alcance de instalación', 40, 200, 90)],
  },
  {
    id: 'camuflador', name: 'Camuflador', team: 'impostor', short: 'Copia una apariencia',
    desc: 'Copia la apariencia y el nombre de una persona viva. Animación visible de transformación. La reunión cancela el disfraz.',
    params: [S('duration', 'Duración del disfraz', 3, 30, 10), S('cooldown', 'Enfriamiento', 10, 120, 45)],
  },
  {
    id: 'espectro', name: 'Espectro', team: 'impostor', short: 'Invisibilidad breve',
    desc: 'Se vuelve invisible con efectos de entrada y salida. No puede interactuar mientras dura; sigue chocando con paredes.',
    params: [S('duration', 'Duración', 2, 15, 5), S('cooldown', 'Enfriamiento', 10, 120, 40)],
  },
  {
    id: 'saboteador', name: 'Saboteador', team: 'impostor', short: 'Prepara más rápido', passive: true,
    desc: 'Ventaja pasiva: reduce el tiempo de preparación física de los sabotajes. No reduce plazos ni enfriamientos.',
    params: [P('intensity', 'Reducción de preparación', 5, 40, 15)],
  },
  {
    id: 'interferente', name: 'Interferente', team: 'impostor', short: 'Interferencia local',
    desc: 'Manipula un terminal de comunicaciones cercano y deja sin señal las cámaras y paneles de esa zona.',
    params: [S('duration', 'Duración', 2, 20, 6), S('cooldown', 'Enfriamiento', 10, 120, 45), U('uses', 'Usos por partida', 1, 6, 2)],
  },
  {
    id: 'escapista', name: 'Escapista', team: 'impostor', short: 'Ruta de trampilla extra',
    desc: 'Junto a una trampilla habilita una conexión adicional predefinida durante unos segundos.',
    params: [S('duration', 'Ventana de ruta', 3, 20, 8), S('cooldown', 'Enfriamiento', 10, 120, 40)],
  },
  {
    id: 'senuelo', name: 'Señuelo', team: 'impostor', short: 'Proyección trabajando',
    desc: 'Deja junto a una estación una proyección con su apariencia simulando una tarea. Una distorsión sutil la delata de cerca.',
    params: [S('duration', 'Duración', 3, 20, 8), S('cooldown', 'Enfriamiento', 10, 120, 50), U('uses', 'Usos por partida', 1, 6, 2)],
  },
];

export const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<RoleId, RoleDef>;
export const WORKER_ROLES = ROLES.filter((r) => r.team === 'worker').map((r) => r.id);
export const IMPOSTOR_ROLES = ROLES.filter((r) => r.team === 'impostor').map((r) => r.id);

export function teamName(t: Team): string {
  return t === 'worker' ? 'TRABAJADOR' : 'IMPOSTOR';
}
