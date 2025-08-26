import { MailplexCore } from './application/use-cases/MailplexCore';

export { MailplexConfig } from './domain/value-objects/MailplexConfig';
export { IMailplexCore } from './application/interfaces/IMailplexCore';
export { TemplateService } from './infrastructure/services/TemplateService';
export { H3ServerService } from './infrastructure/services/H3ServerService';

export function createMailplex(): MailplexCore {
  return new MailplexCore();
}

export default createMailplex;