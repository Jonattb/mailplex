import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

export interface EmailFile {
  name: string;
  path: string;
  content?: string;
}

export class EmailScannerService {
  constructor(private emailsPath: string) {}

  async scanEmails(): Promise<EmailFile[]> {
    try {
      const files = await readdir(this.emailsPath);
      const emailFiles: EmailFile[] = [];

      for (const file of files) {
        if (extname(file) === '.html') {
          emailFiles.push({
            name: file,
            path: join(this.emailsPath, file)
          });
        }
      }

      return emailFiles;
    } catch (error) {
      console.warn('Error scanning emails directory:', error);
      return [];
    }
  }

  async getEmailContent(filename: string): Promise<string | null> {
    try {
      const filePath = join(this.emailsPath, filename);
      return await readFile(filePath, 'utf-8');
    } catch (error) {
      console.warn('Error reading email file:', filename, error);
      return null;
    }
  }
}