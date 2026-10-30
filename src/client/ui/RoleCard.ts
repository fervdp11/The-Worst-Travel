import { getMap } from '../../shared/maps';
import { ROLE_BY_ID } from '../../shared/roles';
import { audio } from '../audio/Audio';
import { store } from '../state';
import type { App } from './App';
import { h, ICONS, uiRoot } from './dom';
import { portrait } from './Portrait';

/** Tarjeta privada de inicio: bando, especialidad (o «sin especialidad») y objetivo. */
export function showRoleCard(app: App) {
  const show = () => {
    const priv = store.priv;
    if (!priv) { setTimeout(show, 100); return; }
    const def = getMap(store.gstart!.mapId);
    const imp = priv.team === 'impostor';
    const me = store.pub?.players.find((p) => p.id === store.net?.pid);
    const role = priv.role ? ROLE_BY_ID[priv.role] : null;
    const market = store.pub?.mode === 'market' || def.id === 'market';
    const goal = market
      ? (imp ? 'Deduce el plato y disimula con tu compra. Nadie te dirá la comida: observa qué cogen los demás.' : 'Elige un ingrediente que pegue con la comida, sin dejárselo demasiado fácil al impostor.')
      : imp
        ? `Finge trabajar, sabotea en las instalaciones y completa en secreto la preparación del arma. ${def.texts.accessGoal.replace('Accede', 'Después, accede')} y atácale.`
        : `Completa tus tareas y llegad a destino, o descubrid y expulsad al impostor. Protege al ${def.responsible?.title.toLowerCase() ?? 'responsable'}.`;
    const dish = market && !imp ? priv.market?.dish : null;
    const card = h('div', { class: 'rolecard' }, h('div', { class: 'panel card' },
      h('div', { class: 'small muted' }, `${def.texts.vehicle} · ${def.texts.short}`),
      me ? portrait(me.color, me.acc, 70) : null,
      h('h1', { class: imp ? 'impostor' : 'worker' }, imp ? 'IMPOSTOR' : 'TRABAJADOR'),
      market
        ? h('div', { class: 'dish-reveal' }, h('div', { class: 'small muted' }, imp ? 'Comida' : 'La comida es'), h('b', { class: 'title' }, dish ?? '¿?'))
        : h('div', { class: 'row', style: 'justify-content:center;margin:8px 0' }, role ? h('span', { html: ICONS[role.id], style: 'display:inline-flex;width:30px' }) : null, h('b', { class: 'title', style: 'font-size:1.4em' }, role ? role.name : 'Sin especialidad')),
      role ? h('p', { class: 'small', style: 'margin:0 0 8px' }, role.desc) : null,
      h('p', { style: 'margin:0' }, goal),
      store.room?.practice && !market ? h('p', { class: 'small', style: 'color:var(--gold)' }, 'PRÁCTICA: en este modo también puedes provocar sabotajes para probarlos.') : null,
      h('p', { class: 'small muted' }, 'Toca para continuar'),
    ));
    const close = () => { card.style.transition = 'opacity 250ms'; card.style.opacity = '0'; setTimeout(() => card.remove(), 260); };
    card.addEventListener('pointerdown', close);
    setTimeout(close, 4600);
    uiRoot().append(card);
    audio.sfx(imp ? 'alarm' : 'start');
    void app;
  };
  show();
}
