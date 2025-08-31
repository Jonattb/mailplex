import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CUSTOM_DATA } from '../constants/DefaultVariables.js';
import juice from 'juice';


export class EmailPreprocessorService {

  private getRandomFromArray(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private generateValue(param: string, customData?: { [key: string]: string | string[] | (() => string) }): string {
    // Create merged data: defaults + custom (custom overrides defaults)
    const mergedData = { ...DEFAULT_CUSTOM_DATA, ...customData };
    
    // Check merged data first
    if (param in mergedData) {
      const value = mergedData[param];
      if (typeof value === 'function') {
        return value();
      } else if (Array.isArray(value)) {
        return this.getRandomFromArray(value);
      } else {
        return value;
      }
    }
    
    // If not found in defaults or custom data, return the parameter name
    return param;
  }


  processTemplate(template: string, emailsPath: string = './emails', componentsPath: string = './components', customData?: { [key: string]: string | string[] | (() => string) }): string {
    try {
      console.log('=== PROCESSING TEMPLATE ===');
      console.log('Components path:', componentsPath);
      console.log('Template preview:', template.substring(0, 200));
      
      // Process in order: layouts, includes, loops, then print directives
      console.log('1. Processing layouts...');
      let processed = this.processLayoutDirectives(template, componentsPath, customData);
      console.log('After layouts:', processed.substring(0, 200));
      
      console.log('2. Processing includes...');
      processed = this.processIncludeDirectives(processed, componentsPath, customData);
      console.log('After includes:', processed.substring(0, 200));
      
      console.log('3. Processing loops...');
      processed = this.processLoopDirectives(processed);
      console.log('After loops:', processed.substring(0, 200));
      
      console.log('4. Processing print directives...');
      const processedWithVariables = this.processPrintDirectives(processed, customData);
      console.log('After print directives:', processedWithVariables.substring(0, 200));
      
      console.log('5. Inlining CSS and removing script tags...');
      const result = this.inlineCssAndCleanup(processedWithVariables);
      console.log('Final result preview:', result.substring(0, 200));
      
      return result;
    } catch (error) {
      console.error('Preprocessor error:', error);
      return template;
    }
  }

  /**
   * Processes template for engine conversion: handles layouts, includes, loops but preserves {{key, value}} directives
   */
  processTemplateForEngineConversion(template: string, emailsPath: string = './emails', componentsPath: string = './components', customData?: { [key: string]: string | string[] | (() => string) }): string {
    try {
      console.log('=== PROCESSING TEMPLATE FOR ENGINE CONVERSION ===');
      console.log('Components path:', componentsPath);
      console.log('Template preview:', template.substring(0, 200));
      
      // Process in order: layouts, includes, loops BUT NOT print directives
      console.log('1. Processing layouts for engine conversion...');
      let processed = this.processLayoutDirectivesForEngineConversion(template, componentsPath, customData);
      console.log('After layouts:', processed.substring(0, 200));
      
      console.log('2. Processing includes for engine conversion...');
      processed = this.processIncludeDirectivesForEngineConversion(processed, componentsPath, customData);
      console.log('After includes:', processed.substring(0, 200));
      
      console.log('3. Processing loops...');
      processed = this.processLoopDirectives(processed);
      console.log('After loops:', processed.substring(0, 200));
      
      console.log('4. Preserving print directives for engine conversion...');
      // Do NOT process print directives - leave {{key, value}} intact
      console.log('After preserving print directives:', processed.substring(0, 200));
      
      console.log('5. Inlining CSS and removing script tags (for engine conversion)...');
      const result = this.inlineCssAndCleanup(processed);
      console.log('Final result preview:', result.substring(0, 200));
      
      return result;
    } catch (error) {
      console.error('Preprocessor error:', error);
      return template;
    }
  }

  private processPrintDirectives(template: string, customData?: { [key: string]: string | string[] | (() => string) }): string {
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
      const content = directive.substring(2, directive.length - 2); // Remove {{ and }}
      
      try {
        const result = this.processDirectiveContent(content, customData);
        results.push(result);
      } catch (error) {
        console.warn(`Error processing directive ${directive}:`, error);
        results.push(directive);
      }
      
      i = end + 2;
    }
    
    return results.join('');
  }

