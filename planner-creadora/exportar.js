// Exporta bitacora.html a PDF (y capturas opcionales) con Chromium.
// Uso: node exportar.js [carpeta-capturas]
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 816, height: 1056 } });
  await pg.goto('file://' + path.resolve(__dirname, 'bitacora.html'));
  await pg.evaluate(() => document.fonts.ready);
  await pg.pdf({
    path: path.resolve(__dirname, 'Bitacora-de-Creadora.pdf'), format: 'Letter',
    printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  const shots = process.argv[2];
  if (shots) {
    const pages = await pg.$$('.page');
    for (let i = 0; i < pages.length; i++)
      await pages[i].screenshot({ path: `${shots}/p${String(i + 1).padStart(2, '0')}.png` });
    // espacio libre (px) entre el contenido y el pie de cada página; negativo = se desborda
    console.log(await pg.evaluate(() => [...document.querySelectorAll('.frame')].map((f, i) => {
      const m = f.querySelector('main'), ft = f.querySelector('.bottom');
      return m ? `${i + 1}:${Math.round(ft.getBoundingClientRect().top - m.getBoundingClientRect().bottom)}` : '';
    }).join(' ')));
  }
  await b.close();
  console.log('PDF listo → Bitacora-de-Creadora.pdf');
})();
