import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';

export interface EmailFile {
  name: string;
  path: string;
  relativePath: string;
  content?: string;
}

export interface EmailFolder {
  name: string;
  path: string;
  files: EmailFile[];
  subfolders: EmailFolder[];
}

export interface EmailStructure {
  files: EmailFile[];
  folders: EmailFolder[];
}

export class EmailScannerService {
  constructor(private emailsPath: string) {}

  async scanEmails(): Promise<EmailStructure> {
    try {
      return await this.scanDirectory(this.emailsPath);
    } catch (error) {
      console.warn('Error scanning emails directory:', error);
      return { files: [], folders: [] };
    }
  }

  private async scanDirectory(dirPath: string): Promise<EmailStructure> {
    const items = await readdir(dirPath);
    const structure: EmailStructure = { files: [], folders: [] };

    for (const item of items) {
      const fullPath = join(dirPath, item);
      const itemStat = await stat(fullPath);

      if (itemStat.isDirectory()) {
        const folderStructure = await this.scanDirectory(fullPath);
        structure.folders.push({
          name: item,
          path: fullPath,
          files: folderStructure.files,
          subfolders: folderStructure.folders
        });
      } else if (extname(item) === '.html') {
        structure.files.push({
          name: item,
          path: fullPath,
          relativePath: relative(this.emailsPath, fullPath)
        });
      }
    }

    return structure;
  }


  async getEmailContent(relativePath: string): Promise<string | null> {
    try {
      const filePath = join(this.emailsPath, relativePath);
      return await readFile(filePath, 'utf-8');
    } catch (error) {
      console.warn('Error reading email file:', relativePath, error);
      return null;
    }
  }
}