import { MailplexConfig } from '../../domain/value-objects/MailplexConfig.js';

export interface IMailplexCore {
  configure(config: MailplexConfig): Promise<IMailplexCore>;
  run(): Promise<void>;
  stop(): Promise<void>;
}