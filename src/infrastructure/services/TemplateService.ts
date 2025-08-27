import { Eta } from 'eta';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export class TemplateService {
  private eta: Eta;
  
  constructor(private templatesPath: string) {
    this.eta = new Eta({
      views: templatesPath,
      cache: process.env.NODE_ENV === 'production'
    });
  }

  async renderTemplate(templateName: string, data: any = {}): Promise<string> {
    try {
      const templatePath = join(this.templatesPath, `${templateName}.eta`);
      const templateContent = await readFile(templatePath, 'utf-8');
      return this.eta.renderString(templateContent, data);
    } catch (error) {
      throw new Error(`Failed to render template ${templateName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async renderString(templateString: string, data: any = {}): Promise<string> {
    return this.eta.renderString(templateString, data);
  }

}