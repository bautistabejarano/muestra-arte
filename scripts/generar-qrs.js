// Genera un código QR por cada obra, apuntando a su página final y estable,
// y una hoja HTML de referencia con todos juntos (para identificarlos antes
// de imprimir, no para el visitante).
//
// Se ejecuta a demanda (no en cada publicación), típicamente antes de
// imprimir los QR de la muestra, o después de sumar obras nuevas.

const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

const BASE_URL = process.env.SITE_BASE_URL || "https://bautistabejarano.github.io/muestra-arte/";
const OBRAS_JSON = path.join(__dirname, "..", "data", "obras.json");
const SALIDA = path.join(__dirname, "..", "qrs");

async function main() {
  if (!fs.existsSync(OBRAS_JSON)) {
    console.error("❌ No existe data/obras.json. Corré primero 'npm run actualizar-datos'.");
    process.exit(1);
  }
  const obras = JSON.parse(fs.readFileSync(OBRAS_JSON, "utf-8"));
  if (obras.length === 0) {
    console.error("❌ No hay obras cargadas todavía. No hay nada para generar.");
    process.exit(1);
  }

  fs.mkdirSync(SALIDA, { recursive: true });

  const filasIndice = [];

  for (const obra of obras) {
    const url = `${BASE_URL}${obra.id}/`;
    const destino = path.join(SALIDA, `${obra.id}.png`);
    await QRCode.toFile(destino, url, {
      width: 800,
      margin: 2,
      color: { dark: "#111111", light: "#ffffff" },
    });
    filasIndice.push({ id: obra.id, titulo: obra.titulo, artista: obra.artista, url });
    console.log(`✅ ${obra.id} — ${obra.titulo}`);
  }

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Códigos QR — referencia para imprimir</title>
<style>
  body { font-family: sans-serif; background: #fff; padding: 2rem; }
  .grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 2rem; }
  .item { text-align: center; border: 1px solid #eee; padding: 1rem; }
  .item img { width: 100%; height: auto; }
  .item p { font-size: 0.85rem; margin: 0.5rem 0 0; }
  .item small { color: #888; }
</style></head>
<body>
  <h1>Códigos QR de la muestra (${obras.length} obras)</h1>
  <p>Esta hoja es solo para que identifiques qué QR corresponde a qué obra antes de imprimir. No se publica ni se muestra al visitante.</p>
  <div class="grilla">
    ${filasIndice
      .map(
        (f) => `<div class="item">
      <img src="${f.id}.png" alt="QR de ${f.titulo}">
      <p><strong>${f.titulo}</strong><br><small>${f.artista} — ${f.id}</small></p>
    </div>`
      )
      .join("\n")}
  </div>
</body></html>`;

  fs.writeFileSync(path.join(SALIDA, "index.html"), html);
  console.log(`\n✅ Listo: ${obras.length} códigos QR generados en la carpeta "qrs/".`);
  console.log(`   Abrí "qrs/index.html" para verlos todos juntos con su título.`);
}

main().catch((err) => {
  console.error("❌ Error generando los QR:", err);
  process.exit(1);
});
