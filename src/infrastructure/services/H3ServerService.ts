import { createApp, createRouter, eventHandler, toNodeListener, getQuery, readBody } from 'h3';
import { createServer, Server } from 'node:http';
import { Eta } from 'eta';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EmailScannerService, EmailStructure } from './EmailScannerService.js';
import { ComponentScannerService, ComponentStructure } from './ComponentScannerService.js';
import { EmailPreprocessorService } from '../../domain/services/EmailPreprocessorService.js';
import { ValidationResult } from '../../domain/services/TemplateValidatorService.js';
import { TemplateEngineService } from '../../domain/services/TemplateEngineService.js';

export class H3ServerService {
  private server?: Server;
  private app = createApp();
  private router = createRouter();
  private emailScanner?: EmailScannerService;
  private componentScanner?: ComponentScannerService;
  private templateEngineService?: TemplateEngineService;
  private eta: Eta;
  private customData?: { [key: string]: string | string[] | (() => string) };

  constructor(private port: number = 3000, private host: string = 'localhost') {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    
    this.eta = new Eta({ 
      views: join(__dirname, '../../../templates'),
      cache: false
    });
    this.setupRoutes();
    this.app.use(this.router);
  }

  setEmailsPath(emailsPath: string): void {
    this.emailScanner = new EmailScannerService(emailsPath);
  }

  setComponentsPath(componentsPath: string): void {
    this.componentScanner = new ComponentScannerService(componentsPath);
  }

  async setEnginesPath(enginesPath: string): Promise<void> {
    this.templateEngineService = new TemplateEngineService(enginesPath);
    await this.templateEngineService.loadEngines();
  }

  setCustomData(customData?: { [key: string]: string | string[] | (() => string) }): void {
    this.customData = customData;
  }


