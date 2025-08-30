import { createApp, createRouter, eventHandler, toNodeListener, getQuery } from 'h3';
import { createServer, Server } from 'node:http';
import { Eta } from 'eta';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EmailScannerService, EmailStructure } from './EmailScannerService.js';
import { EmailPreprocessorService } from '../../domain/services/EmailPreprocessorService.js';

export class H3ServerService {
  private server?: Server;
  private app = createApp();
  private router = createRouter();
  private emailScanner?: EmailScannerService;
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

  setCustomData(customData?: { [key: string]: string | string[] | (() => string) }): void {
    this.customData = customData;
  }

  private setupRoutes(): void {
    this.router.get('/', eventHandler(async (event) => {
      if (!this.emailScanner) {
        return await this.getPreviewInterface({ files: [], folders: [] });
      }

      const query = getQuery(event);
      const emailStructure = await this.emailScanner.scanEmails();
      
      if (query.preview) {
        const content = await this.emailScanner.getEmailContent(query.preview as string);
        if (content) {
          const preprocessor = new EmailPreprocessorService();
          const processedContent = preprocessor.processTemplate(
            content,
            './emails',
            './components',
            this.customData
          );
          
          return await this.getPreviewInterface(emailStructure, query.preview as string, processedContent);
        }
      }
      
      return await this.getPreviewInterface(emailStructure);
    }));

    this.router.get('/health', eventHandler(() => {
      return { status: 'healthy', timestamp: new Date().toISOString() };
    }));
  }

  private async getPreviewInterface(emailStructure: EmailStructure, selectedEmail?: string, previewContent?: string): Promise<string> {
    const escapedContent = previewContent?.replace(/"/g, '&quot;');

    return this.eta.render('email-preview', {
      emailStructure,
      selectedEmail,
      previewContent: escapedContent
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