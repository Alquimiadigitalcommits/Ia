// Convierte uno o más .html de salidas/ en PDF (mismo nombre, extensión .pdf).
// Uso: node exportar.js salidas/archivo.html [más archivos...]
// Con la variable CAPTURAS=carpeta también guarda una imagen PNG por página.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  for (const archivo of process.argv.slice(2)) {
    const html = path.resolve(archivo);
    const pg = await b.newPage({ viewport: { width: 816, height: 1056 } });
    await pg.goto('file://' + html);
    await pg.evaluate(() => document.fonts.ready);
    const pdf = html.replace(/\.html$/, '.pdf');
    await pg.pdf({ path: pdf, format: 'Letter', printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    // revisa que ningún contenido se salga de su página
    const desborde = await pg.evaluate(() => [...document.querySelectorAll('main')]
      .map((m, i) => m.scrollHeight - m.clientHeight > 1 ? i + 2 : null).filter(Boolean));
    if (desborde.length) console.log('  ⚠ se desborda en págs:', desborde.join(', '));
    if (process.env.CAPTURAS) {
      const nombre = path.basename(html, '.html');
      const pages = await pg.$$('.page');
      for (let i = 0; i < pages.length; i++)
        await pages[i].screenshot({ path: `${process.env.CAPTURAS}/${nombre}-p${String(i + 1).padStart(2, '0')}.png` });
    }
    await pg.close();
    console.log('PDF →', path.basename(pdf));
  }
  await b.close();
})();
