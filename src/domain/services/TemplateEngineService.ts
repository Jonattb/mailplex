import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export interface TemplateEngine {
  name: string;
  extension: string;
  convertVariable(key: string, index?: number | null): string;
}

export class TemplateEngineService {
  private engines: Map<string, TemplateEngine> = new Map();
  
  constructor(private enginesPath: string) {}

  async loadEngines(): Promise<void> {
    try {
      const files = await readdir(this.enginesPath);
      
      for (const file of files) {
        if (file.endsWith('.js')) {
          try {
            const fullPath = join(process.cwd(), this.enginesPath, file);
            const enginePath = `file://${fullPath}`;
            const engineModule = await import(enginePath);
            const engine = engineModule.default || engineModule;
            
            if (engine && engine.name && engine.extension && engine.convertVariable) {
              this.engines.set(engine.extension, engine);
              console.log(`Loaded template engine: ${engine.name} (.${engine.extension})`);
            }
          } catch (error) {
            console.warn(`Failed to load engine ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Could not load template engines:', error);
    }
  }

  getEngine(extension: string): TemplateEngine | null {
    return this.engines.get(extension) || null;
  }

  getAvailableEngines(): Array<{extension: string, name: string}> {
    return Array.from(this.engines.values()).map(engine => ({
      extension: engine.extension,
      name: engine.name
    }));
  }

  /**
   * Convert template content to specified engine format
   * Only converts {{key, value}} directives, leaves other directives unchanged
   */
  convertToEngine(content: string, engineExtension: string): string {
    const engine = this.getEngine(engineExtension);
    if (!engine) {
      throw new Error(`Engine not found: ${engineExtension}`);
    }

    // Track loop contexts to handle indexed variables
    const loopContexts = this.findLoopContexts(content);
    
    return this.convertContent(content, engine, loopContexts);
  }

  private findLoopContexts(content: string): Array<{start: number, end: number, count: number}> {
    const loopContexts: Array<{start: number, end: number, count: number}> = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Find loop start with count
      const loopMatch = line.match(/\{\{loop\s+(\d+)\}\}/);
      if (loopMatch) {
        const loopStart = i + 1; // Line numbers are 1-based
        const count = parseInt(loopMatch[1], 10);
        
        // Find corresponding loop end
        let depth = 1;
        for (let j = i + 1; j < lines.length; j++) {
          if (/\{\{loop\s+\d+\}\}/.test(lines[j])) {
            depth++;
          } else if (/\{\{\/loop\}\}/.test(lines[j])) {
            depth--;
            if (depth === 0) {
              loopContexts.push({ start: loopStart, end: j + 1, count });
              break;
            }
          }
        }
      }
    }
    
    return loopContexts;
  }

  private convertContent(content: string, engine: TemplateEngine, loopContexts: Array<{start: number, end: number, count: number}>): string {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const lineNumber = i + 1;
      let line = lines[i];
      
      // Check if we're inside a loop
      const currentLoop = loopContexts.find(context => 
        lineNumber >= context.start && lineNumber <= context.end
      );
      
      // Convert {{key, value}} directives
      line = line.replace(/\{\{([^,}]+),\s*[^}]*\}\}/g, (match, key) => {
        const cleanKey = key.trim();
        
        if (currentLoop) {
          // Inside a loop - need to generate multiple indexed versions
          const conversions = [];
          for (let index = 1; index <= currentLoop.count; index++) {
            conversions.push(engine.convertVariable(cleanKey, index));
          }
          return conversions.join('\n' + ' '.repeat(line.indexOf(match))); // Preserve indentation
        } else {
          // Outside loop - convert normally
          return engine.convertVariable(cleanKey);
        }
      });
      
      lines[i] = line;
    }
    
    return lines.join('\n');
  }
}