import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_CUSTOM_DATA } from '../constants/DefaultVariables.js';

export interface ValidationIssue {
  type: 'error' | 'warning';
  message: string;
  line?: number;
  column?: number;
  code: string;
}

export interface ValidationResult {
  status: 'success' | 'warning' | 'error';
  issues: ValidationIssue[];
}

export class TemplateValidatorService {
  private availableVariables: Set<string> = new Set();
  private availableComponents: Set<string> = new Set();

  constructor(
    private customData?: { [key: string]: string | string[] | (() => string) },
    private componentsPath?: string
  ) {
    this.initializeAvailableVariables();
  }

  private initializeAvailableVariables(): void {
    // Add default variables from shared custom data
    Object.keys(DEFAULT_CUSTOM_DATA).forEach(key => {
      this.availableVariables.add(key);
    });

    // Add custom data variables
    if (this.customData) {
      Object.keys(this.customData).forEach(key => {
        this.availableVariables.add(key);
      });
    }
  }

  async initializeAvailableComponents(): Promise<void> {
    if (!this.componentsPath) return;
    
    try {
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(this.componentsPath);
      
      files.forEach(file => {
        if (file.endsWith('.html')) {
          const componentName = file.replace('.html', '');
          this.availableComponents.add(componentName);
        }
      });
    } catch (error) {
      console.warn('Could not scan components directory:', error);
    }
  }

  async validateTemplate(content: string): Promise<ValidationResult> {
    console.log('=== TEMPLATE VALIDATOR DEBUG ===');
    console.log('Validating content preview:', content.substring(0, 300));
    console.log('Content length:', content.length);
    
    const issues: ValidationIssue[] = [];
    const lines = content.split('\n');

    await this.initializeAvailableComponents();

    // Track loop contexts for _index validation
    const loopContexts = this.findLoopContexts(content);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for variable references {{variable}}
      this.validateVariables(line, lineNumber, issues, loopContexts);
      
      // Check for component includes {{component "name"}}
      this.validateComponents(line, lineNumber, issues);
      
      // Check for malformed directives
      this.validateDirectives(line, lineNumber, issues);
    }

