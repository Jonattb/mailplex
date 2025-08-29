import { IMailplexCore } from '../interfaces/IMailplexCore.js';
import { MailplexConfig, MailplexConfigValidator } from '../../domain/value-objects/MailplexConfig.js';
import { H3ServerService } from '../../infrastructure/services/H3ServerService.js';
import { TemplateService } from '../../infrastructure/services/TemplateService.js';

export class MailplexCore implements IMailplexCore {
  private config?: MailplexConfig;
  private serverService?: H3ServerService;
  private templateService?: TemplateService;

  configure(config: MailplexConfig): IMailplexCore {
    MailplexConfigValidator.validate(config);
    this.config = config;
    
    // Initialize services with configuration
    this.serverService = new H3ServerService(
      config.server?.port || 3000,
      config.server?.host || 'localhost'
    );
    
    this.templateService = new TemplateService(config.paths.emails);
    this.serverService.setEmailsPath(config.paths.emails);
    
    console.log('Mailplex configured with paths:', config.paths);
    return this;
  }

  async run(): Promise<void> {
    if (!this.config) {
      throw new Error('Mailplex must be configured before running. Call configure() first.');
    }

    if (!this.serverService) {
      throw new Error('Server service not initialized');
    }

    await this.serverService.start();
    console.log('Mailplex is running...');
  }

  async stop(): Promise<void> {
    if (this.serverService) {
      await this.serverService.stop();
    }
  }

}