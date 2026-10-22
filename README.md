# Barrunto

Juego diario de palabras en español: una palabra oculta de 5 letras, 6 filas y 6 definiciones. Cada definición acertada se colorea contra la palabra oculta, como en Wordle. PWA estática, sin paso de compilación, lista para GitHub Pages.

## Estructura

- `index.html`, `css/estilos.css`, `js/app.js`: interfaz.
- `js/logica.js`: lógica pura (puntuación, normalización, elección de partida, texto para compartir, estadísticas).
- `barrunto-partidas.json`: las partidas, una por fecha.
- `sw.js`, `manifest.webmanifest`, `icons/`, `favicon.ico`: PWA.
- `tests/pruebas.test.js`: pruebas con Node.

## Añadir partidas

Añade objetos a `partidas` en `barrunto-partidas.json` con `numero`, `fecha` (AAAA-MM-DD), `palabra` y 6 `definiciones` (`{pista, respuesta}`). No hace falta tocar el código. Comprueba después que todo es válido:

```sh
node --test tests/*.test.js
```

## Probar en local

```sh
python3 -m http.server 8000
```

Abre `http://localhost:8000/`. Para jugar la partida de otro día, añade `?fecha=2026-10-25`.

## Publicar

Activa GitHub Pages en la rama `main` (carpeta raíz). Si cambias HTML, CSS, JS o iconos, sube `VERSION` en `sw.js` para que los jugadores reciban la nueva versión; las partidas se actualizan solas (red primero).