    const status = this.determineStatus(issues);
    return { status, issues };
  }

  private findLoopContexts(content: string): Array<{start: number, end: number}> {
    const loopContexts: Array<{start: number, end: number}> = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Find loop start
      if (/\{\{loop\s+\d+\}\}/.test(line)) {
        const loopStart = i + 1; // Line numbers are 1-based
        
        // Find corresponding loop end
        let depth = 1;
        for (let j = i + 1; j < lines.length; j++) {
          if (/\{\{loop\s+\d+\}\}/.test(lines[j])) {
            depth++;
          } else if (/\{\{\/loop\}\}/.test(lines[j])) {
            depth--;
            if (depth === 0) {
              loopContexts.push({ start: loopStart, end: j + 1 });
              break;
            }
          }
        }
      }
    }
    
    return loopContexts;
  }

  private validateVariables(line: string, lineNumber: number, issues: ValidationIssue[], loopContexts: Array<{start: number, end: number}>): void {
    // Match {{variable}} or {{variable, display_name}}
    const variablePattern = /\{\{([^}]+)\}\}/g;
    let match;

    while ((match = variablePattern.exec(line)) !== null) {
      const fullMatch = match[1].trim();
      const column = match.index;

      // Skip framework directives (component, layout, loop, etc.)
      if (fullMatch.startsWith('component ') || 
          fullMatch.startsWith('layout ') || 
          fullMatch.startsWith('loop ') ||
          fullMatch.startsWith('/layout') ||
          fullMatch.startsWith('/loop') ||
          fullMatch === 'content' ||
          fullMatch.startsWith('include ')) {
        continue;
      }

      // Special handling for _index and _index1 - only valid inside loops
      if (fullMatch === '_index' || fullMatch === '_index1') {
        const isInsideLoop = loopContexts.some(context => 
          lineNumber >= context.start && lineNumber <= context.end
        );
        
        if (!isInsideLoop) {
          issues.push({
            type: 'error',
            message: `'${fullMatch}' can only be used inside {{loop}} blocks`,
            line: lineNumber,
            column,
            code: `{{${fullMatch}}}`
          });
        }
        continue;
      }

      // Handle variable with value: {{key, value}}
      if (fullMatch.includes(',')) {
        const [key, value] = fullMatch.split(',').map(s => s.trim());
        
        // The key is just for internal use, don't validate it
        // Only validate the value part
        if (value) {
          // Check if value is a quoted string
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            // Quoted string - this is fine, it's a literal value
          } else if (/^\d+(\.\d+)?$/.test(value)) {
            // It's a number - this is fine
          } else {
            // It should be a custom data variable
            if (!this.availableVariables.has(value)) {
              issues.push({
                type: 'warning',
                message: `Value '${value}' is not defined in custom data`,
                line: lineNumber,
                column,
                code: `{{${fullMatch}}}`
              });
            }
          }
        }
      } else {
        // Simple variable reference - validate against custom data
        if (!this.availableVariables.has(fullMatch)) {
          issues.push({
            type: 'warning',
            message: `Variable '${fullMatch}' is not defined in custom data`,
            line: lineNumber,
            column,
            code: `{{${fullMatch}}}`
          });
        }
      }
    }
  }

  private validateComponents(line: string, lineNumber: number, issues: ValidationIssue[]): void {
    // Match {{component "component-name"}}
    const componentPattern = /\{\{\s*component\s+(["']?)([^"'\s}]+)\1\s*\}\}/g;
    let match;

    while ((match = componentPattern.exec(line)) !== null) {
      const componentName = match[2];
      const column = match.index;

      if (!this.availableComponents.has(componentName)) {
        issues.push({
          type: 'error',
          message: `Component '${componentName}' does not exist`,
          line: lineNumber,
          column,
          code: match[0]
        });
      }
    }

    // Check for malformed component directives
    const malformedComponentPattern = /\{\{\s*component\s+([^}]*)\}\}/g;
    let malformedMatch;

    while ((malformedMatch = malformedComponentPattern.exec(line)) !== null) {
      const componentContent = malformedMatch[1].trim();
      const column = malformedMatch.index;

      // Check if it's not properly quoted
      if (!componentContent.match(/^(["'][^"']+["']|[a-zA-Z0-9_-]+)$/)) {
        issues.push({
          type: 'error',
          message: `Malformed component directive: component name must be quoted or a valid identifier`,
          line: lineNumber,
          column,
          code: malformedMatch[0]
        });
      }
    }
  }

  private validateDirectives(line: string, lineNumber: number, issues: ValidationIssue[]): void {
    // Check for unknown directives
    const directivePattern = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let match;

    while ((match = directivePattern.exec(line)) !== null) {
      const directive = match[1];
      const column = match.index;

      // Known framework directives
      const knownDirectives = ['component', 'layout', 'loop', 'include', 'content', '_index', '_index1'];
      
      // If it contains a space or comma, it's likely a variable reference, skip
      const restOfMatch = line.substring(match.index + match[0].length);
      const endIndex = line.indexOf('}}', match.index);
      const fullDirective = endIndex !== -1 
        ? line.substring(match.index, endIndex + 2)
        : line.substring(match.index); // Include the rest of line if no closing braces
      
      if (fullDirective.includes(',') || 
          knownDirectives.includes(directive) || 
          this.availableVariables.has(directive)) {
        continue;
      }

      // Check if it looks like an unknown directive
      if (directive && !this.availableVariables.has(directive)) {
        // Try to find the full directive including potential incomplete content
        let directiveCode = fullDirective;
        
        // If fullDirective is incomplete or empty, try to capture more context
        if (!directiveCode || directiveCode.length < 3) {
          // Find the opening {{ and try to get more content
          const openIndex = line.indexOf('{{');
          if (openIndex !== -1) {
            const remainingLine = line.substring(openIndex);
            const closeIndex = remainingLine.indexOf('}}');
            if (closeIndex !== -1) {
              directiveCode = remainingLine.substring(0, closeIndex + 2);
            } else {
              // If no closing braces, show what we have
              directiveCode = remainingLine;
            }
          }
        }
        
        issues.push({
          type: 'warning',
          message: `Unknown directive or variable '${directive}'`,
          line: lineNumber,
          column,
          code: directiveCode
        });
      }
    }

    // Check for mismatched braces (this covers both incomplete and mismatched cases)
    const openBraces = (line.match(/\{\{/g) || []).length;
    const closeBraces = (line.match(/\}\}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      const incompleteMatch = line.match(/\{\{[^}]*$/);
      if (incompleteMatch) {
        // Incomplete directive at end of line
        issues.push({
          type: 'error',
          message: 'Incomplete directive: missing closing braces',
          line: lineNumber,
          column: line.lastIndexOf('{{'),
          code: line.substring(line.lastIndexOf('{{'))
        });
      } else {
        // Other brace mismatches
        issues.push({
          type: 'error',
          message: `Mismatched braces: ${openBraces} opening, ${closeBraces} closing`,
          line: lineNumber,
          column: 0,
          code: line.trim()
        });
      }
    }
  }

  private determineStatus(issues: ValidationIssue[]): 'success' | 'warning' | 'error' {
    const hasErrors = issues.some(issue => issue.type === 'error');
    const hasWarnings = issues.some(issue => issue.type === 'warning');

    if (hasErrors) return 'error';
    if (hasWarnings) return 'warning';
    return 'success';
  }
}