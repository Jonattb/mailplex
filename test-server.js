import { createMailplex } from './dist/index.js';

// Create and configure Mailplex
const mailplex = createMailplex();

await mailplex.configure({
  paths: {
    emails: '../application/emails',
    components: '../application/components',
    engines: '../application/engines'
  },
  server: {
    port: 3000,
    host: 'localhost'
  }
});

// Start the server
await mailplex.run();