# GoteoMed APH — Calculadora de Venoclisis (Angular PWA + Capacitor)

Aplicación móvil progresiva (PWA) orientada a **enfermería y atención prehospitalaria (APH)** para el cálculo exacto de goteo de soluciones intravenosas, con simulador de cámara de goteo en tiempo real mediante HTML5 `<canvas>` y `requestAnimationFrame()`.

## Características Principales

- **Vista de Configuración**:
  - **Volumen** en `ml` o `L` (conversión automática, valor base `500 ml`) con atajos rápidos (`100`, `250`, `500`, `1000 ml`).
  - **Tiempo** en `h` o `min` (valor base `8 h`) con atajos frecuentes (`1h`, `4h`, `8h`, `12h`, `24h`).
  - **Factor de Goteo**: Macrogotero (`10` y `15 gtt/ml`), Normogotero (`20 gtt/ml`), Microgotero (`60 gtt/ml`) y modo **Custom**.
  - **Guardar predeterminados** en `localStorage` y modo **Sincronizar goteo actual (Tap)** para medir en vivo un goteo existente.
- **Vista de Resultados y Monitorización**:
  - Fórmula clínica: `(Volumen en ml × Factor de goteo) / Tiempo en minutos`.
  - **Gotas por minuto exactas** y valor redondeado clínico.
  - **Ajuste Fino (`−` / `+`)**: emula la llave reguladora del suero recalculando dinámicamente el tiempo restante, la hora de finalización, `ml/h`, `ml/min` y el intervalo en segundos.
  - **Hora exacta de finalización** con **Alarma local (-15 min)** vía `@capacitor/local-notifications` (con respaldo Web Notifications + alerta sonora en PWA navegador).
  - **Velocidad de infusión** (`ml/h` y `ml/min`) e **intervalo entre gotas** (`60 / gotas por minuto`).
- **Cámara de Goteo en Tiempo Real (`<canvas>`)**:
  - Renderizado de alta resolución (`devicePixelRatio`) impulsado por `requestAnimationFrame()` y reloj libre de deriva (`performance.now()`), **sin animaciones CSS (`@keyframes`)**.
  - Crecimiento del menisco en boquilla, caída gravitacional acelerada, ondas concéntricas en la superficie líquida y destello en la base al impactar.
  - **Metrónomo de audio de cero latencia** con Web Audio API pura y **vibración háptica** con `@capacitor/haptics` (respaldo `navigator.vibrate()`), ambos sincronizados exactamente en el frame de impacto.
  - **Modo pantalla completa** y **Modo Oscuro automático** nativo (`dark:`) con selector manual (`Auto / Claro / Oscuro`).

## Scripts Disponibles

```bash
# Desarrollo local
npm start

# Compilación de producción (incluye Service Worker PWA)
npm run build

# Pruebas unitarias
npm test

# Compilar y sincronizar con plataformas nativas Capacitor
npm run cap:sync
```

## Empaquetado Nativo con Capacitor (Android / iOS)

```bash
npm run build
npm install @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios
npx cap sync
npx cap open android
```
