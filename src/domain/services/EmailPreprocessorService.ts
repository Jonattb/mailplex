export interface DefaultData {
  [key: string]: any;
}

export class EmailPreprocessorService {
  private defaultData: DefaultData = {};
  private variableStack: DefaultData[] = [];

  processTemplate(template: string): string {
    try {
      // Extract and parse default data
      this.extractDefaultData(template);
      
      // Remove default block from template  
      template = this.removeDefaultBlock(template);
      
      // Process directives multiple times until stable
      let iterations = 0;
      let prevTemplate = '';
      
      while (prevTemplate !== template && iterations < 15) {  // Increased iterations for nested structures
        prevTemplate = template;
        
        // Process each type of directive - loops first, then conditions, then variables
        template = this.processEachDirectives(template);
        template = this.processSimpleIfDirectives(template);
        template = this.processVariables(template);
        
        iterations++;
      }
      
      return template;
    } catch (error) {
      console.error('Preprocessor error:', error);
      return template;
    }
  }

  private extractDefaultData(template: string): void {
    const defaultRegex = /\{default\}([\s\S]*?)\{\/default\}/;
    const match = defaultRegex.exec(template);
    
    if (match) {
      try {
        const defaultContent = match[1].trim();
        const func = new Function(`return ${defaultContent}`);
        this.defaultData = func();
      } catch (error) {
        console.warn('Error parsing default data:', error);
        this.defaultData = {};
      }
    }
  }

  private removeDefaultBlock(template: string): string {
    return template.replace(/\{default\}[\s\S]*?\{\/default\}/g, '');
  }

  private processVariables(template: string): string {
    // Replace simple variables like {name}
    return template.replace(/\{(\w+(?:\.\w+)*)\}/g, (match, path) => {
      const value = this.getValue(path);
      return value !== undefined ? String(value) : match;
    });
  }

  private processSimpleIfDirectives(template: string): string {
    // Process if directives from innermost to outermost to handle nesting
    let processedTemplate = template;
    let hasMatches = true;
    let maxIterations = 20;
    
    while (hasMatches && maxIterations > 0) {
      hasMatches = false;
      maxIterations--;
      
      // Find the innermost if directive (one that doesn't contain another if)
      const match = this.findInnermostIf(processedTemplate);
      
      if (match) {
        hasMatches = true;
        const { fullMatch, condition, content } = match;
        
        try {
          const conditionResult = this.evaluateCondition(condition.trim());
          const replacement = conditionResult ? content : '';
          processedTemplate = processedTemplate.replace(fullMatch, replacement);
        } catch (error) {
          console.warn('Error in if condition:', condition, error);
          processedTemplate = processedTemplate.replace(fullMatch, '');
        }
      }
    }
    
    return processedTemplate;
  }

  private findInnermostIf(template: string): { fullMatch: string, condition: string, content: string } | null {
    // Find the first if that doesn't contain any other if inside it (truly innermost)
    let pos = 0;
    
    while (pos < template.length) {
      const ifPos = template.indexOf('{if ', pos);
      if (ifPos === -1) break;
      
      // Extract condition for this if
      const conditionStart = ifPos + 4; // '{if '.length
      const conditionEnd = template.indexOf('}', conditionStart);
      if (conditionEnd === -1) {
        pos = ifPos + 1;
        continue;
      }
      
      const condition = template.substring(conditionStart, conditionEnd);
      const contentStart = conditionEnd + 1; // '}'.length
      
      // Find the matching /if using brace counting
      let braceCount = 1;
      let currentPos = contentStart;
      let endIfPos = -1;
      
      while (currentPos < template.length && braceCount > 0) {
        if (template.substring(currentPos, currentPos + 4) === '{if ') {
          braceCount++;
          currentPos += 4;
        } else if (template.substring(currentPos, currentPos + 5) === '{/if}') {
          braceCount--;
          if (braceCount === 0) {
            endIfPos = currentPos;
            break;
          }
          currentPos += 5;
        } else {
          currentPos++;
        }
      }
      
      if (endIfPos === -1) {
        pos = ifPos + 1;
        continue;
      }
      
      const content = template.substring(contentStart, endIfPos);
      
      // Check if this content contains another {if - if not, this is innermost
      if (content.indexOf('{if ') === -1) {
        const fullMatch = template.substring(ifPos, endIfPos + 5); // 5 = '{/if}'.length
        return { fullMatch, condition, content };
      }
      
      pos = ifPos + 1;
    }
    
    return null;
  }

