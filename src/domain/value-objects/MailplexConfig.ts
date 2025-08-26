export interface MailplexConfig {
  paths: {
    emails: string;
    components: string;
    engines: string;
  };
  server?: {
    port?: number;
    host?: string;
  };
}

export class MailplexConfigValidator {
  static validate(config: MailplexConfig): void {
    if (!config.paths) {
      throw new Error('Paths configuration is required');
    }
    
    if (!config.paths.emails || !config.paths.components || !config.paths.engines) {
      throw new Error('All paths (emails, components, engines) must be specified');
    }
  }
}