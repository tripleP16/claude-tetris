---
name: weather
description: Obtiene el clima actual o el pronóstico de una ciudad/ubicación usando la API pública de wttr.in (sin necesidad de API key). Úsala cuando el usuario pregunte por el clima, temperatura, pronóstico o condiciones meteorológicas de un lugar.
---

# Weather

Obtiene información meteorológica en tiempo real para cualquier ciudad o ubicación usando el servicio público [wttr.in](https://wttr.in), que no requiere API key ni configuración previa.

## Cuándo usar esta skill

Actívala cuando el usuario pida:
- El clima actual de una ciudad ("¿qué clima hace en Madrid?")
- El pronóstico de los próximos días ("pronóstico para Buenos Aires esta semana")
- Datos meteorológicos puntuales (temperatura, humedad, viento, sensación térmica, probabilidad de lluvia)

## Ciudad por defecto

Si el usuario no especifica una ciudad, usa **Madrid** (su ciudad actual) por defecto — no preguntes ni uses ubicación por IP.

## Cómo obtener el clima

Usa `curl` contra `wttr.in` con el nombre de la ciudad (usa `+` para espacios, o entrecomillado en la URL). Ejemplos:

### Resumen corto (una línea, ideal para respuestas rápidas)
```bash
curl -s "wttr.in/Madrid?format=3"
# → Madrid: ☀️ +28°C
```

### Vista completa en texto plano (clima actual + pronóstico 3 días)
```bash
curl -s "wttr.in/Buenos+Aires?lang=es"
```
Agrega `?T` a la URL (`wttr.in/Buenos+Aires?T&lang=es`) si el terminal no soporta bien el arte ANSI, o usa `curl -s "wttr.in/Ciudad?lang=es" | cat` para forzar texto plano.

### Solo el día actual, sin arte ANSI (más legible para parsear)
```bash
curl -s "wttr.in/Ciudad?0&lang=es&T"
```

### Formato JSON (para extraer datos específicos con jq)
```bash
curl -s "wttr.in/Ciudad?format=j1"
```
Campos útiles dentro del JSON:
- `current_condition[0].temp_C` — temperatura actual en °C
- `current_condition[0].FeelsLikeC` — sensación térmica
- `current_condition[0].humidity` — humedad (%)
- `current_condition[0].windspeedKmph` — velocidad del viento
- `current_condition[0].weatherDesc[0].value` — descripción del clima
- `weather[N].date`, `weather[N].maxtempC`, `weather[N].mintempC` — pronóstico diario

Ejemplo extrayendo solo la temperatura actual:
```bash
curl -s "wttr.in/Ciudad?format=j1" | jq -r '.current_condition[0].temp_C'
```

### Ubicación por coordenadas
Si hace falta la ubicación exacta de Madrid por coordenadas:
```bash
curl -s "wttr.in/40.4168,-3.7038?format=3"
```

## Notas

- Los nombres de ciudad con espacios deben ir con `+` (ej. `New+York`) o entre comillas en la URL.
- Añade `&lang=es` para respuestas en español.
- Si `curl` no está disponible o falla la red, informa al usuario en vez de inventar datos meteorológicos.
- No hace falta ninguna API key ni variable de entorno.
