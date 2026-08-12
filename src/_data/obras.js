const fs = require("fs");
const path = require("path");

module.exports = () => {
  const archivo = path.join(__dirname, "..", "..", "data", "obras.json");
  if (!fs.existsSync(archivo)) return [];
  return JSON.parse(fs.readFileSync(archivo, "utf-8"));
};
