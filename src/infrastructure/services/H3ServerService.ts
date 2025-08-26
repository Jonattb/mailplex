import { createApp, createRouter, eventHandler, toNodeListener, getQuery } from 'h3';
import { createServer, Server } from 'node:http';
import { Eta } from 'eta';
import { join } from 'node:path';
import { EmailScannerService } from './EmailScannerService';
import { EmailPreprocessorService } from '../../domain/services/EmailPreprocessorService';

export class H3ServerService {
  private server?: Server;
  private app = createApp();
  private router = createRouter();
  private emailScanner?: EmailScannerService;
  private eta: Eta;

  constructor(private port: number = 3000, private host: string = 'localhost') {
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

  private setupRoutes(): void {
    this.router.get('/', eventHandler(async (event) => {
      if (!this.emailScanner) {
        return await this.getPreviewInterface([]);
      }

      const query = getQuery(event);
      const emailFiles = await this.emailScanner.scanEmails();
      
      if (query.preview) {
        const content = await this.emailScanner.getEmailContent(query.preview as string);
        if (content) {
          const preprocessor = new EmailPreprocessorService();
          const processedContent = preprocessor.processTemplate(content);
          
          return await this.getPreviewInterface(emailFiles, query.preview as string, processedContent);
        }
      }
      
      return await this.getPreviewInterface(emailFiles);
    }));

    this.router.get('/health', eventHandler(() => {
      return { status: 'healthy', timestamp: new Date().toISOString() };
    }));
  }

  private async getPreviewInterface(emailFiles: Array<{name: string, path: string}>, selectedEmail?: string, previewContent?: string): Promise<string> {
    const escapedContent = previewContent?.replace(/"/g, '&quot;');

    return this.eta.render('email-preview', {
      emailFiles,
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