  private processDirectiveContent(content: string, customData?: { [key: string]: string | string[] | (() => string) }): string {
    // Check for new syntax: {{variable, 'default_value'}} or {{variable, 'faker: method(params)'}}
    
    // Need to find comma that's not inside quotes or braces
    const commaIndex = this.findMainComma(content);
    
    if (commaIndex !== -1) {
      // New syntax with default value
      const variable = content.substring(0, commaIndex).trim();
      const defaultValue = content.substring(commaIndex + 1).trim();
      
      console.log(`Processing variable: "${variable}" with default: "${defaultValue}"`);
      
      // Remove quotes from default value
      const cleanDefault = this.removeQuotes(defaultValue);
      
      // If default value has quotes, use it as static text
      if (defaultValue.startsWith('"') || defaultValue.startsWith("'")) {
        console.log(`Using static value: "${cleanDefault}"`);
        return cleanDefault;
      } else {
        // Use as parameter name for generation
        console.log(`Generating value for parameter: "${cleanDefault}"`);
        return this.generateValue(cleanDefault, customData);
      }
    } else {
      // Old syntax: {{key|method}} - deprecated but still supported  
      const pipeIndex = content.indexOf('|');
      if (pipeIndex !== -1) {
        const key = content.substring(0, pipeIndex).trim();
        console.log(`Old syntax detected, generating value for: "${key}"`);
        return this.generateValue(key, customData);
      } else {
        // Plain variable without default - try to generate
        console.log(`Plain variable, generating value for: "${content}"`);
        return this.generateValue(content, customData);
      }
    }
  }

  private findMainComma(content: string): number {
    let depth = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      
      if (!inString) {
        if (char === '"' || char === "'") {
          inString = true;
          stringChar = char;
        } else if (char === '{' || char === '[' || char === '(') {
          depth++;
        } else if (char === '}' || char === ']' || char === ')') {
          depth--;
        } else if (char === ',' && depth === 0) {
          return i; // Found main comma at root level
        }
      } else {
        if (char === stringChar && content[i - 1] !== '\\') {
          inString = false;
        }
      }
    }
    
