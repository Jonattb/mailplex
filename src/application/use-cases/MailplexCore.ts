import { IMailplexCore } from '../interfaces/IMailplexCore.js';
import { MailplexConfig, MailplexConfigValidator } from '../../domain/value-objects/MailplexConfig.js';
import { H3ServerService } from '../../infrastructure/services/H3ServerService.js';
import { TemplateService } from '../../infrastructure/services/TemplateService.js';

export class MailplexCore implements IMailplexCore {
  private config?: MailplexConfig;
  private serverService?: H3ServerService;
  private templateService?: TemplateService;

  async configure(config: MailplexConfig): Promise<IMailplexCore> {
    MailplexConfigValidator.validate(config);
    this.config = config;
    
    // Initialize services with configuration
    this.serverService = new H3ServerService(
      config.server?.port || 3000,
      config.server?.host || 'localhost'
    );
    
    this.templateService = new TemplateService(config.paths.emails);
    this.serverService.setEmailsPath(config.paths.emails);
    this.serverService.setComponentsPath(config.paths.components);
    await this.serverService.setEnginesPath(config.paths.engines);
    this.serverService.setCustomData(config.data);
    
    console.log('Mailplex configured with paths:', config.paths);
    if (config.data) {
      console.log('Custom data configured:', Object.keys(config.data));
    }
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