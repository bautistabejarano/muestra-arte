// Este script se ejecuta automáticamente antes de cada publicación.
// Lee las dos planillas publicadas como CSV, combina "Obras" (edición directa)
// con "Respuestas de formulario" (altas nuevas), asigna un ID estable a cada
// obra (que nunca cambia una vez asignado) y descarga + optimiza la foto de
// cada obra para que quede guardada dentro del propio sitio (sin depender de
// Google en el momento en que un visitante escanea el QR).

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const sharp = require("sharp");

// --- CONFIGURACIÓN: completar con los 3 links "Publicar en la web" ---
const CSV_OBRAS = process.env.CSV_URL_OBRAS || "PEGAR_LINK_CSV_OBRAS_ACA";
const CSV_RESPUESTAS = process.env.CSV_URL_RESPUESTAS || "PEGAR_LINK_CSV_RESPUESTAS_ACA";
const CSV_ARTISTAS = process.env.CSV_URL_ARTISTAS || "PEGAR_LINK_CSV_ARTISTAS_ACA";
// ----------------------------------------------------------------------

const DATA_DIR = path.join(__dirname, "..", "data");
const IDS_FILE = path.join(DATA_DIR, "ids.json");
const OBRAS_JSON = path.join(DATA_DIR, "obras.json");
const IMG_DIR = path.join(__dirname, "..", "src", "img");

async function fetchCSV(url) {
  if (!url || url.startsWith("PEGAR_")) return [];
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo leer el CSV: ${url} (${res.status})`);
  const text = await res.text();
  return parse(text, { columns: true, skip_empty_lines: true, trim: true });
}

function cargarIds() {
  if (fs.existsSync(IDS_FILE)) {
    return JSON.parse(fs.readFileSync(IDS_FILE, "utf-8"));
  }
  return {};
}

function guardarIds(ids) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2));
}

function asignarId(ids, claveEstable) {
  if (ids[claveEstable]) return ids[claveEstable];
  const siguienteNumero = Object.keys(ids).length + 1;
  const nuevoId = `obra-${String(siguienteNumero).padStart(3, "0")}`;
  ids[claveEstable] = nuevoId;
  return nuevoId;
}

function extraerIdDriveDesdeUrl(url) {
  if (!url) return null;
  const patrones = [/[-\w]{25,}/]; // los ID de Drive son alfanuméricos largos
  const match = url.match(patrones[0]);
  return match ? match[0] : null;
}

function esJpgOPng(buffer) {
  const esJpg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const esPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  return esJpg || esPng;
}

async function descargarYOptimizarFoto(urlFoto, idObra) {
  const fileId = extraerIdDriveDesdeUrl(urlFoto);
  const destino = path.join(IMG_DIR, `${idObra}.jpg`);

  if (!fileId) {
    console.warn(`⚠️  No se encontró foto válida para ${idObra}, se omite.`);
    return null;
  }

  // Si ya la descargamos en una corrida anterior, no la volvemos a bajar.
  if (fs.existsSync(destino)) {
    return `/img/${idObra}.jpg`;
  }

  const urlDescarga = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const res = await fetch(urlDescarga);
  if (!res.ok) {
    console.warn(`⚠️  No se pudo descargar la foto de ${idObra} (${res.status}).`);
    return null;
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  if (!esJpgOPng(buffer)) {
    console.warn(
      `⚠️  La descarga de ${idObra}.jpg no parece ser una imagen válida (probablemente Drive devolvió una página HTML en vez de la foto). Se omite.`
    );
    return null;
  }

  fs.mkdirSync(IMG_DIR, { recursive: true });
  try {
    // Optimización automática: recorte proporcional, ancho máx. 1600px, calidad 80.
    await sharp(buffer)
      .rotate() // corrige orientación según metadata del celular
      .resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(destino);
  } catch (err) {
    console.warn(`⚠️  No se pudo procesar la foto de ${idObra}.jpg: ${err.message}`);
    return null;
  }

  return `/img/${idObra}.jpg`;
}

function normalizarPrecio(valor) {
  if (!valor) return null;
  const numero = Number(String(valor).replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

function formatearPrecio(numero) {
  if (numero === null) return null;
  return numero.toLocaleString("es-AR");
}

async function main() {
  const [filasObras, filasRespuestas, filasArtistas] = await Promise.all([
    fetchCSV(CSV_OBRAS),
    fetchCSV(CSV_RESPUESTAS),
    fetchCSV(CSV_ARTISTAS),
  ]);

  const artistasPorNombre = {};
  filasArtistas.forEach((fila) => {
    const nombre = (fila["Nombre del artista"] || "").trim();
    if (!nombre) return;
    artistasPorNombre[nombre] = {
      nombre,
      telefono: (fila["Teléfono WhatsApp"] || "").replace(/[^0-9+]/g, ""),
      bio: fila["Biografía breve"] || "",
    };
  });

  const ids = cargarIds();
  const obras = [];

  // Filas cargadas/editadas directamente en la pestaña "Obras"
  for (let i = 0; i < filasObras.length; i++) {
    const fila = filasObras[i];
    if (!fila["Título"]) continue;
    const clave = `obras-fila-${i}`;
    const idObra = asignarId(ids, clave);
    const rutaFoto = await descargarYOptimizarFoto(fila["Foto"], idObra);
    obras.push(construirObra(fila, idObra, rutaFoto, artistasPorNombre, fila["Estado"] || "Disponible"));
  }

  // Filas nuevas que llegaron por el Google Form (aún no editadas a mano)
  for (let i = 0; i < filasRespuestas.length; i++) {
    const fila = filasRespuestas[i];
    if (!fila["Título"]) continue;
    const clave = `form-fila-${i}`;
    const idObra = asignarId(ids, clave);
    const rutaFoto = await descargarYOptimizarFoto(fila["Foto de la obra"], idObra);
    obras.push(construirObra(fila, idObra, rutaFoto, artistasPorNombre, "Disponible"));
  }

  guardarIds(ids);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OBRAS_JSON, JSON.stringify(obras, null, 2));
  console.log(`✅ ${obras.length} obra(s) procesada(s).`);
}

function construirObra(fila, idObra, rutaFoto, artistasPorNombre, estado) {
  const artista = artistasPorNombre[(fila["Artista"] || "").trim()] || {
    nombre: fila["Artista"] || "",
    telefono: "",
    bio: "",
  };
  const titulo = fila["Título"] || "Sin título";
  const mensajeWhatsapp = encodeURIComponent(
    `Hola ${artista.nombre}, te escribo por la obra "${titulo}" de la muestra. ¿Me podés dar más información?`
  );
  return {
    id: idObra,
    titulo,
    anio: fila["Año"] || "",
    tecnica: fila["Técnica"] || "",
    materiales: fila["Materiales"] || "",
    dimensiones: fila["Dimensiones"] || "",
    descripcion: fila["Descripción"] || "",
    precio: formatearPrecio(normalizarPrecio(fila["Precio"])),
    estado: (estado || "Disponible").trim(),
    foto: rutaFoto || "/img/placeholder.jpg",
    artista: artista.nombre,
    artistaTelefono: artista.telefono,
    artistaWhatsappLink: artista.telefono
      ? `https://wa.me/${artista.telefono}?text=${mensajeWhatsapp}`
      : null,
  };
}

main().catch((err) => {
  console.error("❌ Error actualizando datos:", err);
  process.exit(1);
});
