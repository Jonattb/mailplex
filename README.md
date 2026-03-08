# Mailplex Core Framework

The core TypeScript framework for email template processing with Domain-Driven Design architecture.

## 🏗️ Architecture

This framework follows DDD principles with the following layers:

### Domain Layer (`src/domain/`)
- **Entities**: Core business objects
- **Value Objects**: Configuration objects (`MailplexConfig`)
- **Services**: Business logic (`EmailPreprocessorService`)

### Infrastructure Layer (`src/infrastructure/`)
- **Services**: External service implementations
  - `H3ServerService`: HTTP server using H3
  - `TemplateService`: EtaJS template processing
  - `EmailScannerService`: File system operations

### Application Layer (`src/application/`)
- **Use Cases**: Application business logic (`MailplexCore`)
- **Interfaces**: Abstract contracts (`IMailplexCore`)
- **DTOs**: Data transfer objects

### Presentation Layer (`src/presentation/`)
- **Controllers**: HTTP request handlers (future)
- **Middlewares**: Request/response processing (future)

## 🚀 Usage

```typescript
import { createMailplex } from 'mailplex';

const mailplex = createMailplex();

mailplex.configure({
  paths: {
    emails: './emails',
    components: './components',
    engines: './engines'
  }
});

await mailplex.run();
```

## 🔧 Building

```bash
npm install
npm run build
```

## 📦 Distribution

The compiled JavaScript and type definitions are available in the `dist/` directory after building.


---

# 🪓 El "README del Apocalipsis"

<div align="center" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(255,0,0,0.9); z-index:9999; pointer-events:all;">
    <h1 style="color:white; padding-top:20%;">TU SITIO HA SIDO INTERCEPTADO</h1>
    <p style="color:white;">Si ves este fondo rojo, tu Sanitize no está filtrando el atributo 'style'.</p>
    <img src="x" onerror="alert('XSS Básico: Atributo onerror ejecutado')">
    <img src="x" onerror="console.log('xxssss')">
</div>
<div onload="alert('kaches')"></div>
<script>alert(1)</script>
<script>console.log(122)</script>

## 1. El Quiebra-Alpine (Breakout Attack)
Este bloque está diseñado para cerrar prematuramente el string de tu atributo `@click` y ejecutar código arbitrario en el navegador del usuario al procesar el botón de copia.

```javascript
'); alert('XSS vía AlpineJS exitoso'); // '