    return -1; // No main comma found
  }

  private removeQuotes(value: string): string {
    value = value.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    return value;
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

  private processLoopDirectives(template: string): string {
    console.log('Processing loop directives...');
    
    // Process {{loop N}} ... {{/loop}} patterns
    const result = template.replace(/\{\{loop\s+(\d+)\}\}([\s\S]*?)\{\{\/loop\}\}/g, (match, count, content) => {
      console.log(`Found loop: count=${count}, content length=${content.length}`);
      
      const iterations = parseInt(count, 10);
      if (isNaN(iterations) || iterations <= 0) {
        console.warn(`Invalid loop count: ${count}`);
        return match;
      }
      
      // Repeat the content N times, replacing {{_index}} with current iteration
      let result = '';
      for (let i = 0; i < iterations; i++) {
        // Replace {{_index}} with the current index (0-based)
        // Replace {{_index1}} with 1-based index if needed
        let indexedContent = content;
        
        // Replace _index1 first (to avoid conflicts)
        indexedContent = indexedContent.replace(/\{\{_index1\}\}/g, (i + 1).toString());
        indexedContent = indexedContent.replace(/\{\{_index\}\}/g, i.toString());
        
        result += indexedContent;
      }
      
      return result;
    });
    
    console.log(`Template processed: ${result.length} characters`);
    return result;
  }

  private processIncludeDirectives(template: string, componentsPath: string, customData?: { [key: string]: string | string[] | (() => string) }): string {
    console.log('Looking for include and component directives...');
    
    // Process {{component "component_name"}} patterns  
    let result = template.replace(/\{\{component\s+['"]([^'"]+)['"]\}\}/g, (match, componentName) => {
      console.log(`Found component directive: ${match}`);
      try {
        const componentPath = join(componentsPath, `${componentName}.html`);
        console.log(`Reading component from: ${componentPath}`);
        
        const componentContent = readFileSync(componentPath, 'utf-8');
        console.log(`Component content preview: ${componentContent.substring(0, 100)}`);
        
        // Recursively process the included component
        return this.processTemplate(componentContent, componentsPath, componentsPath, customData);
      } catch (error) {
        console.warn(`Error including component ${componentName}:`, error);
        return match; // Return original directive if error
      }
    });
    
    // Process {{include 'component_name'}} patterns
    result = result.replace(/\{\{include\s+['"]([^'"]+)['"]\}\}/g, (match, componentName) => {
      console.log(`Found include directive: ${match}`);
      try {
        const componentPath = join(componentsPath, `${componentName}.html`);
        console.log(`Reading component from: ${componentPath}`);
        
        const componentContent = readFileSync(componentPath, 'utf-8');
        console.log(`Component content preview: ${componentContent.substring(0, 100)}`);
        
        // Recursively process the included component
        return this.processTemplate(componentContent, componentsPath, componentsPath, customData);
      } catch (error) {
        console.warn(`Error including component ${componentName}:`, error);
        return match; // Return original directive if error
      }
    });
    
    const includeCount = (template.match(/\{\{include\s+['"]([^'"]+)['"]\}\}/g) || []).length;
    const componentCount = (template.match(/\{\{component\s+['"]([^'"]+)['"]\}\}/g) || []).length;
    console.log(`Include processing done. Found ${componentCount} components and ${includeCount} includes`);
    return result;
  }

  private processLayoutDirectives(template: string, componentsPath: string, customData?: { [key: string]: string | string[] | (() => string) }): string {
    console.log('Looking for layout directives...');
    
    // Process {{layout 'layout_name'}} ... {{/layout}} patterns
    const result = template.replace(/\{\{layout\s+['"]([^'"]+)['"]\}\}([\s\S]*?)\{\{\/layout\}\}/g, (match, layoutName, content) => {
      console.log(`Found layout directive: {{layout '${layoutName}'}}`);
      console.log(`Content length: ${content.length}`);
      
      try {
        const layoutPath = join(componentsPath, `${layoutName}.html`);
        console.log(`Reading layout from: ${layoutPath}`);
        
        const layoutContent = readFileSync(layoutPath, 'utf-8');
        console.log(`Layout content preview: ${layoutContent.substring(0, 100)}`);
        
        // Replace {{content}} in layout with the actual content
        const processedLayout = layoutContent.replace(/\{\{content\}\}/g, content);
        console.log(`Layout after content replacement: ${processedLayout.substring(0, 100)}`);
        
        // Recursively process the layout
        return this.processTemplate(processedLayout, componentsPath, componentsPath, customData);
      } catch (error) {
        console.warn(`Error processing layout ${layoutName}:`, error);
        return match; // Return original directive if error
      }
    });
    
    console.log(`Layout processing done. Found ${template.match(/\{\{layout\s+['"]([^'"]+)['"]\}\}/g)?.length || 0} layouts`);
    return result;
  }

  /**
   * Process layout directives for engine conversion (without processing variables)
   */
  private processLayoutDirectivesForEngineConversion(template: string, componentsPath: string, customData?: { [key: string]: string | string[] | (() => string) }): string {
    console.log('Looking for layout directives (engine conversion)...');
    
    // Process {{layout 'layout_name'}} ... {{/layout}} patterns
    const result = template.replace(/\{\{layout\s+['"]([^'"]+)['"]\}\}([\s\S]*?)\{\{\/layout\}\}/g, (match, layoutName, content) => {
      console.log(`Found layout directive: {{layout '${layoutName}'}}`);
      console.log(`Content length: ${content.length}`);
      
      try {
        const layoutPath = join(componentsPath, `${layoutName}.html`);
        console.log(`Reading layout from: ${layoutPath}`);
        
        const layoutContent = readFileSync(layoutPath, 'utf-8');
        console.log(`Layout content preview: ${layoutContent.substring(0, 100)}`);
        
        // Replace {{content}} in layout with the actual content
        const processedLayout = layoutContent.replace(/\{\{content\}\}/g, content);
        console.log(`Layout after content replacement: ${processedLayout.substring(0, 100)}`);
        
        // Recursively process the layout (for engine conversion)
        return this.processTemplateForEngineConversion(processedLayout, componentsPath, componentsPath, customData);
      } catch (error) {
        console.warn(`Error processing layout ${layoutName}:`, error);
        return match; // Return original directive if error
      }
    });
    
    console.log(`Layout processing done. Found ${template.match(/\{\{layout\s+['"]([^'"]+)['"]\}\}/g)?.length || 0} layouts`);
    return result;
  }

  /**
   * Process include directives for engine conversion (without processing variables)
   */
  private processIncludeDirectivesForEngineConversion(template: string, componentsPath: string, customData?: { [key: string]: string | string[] | (() => string) }): string {
    console.log('Looking for include and component directives (engine conversion)...');
    
    // Process {{component "component_name"}} patterns  
    let result = template.replace(/\{\{component\s+['"]([^'"]+)['"]\}\}/g, (match, componentName) => {
      console.log(`Found component directive: ${match}`);
      try {
        const componentPath = join(componentsPath, `${componentName}.html`);
        console.log(`Reading component from: ${componentPath}`);
        
        const componentContent = readFileSync(componentPath, 'utf-8');
        console.log(`Component content preview: ${componentContent.substring(0, 100)}`);
        
        // Recursively process the included component (for engine conversion)
        return this.processTemplateForEngineConversion(componentContent, componentsPath, componentsPath, customData);
      } catch (error) {
        console.warn(`Error including component ${componentName}:`, error);
        return match; // Return original directive if error
      }
    });
    
    // Process {{include 'component_name'}} patterns
    result = result.replace(/\{\{include\s+['"]([^'"]+)['"]\}\}/g, (match, componentName) => {
      console.log(`Found include directive: ${match}`);
      try {
        const componentPath = join(componentsPath, `${componentName}.html`);
        console.log(`Reading component from: ${componentPath}`);
        
        const componentContent = readFileSync(componentPath, 'utf-8');
        console.log(`Component content preview: ${componentContent.substring(0, 100)}`);
        
        // Recursively process the included component (for engine conversion)
        return this.processTemplateForEngineConversion(componentContent, componentsPath, componentsPath, customData);
      } catch (error) {
        console.warn(`Error including component ${componentName}:`, error);
        return match; // Return original directive if error
      }
    });
    
    const includeCount = (template.match(/\{\{include\s+['"]([^'"]+)['"]\}\}/g) || []).length;
    const componentCount = (template.match(/\{\{component\s+['"]([^'"]+)['"]\}\}/g) || []).length;
    console.log(`Include processing done. Found ${componentCount} components and ${includeCount} includes`);
    return result;
  }

  /**
   * Inlines CSS from <style> tags and removes <script> tags for email compatibility
   */
  private inlineCssAndCleanup(html: string): string {
    try {
      console.log('Starting CSS inlining process...');
      
      // First, remove all <script> tags and their content
      let cleanedHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      
      // Also remove any remaining <script> tags without closing tags
      cleanedHtml = cleanedHtml.replace(/<script[^>]*>/gi, '');
      
      console.log('Script tags removed');
      
      // Use juice to inline CSS
      const inlinedHtml = juice(cleanedHtml, {
        removeStyleTags: true,       // Remove <style> tags after inlining
        preserveImportant: true,     // Keep !important declarations
        preserveMediaQueries: false, // Remove media queries (not supported in most email clients)
        preserveFontFaces: false,    // Remove @font-face (not supported in most email clients)
        applyWidthAttributes: true,  // Convert width CSS to width attributes
        applyHeightAttributes: true, // Convert height CSS to height attributes
        applyAttributesTableElements: true, // Apply attributes to table elements
        xmlMode: false               // HTML mode, not XML
      });
      
      console.log('CSS inlined successfully');
      return inlinedHtml;
      
    } catch (error) {
      console.error('Error during CSS inlining:', error);
      // Return original HTML with just script tags removed as fallback
      return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
  }
}