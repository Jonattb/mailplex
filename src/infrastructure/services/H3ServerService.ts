import { createApp, createRouter, eventHandler, toNodeListener, getQuery } from 'h3';
import { createServer, Server } from 'node:http';
import { EmailScannerService } from './EmailScannerService';
import { EmailPreprocessorService } from '../../domain/services/EmailPreprocessorService';

export class H3ServerService {
  private server?: Server;
  private app = createApp();
  private router = createRouter();
  private emailScanner?: EmailScannerService;

  constructor(private port: number = 3000, private host: string = 'localhost') {
    this.setupRoutes();
    this.app.use(this.router);
  }

  setEmailsPath(emailsPath: string): void {
    this.emailScanner = new EmailScannerService(emailsPath);
  }

  private setupRoutes(): void {
    this.router.get('/', eventHandler(async (event) => {
      if (!this.emailScanner) {
        return this.getPreviewInterface([]);
      }

      const query = getQuery(event);
      const emailFiles = await this.emailScanner.scanEmails();
      
      if (query.preview) {
        const content = await this.emailScanner.getEmailContent(query.preview as string);
        if (content) {
          const preprocessor = new EmailPreprocessorService();
          const processedContent = preprocessor.processTemplate(content);
          
          return this.getPreviewInterface(emailFiles, query.preview as string, processedContent);
        }
      }
      
      return this.getPreviewInterface(emailFiles);
    }));

    this.router.get('/health', eventHandler(() => {
      return { status: 'healthy', timestamp: new Date().toISOString() };
    }));
  }

  private getPreviewInterface(emailFiles: Array<{name: string, path: string}>, selectedEmail?: string, previewContent?: string): string {
    const emailList = emailFiles.map(file => 
      `<li><a href="/?preview=${file.name}" class="${selectedEmail === file.name ? 'active' : ''}">${file.name}</a></li>`
    ).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mailplex - Email Preview</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .container { display: flex; height: 100vh; }
        .sidebar { width: 300px; background: #f5f5f5; border-right: 1px solid #ddd; overflow-y: auto; }
        .preview { flex: 1; background: white; overflow-y: auto; }
        .sidebar h2 { padding: 20px; background: #333; color: white; margin: 0; }
        .sidebar ul { list-style: none; }
        .sidebar li { border-bottom: 1px solid #ddd; }
        .sidebar a { display: block; padding: 15px 20px; text-decoration: none; color: #333; }
        .sidebar a:hover { background: #e9e9e9; }
        .sidebar a.active { background: #007acc; color: white; }
        .preview-content { padding: 20px; }
        .no-preview { color: #666; text-align: center; margin-top: 50px; }
        iframe { width: 100%; height: calc(100vh - 40px); border: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="sidebar">
            <h2>Email Templates</h2>
            <ul>
                ${emailList || '<li style="padding: 20px; color: #666;">No email templates found</li>'}
            </ul>
        </div>
        <div class="preview">
            ${previewContent ? 
                `<iframe srcdoc="${previewContent.replace(/"/g, '&quot;')}"></iframe>` :
                '<div class="no-preview">Select an email template to preview</div>'
            }
        </div>
    </div>
</body>
</html>`;
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