  private processEachDirectives(template: string): string {
    // Find and process each directives using proper brace counting
    let processedTemplate = template;
    let hasChanges = true;
    let maxIterations = 10;
    
    while (hasChanges && maxIterations > 0) {
      hasChanges = false;
      maxIterations--;
      
      // Find the first {each} directive
      const eachStart = processedTemplate.indexOf('{each ');
      if (eachStart === -1) break;
      
      // Parse the each header
      const headerEnd = processedTemplate.indexOf('}', eachStart);
      if (headerEnd === -1) break;
      
      const header = processedTemplate.substring(eachStart + 6, headerEnd); // Skip '{each '
      const headerMatch = header.match(/(\w+(?:\.\w+)*)\s+as\s+\|(\w+),?\s*(\w+)?\|/);
      if (!headerMatch) break;
      
      const [, arrayName, itemName, indexName] = headerMatch;
      
      // Find matching {/each} using brace counting
      let braceCount = 1;
      let pos = headerEnd + 1;
      let contentStart = pos;
      
      while (pos < processedTemplate.length && braceCount > 0) {
        if (processedTemplate.substring(pos, pos + 6) === '{each ') {
          braceCount++;
          pos += 6;
        } else if (processedTemplate.substring(pos, pos + 7) === '{/each}') {
          braceCount--;
          if (braceCount === 0) {
            const content = processedTemplate.substring(contentStart, pos);
            const fullMatch = processedTemplate.substring(eachStart, pos + 7);
            
            // Process this each directive
            hasChanges = true;
            
            try {
              const array = this.getValue(arrayName);
              
              if (!Array.isArray(array)) {
                processedTemplate = processedTemplate.replace(fullMatch, '');
              } else {
                let result = '';
                array.forEach((item, index) => {
                  // Create a new variable scope for this iteration
                  const iterationScope: DefaultData = {};
                  iterationScope[itemName] = item;
                  if (indexName) {
                    iterationScope[indexName] = index;
                  }
                  
                  // Push the new scope to the stack
                  this.variableStack.push(iterationScope);
                  
                  // Process the content with current scope - include nested loops
                  let itemContent = content;
                  itemContent = this.processEachDirectives(itemContent);  // Process nested loops first
                  itemContent = this.processSimpleIfDirectives(itemContent);
                  itemContent = this.processVariables(itemContent);
                  
                  // Pop the scope
                  this.variableStack.pop();
                  
                  result += itemContent;
                });

                processedTemplate = processedTemplate.replace(fullMatch, result);
              }
            } catch (error) {
              console.warn('Error in each directive:', error);
              processedTemplate = processedTemplate.replace(fullMatch, '');
            }
            
            break;
          }
          pos += 7;
        } else {
          pos++;
        }
      }
      
      if (braceCount > 0) {
        // Unmatched {each}, remove it
        break;
      }
    }
    
    return processedTemplate;
  }

