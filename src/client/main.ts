import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './styles/main.css';
import { App } from './ui/App';

const app = new App();
app.boot().catch((e) => {
  console.error(e);
  const ui = document.getElementById('ui')!;
  ui.innerHTML = `<div class="loading"><div class="logo"><span class="main">The Worst Travel</span></div><div class="lbl">No se pudo iniciar: ${String(e?.message ?? e)}</div></div>`;
});
(window as unknown as { twt: App }).twt = app;
