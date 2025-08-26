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