  private findInnermostEach(template: string): { fullMatch: string, arrayName: string, itemName: string, indexName: string | undefined, content: string } | null {
    // Find the first each that doesn't contain any other each inside it (truly innermost)
    let pos = 0;
    
    while (pos < template.length) {
      const eachPos = template.indexOf('{each ', pos);
      if (eachPos === -1) break;
      
      // Parse the each directive: {each arrayName as |itemName, indexName|}
      const eachStart = eachPos + 6; // '{each '.length
      const eachEnd = template.indexOf('}', eachStart);
      if (eachEnd === -1) {
        pos = eachPos + 1;
        continue;
      }
      
      const eachHeader = template.substring(eachStart, eachEnd);
      const eachMatch = eachHeader.match(/(\w+(?:\.\w+)*)\s+as\s+\|(\w+),?\s*(\w+)?\|/);
      if (!eachMatch) {
        pos = eachPos + 1;
        continue;
      }
      
      const [, arrayName, itemName, indexName] = eachMatch;
      const contentStart = eachEnd + 1; // '}'.length
      
      // Find the matching /each using brace counting
      let braceCount = 1;
      let currentPos = contentStart;
      let endEachPos = -1;
      
      while (currentPos < template.length && braceCount > 0) {
        if (template.substring(currentPos, currentPos + 6) === '{each ') {
          braceCount++;
          currentPos += 6;
        } else if (template.substring(currentPos, currentPos + 7) === '{/each}') {
          braceCount--;
          if (braceCount === 0) {
            endEachPos = currentPos;
            break;
          }
          currentPos += 7;
        } else {
          currentPos++;
        }
      }
      
      if (endEachPos === -1) {
        pos = eachPos + 1;
        continue;
      }
      
      const content = template.substring(contentStart, endEachPos);
      
      // Check if this content contains another {each - if not, this is innermost
      if (content.indexOf('{each ') === -1) {
        const fullMatch = template.substring(eachPos, endEachPos + 7); // 7 = '{/each}'.length
        return { fullMatch, arrayName, itemName, indexName, content };
      }
      
      pos = eachPos + 1;
    }
    
    return null;
  }

  private getValue(path: string): any {
    const keys = path.split('.');
    const firstKey = keys[0];
    
    // Check variable stack first (from most recent to oldest)
    for (let i = this.variableStack.length - 1; i >= 0; i--) {
      const scope = this.variableStack[i];
      if (firstKey in scope) {
        let value = scope[firstKey];
        
        // Navigate through remaining keys
        for (let j = 1; j < keys.length; j++) {
          if (value && typeof value === 'object' && keys[j] in value) {
            value = value[keys[j]];
          } else {
            return undefined;
          }
        }
        
        return value;
      }
    }
    
    // Fall back to default data
    let value = this.defaultData;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  private evaluateCondition(condition: string): boolean {
    try {
      // Replace variable paths with their values, being more careful about operators
      let processedCondition = condition;
      
      // Handle all comparison operators and negation
      // Match patterns like: variable, !variable, variable == value, variable >= value, etc.
      processedCondition = processedCondition.replace(/(!?)(\w+(?:\.\w+)*)(\s*(?:==|!=|>=|<=|>|<)\s*(?:'[^']*'|"[^"]*"|\d+|true|false|\w+(?:\.\w+)*))?/g, 
        (match, negation, variablePath, comparison) => {
          const value = this.getValue(variablePath);
          
          let processedValue;
          if (typeof value === 'string') {
            processedValue = `"${value}"`;
          } else if (typeof value === 'number') {
            processedValue = String(value);
          } else if (typeof value === 'boolean') {
            processedValue = String(value);
          } else {
            processedValue = value !== undefined ? String(value) : 'undefined';
          }
          
          if (comparison) {
            // Handle comparison with another variable or literal
            const comparisonProcessed = comparison.replace(/(\w+(?:\.\w+)*)/g, (varMatch: string) => {
              // Check if this is a variable reference (not a literal)
              if (!varMatch.match(/^(true|false|\d+)$/)) {
                const compValue = this.getValue(varMatch);
                if (typeof compValue === 'string') {
                  return `"${compValue}"`;
                } else if (compValue !== undefined) {
                  return String(compValue);
                }
              }
              return varMatch;
            });
            
            return negation + processedValue + comparisonProcessed;
          } else {
            return negation + processedValue;
          }
        }
      );
      
      // Use Function constructor to evaluate
      const func = new Function(`return ${processedCondition}`);
      return Boolean(func());
    } catch (error) {
      console.warn('Error evaluating condition:', condition, error);
      return false;
    }
  }
}