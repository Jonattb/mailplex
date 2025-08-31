import { MailplexCore } from './application/use-cases/MailplexCore.js';

export { MailplexConfig } from './domain/value-objects/MailplexConfig.js';
export { IMailplexCore } from './application/interfaces/IMailplexCore.js';
export { H3ServerService } from './infrastructure/services/H3ServerService.js';

export function createMailplex(): MailplexCore {
  return new MailplexCore();
}

export default createMailplex;