  private setupRoutes(): void {
    this.router.get('/', eventHandler(async (event) => {
      const query = getQuery(event);
      const activeTab = (query.tab as string) || 'emails';
      
      // Handle raw content requests for engine conversion
      if (query.raw === 'true' && query.preview) {
        if (activeTab === 'components' && this.componentScanner) {
          const content = await this.componentScanner.getComponentContent(query.preview as string);
          return content || 'Template not found';
        } else if (activeTab === 'emails' && this.emailScanner) {
          const content = await this.emailScanner.getEmailContent(query.preview as string);
          return content || 'Template not found';
        }
        return 'Scanner not available';
      }

      // Handle rendered content requests for copy functionality
      if (query.rendered === 'true' && query.preview) {
        const scanner = activeTab === 'components' ? this.componentScanner : this.emailScanner;
        const getContent = activeTab === 'components' 
          ? (scanner as ComponentScannerService)?.getComponentContent.bind(scanner)
          : (scanner as EmailScannerService)?.getEmailContent.bind(scanner);

        if (scanner && getContent) {
          const content = await getContent(query.preview as string);
          if (content) {
            // Process template for rendering (same as preview but return just the content)
            const preprocessor = new EmailPreprocessorService();
            const processedContent = preprocessor.processTemplate(
              content,
              './emails',
              './components',
              this.customData
            );
            return processedContent;
          }
        }
        return 'Template not found';
      }

      // Handle partial content requests (processed structures but preserve variables for engine conversion)
      if (query.partial === 'true' && query.preview) {
        const scanner = activeTab === 'components' ? this.componentScanner : this.emailScanner;
        const getContent = activeTab === 'components' 
          ? (scanner as ComponentScannerService)?.getComponentContent.bind(scanner)
          : (scanner as EmailScannerService)?.getEmailContent.bind(scanner);

        if (scanner && getContent) {
          const content = await getContent(query.preview as string);
          if (content) {
            // Process only structural directives, preserve {{key, value}} for engine conversion
            const preprocessor = new EmailPreprocessorService();
            const partialContent = preprocessor.processStructuralOnly(
              content,
              './emails',
              './components',
              this.customData
            );
            return partialContent;
          }
        }
        return 'Template not found';
      }

      // Handle engine conversion requests
      if (query.engine && query.preview) {
        const scanner = activeTab === 'components' ? this.componentScanner : this.emailScanner;
        const getContent = activeTab === 'components' 
          ? (scanner as ComponentScannerService)?.getComponentContent.bind(scanner)
          : (scanner as EmailScannerService)?.getEmailContent.bind(scanner);

        if (scanner && getContent && this.templateEngineService) {
          const content = await getContent(query.preview as string);
          if (content) {
            try {
              // First process structure directives (layouts, includes, loops)
              const preprocessor = new EmailPreprocessorService();
              const structurallyProcessed = preprocessor.processStructuralOnly(
                content,
                './emails',
                './components',
                this.customData
              );
              
              // Then inline CSS for email compatibility (before engine conversion)
              const contentWithInlineStyles = preprocessor.inlineCssAndCleanup(structurallyProcessed);
              
              // Finally convert to engine format
              const engineContent = this.templateEngineService.convertToEngine(
                contentWithInlineStyles, 
                query.engine as string
              );
                
              return engineContent;
            } catch (error) {
              return `Engine conversion error: ${error}`;
            }
          }
        }
        return 'Template not found';
      }

      
      if (activeTab === 'components') {
        if (!this.componentScanner) {
          return await this.getPreviewInterface({ files: [], folders: [] }, undefined, undefined, 'components');
        }

        const componentStructure = await this.componentScanner.scanComponents();
        
        if (query.preview) {
          const content = await this.componentScanner.getComponentContent(query.preview as string);
          if (content) {
            // Validate ONLY the original content before processing
            const { TemplateValidatorService } = await import('../../domain/services/TemplateValidatorService.js');
            const validator = new TemplateValidatorService(this.customData, './components');
            const validation = await validator.validateTemplate(content);
            
            // Process template for rendering
            const preprocessor = new EmailPreprocessorService();
            const processedContent = preprocessor.processTemplate(
              content,
              './emails',
              './components',
              this.customData
            );
            
            return await this.getPreviewInterface(componentStructure, query.preview as string, processedContent, 'components', validation);
          }
        }
        
        return await this.getPreviewInterface(componentStructure, undefined, undefined, 'components');
      } else {
        if (!this.emailScanner) {
          return await this.getPreviewInterface({ files: [], folders: [] }, undefined, undefined, 'emails');
        }

        const emailStructure = await this.emailScanner.scanEmails();
        
        if (query.preview) {
          const content = await this.emailScanner.getEmailContent(query.preview as string);
          if (content) {
            // Validate ONLY the original content before processing
            const { TemplateValidatorService } = await import('../../domain/services/TemplateValidatorService.js');
            const validator = new TemplateValidatorService(this.customData, './components');
            const validation = await validator.validateTemplate(content);
            
            // Process template for rendering
            const preprocessor = new EmailPreprocessorService();
            const processedContent = preprocessor.processTemplate(
              content,
              './emails',
              './components',
              this.customData
            );
            
            return await this.getPreviewInterface(emailStructure, query.preview as string, processedContent, 'emails', validation);
          }
        }
        
        return await this.getPreviewInterface(emailStructure, undefined, undefined, 'emails');
      }
    }));

    this.router.get('/health', eventHandler(() => {
      return { status: 'healthy', timestamp: new Date().toISOString() };
    }));

    this.router.post('/convert-engine', eventHandler(async (event) => {
      try {
        const body = await readBody(event);
        const { content, engine } = body;

        if (!content || !engine) {
          return {
            success: false,
            error: 'Missing content or engine parameter'
          };
        }

        if (!this.templateEngineService) {
          return {
            success: false,
            error: 'Template engine service not available'
          };
        }

        // First inline CSS styles for email compatibility (before engine conversion)
        const preprocessor = new EmailPreprocessorService();
        const contentWithInlineStyles = preprocessor.inlineCssAndCleanup(content);
        
        // Then convert to engine format
        const convertedContent = this.templateEngineService.convertToEngine(contentWithInlineStyles, engine);
        
        return {
          success: true,
          content: convertedContent
        };
      } catch (error) {
        console.error('Engine conversion error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }));
  }

  private async getPreviewInterface(structure: EmailStructure | ComponentStructure, selectedItem?: string, previewContent?: string, activeTab: string = 'emails', validation?: ValidationResult): Promise<string> {
    const escapedContent = previewContent?.replace(/"/g, '&quot;');
    const availableEngines = this.templateEngineService?.getAvailableEngines() || [];

    return this.eta.render('email-preview', {
      structure,
      selectedItem,
      previewContent: escapedContent,
      activeTab,
      validation,
      engines: availableEngines
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(toNodeListener(this.app));
        this.server.listen(this.port, this.host, () => {
          console.log(`Mailplex server running at http://${this.host}:${this.port}`);
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Mailplex server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getRouter() {
    return this.router;
  }
}