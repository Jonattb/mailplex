// import { faker } from '@faker-js/faker';
import { fakerDE as faker } from '@faker-js/faker';

export class EmailPreprocessorService {

  processTemplate(template: string): string {
    try {
      return this.processPrintDirectives(template);
    } catch (error) {
      console.error('Preprocessor error:', error);
      return template;
    }
  }

  private processPrintDirectives(template: string): string {
    // Use a custom parser to handle nested braces properly
    const results: string[] = [];
    let i = 0;
    
    while (i < template.length) {
      const start = template.indexOf('{{', i);
      if (start === -1) {
        results.push(template.substring(i));
        break;
      }
      
      // Add text before directive
      results.push(template.substring(i, start));
      
      // Find the end of the directive, accounting for nested braces
      const end = this.findDirectiveEnd(template, start);
      if (end === -1) {
        results.push(template.substring(start));
        break;
      }
      
      const directive = template.substring(start, end + 2); // +2 for }}
      const pipeIndex = directive.indexOf('|');
      
      if (pipeIndex !== -1) {
        const key = directive.substring(2, pipeIndex); // Remove {{
        const methodExpression = directive.substring(pipeIndex + 1, directive.length - 2); // Remove }}
        
        try {
          const result = this.processMethodExpression(methodExpression);
          results.push(result);
        } catch (error) {
          console.warn(`Error processing directive ${directive}:`, error);
          results.push(directive);
        }
      } else {
        results.push(directive);
      }
      
      i = end + 2;
    }
    
    return results.join('');
  }

  private findDirectiveEnd(template: string, start: number): number {
    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = start + 2; i < template.length - 1; i++) {
      const char = template[i];
      const nextChar = template[i + 1];
      
      if (!inString) {
        if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
        } else if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          if (braceCount > 0) {
            braceCount--;
          } else if (nextChar === '}') {
            return i;
          }
        }
      } else {
        if (char === stringChar && template[i - 1] !== '\\') {
          inString = false;
        }
      }
    }
    
    return -1;
  }

  private processMethodExpression(expression: string): string {
    // Check if expression has parameters (contains parentheses)
    if (expression.includes('(')) {
      return this.processFakerMethodWithParams(expression);
    }
    
    // Handle regular faker methods without parameters (faker.method)
    const methodParts = expression.split('.');
    let currentMethod: any = faker;
    
    for (const part of methodParts) {
      if (currentMethod && typeof currentMethod === 'object' && part in currentMethod) {
        currentMethod = currentMethod[part];
      } else {
        throw new Error(`Method ${expression} not found in faker`);
      }
    }
    
    if (typeof currentMethod === 'function') {
      return String(currentMethod());
    } else {
      throw new Error(`${expression} is not a function`);
    }
  }

  private processFakerMethodWithParams(expression: string): string {
    // Extract method path and parameters
    const methodMatch = expression.match(/^([^(]+)\((.*)\)$/);
    if (!methodMatch) {
      throw new Error(`Invalid method expression: ${expression}`);
    }

    const methodPath = methodMatch[1];
    const paramsString = methodMatch[2];
    
    // Navigate to the method in faker object
    const methodParts = methodPath.split('.');
    let currentMethod: any = faker;
    
    for (const part of methodParts) {
      if (currentMethod && typeof currentMethod === 'object' && part in currentMethod) {
        currentMethod = currentMethod[part];
      } else {
        throw new Error(`Method ${methodPath} not found in faker`);
      }
    }

    if (typeof currentMethod !== 'function') {
      throw new Error(`${methodPath} is not a function`);
    }

    if (!paramsString.trim()) {
      return String(currentMethod());
    }

    try {
      // Parse parameters
      const params = this.parseParameters(paramsString);
      return String(currentMethod(...params));
    } catch (error) {
      console.warn(`Error parsing parameters for ${expression}:`, error);
      return String(currentMethod());
    }
  }

  private parseParameters(paramsString: string): any[] {
    // Handle complex parameter parsing
    const params: any[] = [];
    let currentParam = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < paramsString.length; i++) {
      const char = paramsString[i];
      
      if (!inString) {
        if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
          currentParam += char;
        } else if (char === '[' || char === '{') {
          depth++;
          currentParam += char;
        } else if (char === ']' || char === '}') {
          depth--;
          currentParam += char;
        } else if (char === ',' && depth === 0) {
          // Found parameter separator at root level
          params.push(this.parseValue(currentParam.trim()));
          currentParam = '';
        } else {
          currentParam += char;
        }
      } else {
        currentParam += char;
        if (char === stringChar && paramsString[i - 1] !== '\\') {
          inString = false;
        }
      }
    }
    
    // Add the last parameter
    if (currentParam.trim()) {
      params.push(this.parseValue(currentParam.trim()));
    }
    
    return params;
  }

  private parseValue(value: string): any {
    value = value.trim();
    
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch {
      // If JSON parsing fails, return as string (removing quotes if present)
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
      }
      return value;
    }
  }
}