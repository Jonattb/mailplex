import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';

export interface ComponentFile {
  name: string;
  path: string;
  relativePath: string;
  content?: string;
}

export interface ComponentFolder {
  name: string;
  path: string;
  files: ComponentFile[];
  subfolders: ComponentFolder[];
}

export interface ComponentStructure {
  files: ComponentFile[];
  folders: ComponentFolder[];
}

export class ComponentScannerService {
  constructor(private componentsPath: string) {}

  async scanComponents(): Promise<ComponentStructure> {
    try {
      return await this.scanDirectory(this.componentsPath);
    } catch (error) {
      console.warn('Error scanning components directory:', error);
      return { files: [], folders: [] };
    }
  }

  private async scanDirectory(dirPath: string): Promise<ComponentStructure> {
    const items = await readdir(dirPath);
    const structure: ComponentStructure = { files: [], folders: [] };

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
          relativePath: relative(this.componentsPath, fullPath)
        });
      }
    }

    return structure;
  }

  async getComponentContent(relativePath: string): Promise<string | null> {
    try {
      const filePath = join(this.componentsPath, relativePath);
      return await readFile(filePath, 'utf-8');
    } catch (error) {
      console.warn('Error reading component file:', relativePath, error);
      return null;
    }
  }
}