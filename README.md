# Muestra de arte — sitio de fichas de obra

Este proyecto genera automáticamente una página web por cada obra, a partir
de los datos de una planilla de Google Sheets. No requiere que lo edites a
mano en el día a día: solo la primera vez, para dejarlo conectado.

Ver la guía completa paso a paso en la conversación con Claude donde se
armó este proyecto. En resumen, faltan 3 cosas para que quede funcionando:

1. Subir esta carpeta completa al repositorio de GitHub.
2. Cargar 3 "Secrets" en GitHub con los links de las planillas publicadas
   (Obras, Respuestas de formulario, Artistas).
3. Activar GitHub Pages con origen "GitHub Actions" en la configuración
   del repositorio.

A partir de ahí, el sitio se actualiza solo cada 30 minutos, y también se
puede forzar una publicación inmediata desde la pestaña "Actions" del
repositorio, botón "Run workflow".
