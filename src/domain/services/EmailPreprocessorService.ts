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
    // Check for new syntax: {{variable, 'default_value'}}
    
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

  public processLoopDirectives(template: string): string {
    console.log('Processing loop directives...');
    
    // Process {{loop N}} ... {{/loop}} patterns
    const result = template.replace(/\{\{loop\s+(\d+)\}\}([\s\S]*?)\{\{\/loop\}\}/g, (match, count, content) => {
      console.log(`Found loop: count=${count}, content length=${content.length}`);
      
      const iterations = parseInt(count, 10);
      if (isNaN(iterations) || iterations <= 0) {
        console.warn(`Invalid loop count: ${count}`);
        return match;
      }
      
      // Repeat the content N times
      let result = '';
      for (let i = 0; i < iterations; i++) {
        let indexedContent = content;
        
        // Replace {{_index}} with the current index (0-based)
        // Replace {{_index1}} with 1-based index if needed
        indexedContent = indexedContent.replace(/\{\{_index1\}\}/g, (i + 1).toString());
        indexedContent = indexedContent.replace(/\{\{_index\}\}/g, i.toString());
        
        // Handle incremental variables {{key+, value}} -> {{key_1}}, {{key_2}}, etc.
        indexedContent = indexedContent.replace(/\{\{(\w+)\+,\s*([^}]+)\}\}/g, (_: string, key: string, value: string) => {
          console.log(`Converting incremental variable: ${key}+ -> ${key}_${i + 1}`);
          return `{{${key}_${i + 1}, ${value}}}`;
        });
        
        result += indexedContent;
      }
      
      return result;
    });
    
    console.log(`Template processed: ${result.length} characters`);
    return result;
  }

  /**
   * Convert {{key, value}} variables to ERB format <%= key %>
   */

  public processIncludeDirectives(template: string, componentsPath: string, customData?: { [key: string]: string | string[] | (() => string) }): string {
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

  public processLayoutDirectives(template: string, componentsPath: string, customData?: { [key: string]: string | string[] | (() => string) }): string {
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

  /**
   * Inlines CSS from <style> tags and removes <script> tags for email compatibility
   */
  public inlineCssAndCleanup(html: string): string {
    try {
      console.log('Starting CSS inlining process...');
      
      // Generate Tailwind CSS for the specific classes used
      const tailwindCSS = this.generateTailwindCSSForHTML(html);
      
      // First, use juice normally to process existing <style> tags
      let inlinedHtml = juice(html, {
        removeStyleTags: true,       // Remove <style> tags after inlining
        preserveImportant: true,     // Keep !important declarations
        preserveMediaQueries: false, // Remove media queries (not supported in most email clients)
        preserveFontFaces: false,    // Remove @font-face (not supported in most email clients)
        applyWidthAttributes: true,  // Convert width CSS to width attributes
        applyHeightAttributes: true, // Convert height CSS to height attributes
        applyAttributesTableElements: true, // Apply attributes to table elements
        xmlMode: false               // HTML mode, not XML
      });
      
      // Then, apply Tailwind CSS on top
      if (tailwindCSS.trim()) {
        inlinedHtml = juice.inlineContent(inlinedHtml, tailwindCSS, {
          removeStyleTags: false,      // Don't remove style tags (we're not using them)
          preserveImportant: true,     // Keep !important declarations
          preserveMediaQueries: false, // Remove media queries (not supported in most email clients)
          preserveFontFaces: false,    // Remove @font-face (not supported in most email clients)
          applyWidthAttributes: true,  // Convert width CSS to width attributes
          applyHeightAttributes: true, // Convert height CSS to height attributes
          applyAttributesTableElements: true, // Apply attributes to table elements
          xmlMode: false               // HTML mode, not XML
        });
      }
      
      // Remove all <script> tags and their content
      let cleanedHtml = inlinedHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      
      // Also remove any remaining <script> tags without closing tags
      cleanedHtml = cleanedHtml.replace(/<script[^>]*>/gi, '');
      
      console.log('CSS inlined successfully and script tags removed');
      return cleanedHtml;
      
    } catch (error) {
      console.error('Error during CSS inlining:', error);
      // Return original HTML with just script tags removed as fallback
      return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
  }


  /**
   * Generate Tailwind CSS dynamically for the specific classes used in HTML
   */
  private generateTailwindCSSForHTML(html: string): string {
    console.log('Generating Tailwind CSS for HTML classes...');
    
    // Extract classes from HTML
    const classMatches = html.matchAll(/class=["']([^"']*)["']/g);
    const usedClasses = new Set<string>();
    
    for (const match of classMatches) {
      const classes = match[1].split(/\s+/).filter(c => c.trim());
      classes.forEach(cls => usedClasses.add(cls));
    }
    
    // Generate basic CSS for common Tailwind classes
    const css = this.generateBasicTailwindCSS(Array.from(usedClasses));
    return css;
  }

  /**
   * Generate basic CSS for common Tailwind utility classes
   */
  private generateBasicTailwindCSS(classes: string[]): string {
    const cssRules: string[] = [];
    
    for (const className of classes) {
      const rule = this.getTailwindRule(className);
      if (rule) {
        cssRules.push(rule);
      }
    }
    
    return cssRules.join('\n');
  }

  /**
   * Get CSS rule for a Tailwind class
   */
  private getTailwindRule(className: string): string | null {
    // Basic Tailwind mappings
    const rules: { [key: string]: string } = {
      // Padding
      'p-1': '.p-1 { padding: 0.25rem; }',
      'p-2': '.p-2 { padding: 0.5rem; }',
      'p-3': '.p-3 { padding: 0.75rem; }',
      'p-4': '.p-4 { padding: 1rem; }',
      'p-5': '.p-5 { padding: 1.25rem; }',
      'p-6': '.p-6 { padding: 1.5rem; }',
      'p-8': '.p-8 { padding: 2rem; }',
      
      // Margin
      'mb-1': '.mb-1 { margin-bottom: 0.25rem; }',
      'mb-2': '.mb-2 { margin-bottom: 0.5rem; }',
      'mb-3': '.mb-3 { margin-bottom: 0.75rem; }',
      'mb-4': '.mb-4 { margin-bottom: 1rem; }',
      'mb-5': '.mb-5 { margin-bottom: 1.25rem; }',
      'mb-6': '.mb-6 { margin-bottom: 1.5rem; }',
      'mb-8': '.mb-8 { margin-bottom: 2rem; }',
      
      // Colors
      'bg-blue-500': '.bg-blue-500 { background-color: #3b82f6; }',
      'bg-red-500': '.bg-red-500 { background-color: #ef4444; }',
      'bg-green-500': '.bg-green-500 { background-color: #10b981; }',
      'bg-yellow-500': '.bg-yellow-500 { background-color: #f59e0b; }',
      'bg-purple-500': '.bg-purple-500 { background-color: #8b5cf6; }',
      'text-white': '.text-white { color: #ffffff; }',
      'text-black': '.text-black { color: #000000; }',
      'text-gray-100': '.text-gray-100 { color: #f3f4f6; }',
      'text-gray-500': '.text-gray-500 { color: #6b7280; }',
      'text-gray-900': '.text-gray-900 { color: #111827; }',
      
      // Typography
      'text-xs': '.text-xs { font-size: 0.75rem; line-height: 1rem; }',
      'text-sm': '.text-sm { font-size: 0.875rem; line-height: 1.25rem; }',
      'text-base': '.text-base { font-size: 1rem; line-height: 1.5rem; }',
      'text-lg': '.text-lg { font-size: 1.125rem; line-height: 1.75rem; }',
      'text-xl': '.text-xl { font-size: 1.25rem; line-height: 1.75rem; }',
      'text-2xl': '.text-2xl { font-size: 1.5rem; line-height: 2rem; }',
      'text-3xl': '.text-3xl { font-size: 1.875rem; line-height: 2.25rem; }',
      'text-4xl': '.text-4xl { font-size: 2.25rem; line-height: 2.5rem; }',
      
      // Font weights
      'font-normal': '.font-normal { font-weight: 400; }',
      'font-medium': '.font-medium { font-weight: 500; }',
      'font-semibold': '.font-semibold { font-weight: 600; }',
      'font-bold': '.font-bold { font-weight: 700; }',
      'font-extrabold': '.font-extrabold { font-weight: 800; }',
      
      // Border radius
      'rounded': '.rounded { border-radius: 0.25rem; }',
      'rounded-sm': '.rounded-sm { border-radius: 0.125rem; }',
      'rounded-md': '.rounded-md { border-radius: 0.375rem; }',
      'rounded-lg': '.rounded-lg { border-radius: 0.5rem; }',
      'rounded-xl': '.rounded-xl { border-radius: 0.75rem; }',
      'rounded-2xl': '.rounded-2xl { border-radius: 1rem; }',
      'rounded-full': '.rounded-full { border-radius: 9999px; }',
      
      // Text alignment
      'text-left': '.text-left { text-align: left; }',
      'text-center': '.text-center { text-align: center; }',
      'text-right': '.text-right { text-align: right; }',
    };
    
    // Handle arbitrary values like bg-[#444]
    if (className.includes('[') && className.includes(']')) {
      return this.generateArbitraryValueCSS(className);
    }
    
    return rules[className] || null;
  }

  /**
   * Generate CSS for arbitrary value classes like bg-[#444]
   */
  private generateArbitraryValueCSS(className: string): string | null {
    const match = className.match(/^(.*?)-?\[([^\]]+)\]$/);
    if (!match) return null;
    
    const [, prefix, value] = match;
    // Remove trailing dash from prefix if present
    const cleanPrefix = prefix.replace(/-$/, '');
    
    // Escape special characters in the className for CSS selector
    const escapedClassName = className.replace(/[[\]]/g, '\\$&');
    
    switch (cleanPrefix) {
      case 'bg':
        return `.${escapedClassName} { background-color: ${value}; }`;
      
      case 'text':
        // Handle font sizes (numbers with units) vs colors
        if (value.match(/^\d+px$|^\d+rem$|^\d+em$|^\d+$/)) {
          const fontSize = value.endsWith('px') || value.endsWith('rem') || value.endsWith('em') ? value : `${value}px`;
          return `.${escapedClassName} { font-size: ${fontSize}; }`;
        } else if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl')) {
          return `.${escapedClassName} { color: ${value}; }`;
        }
        break;
      
      case 'rounded':
        const borderRadius = value.endsWith('px') || value.endsWith('rem') || value.endsWith('em') ? value : `${value}px`;
        return `.${escapedClassName} { border-radius: ${borderRadius}; }`;
      
      case 'p':
        const padding = value.endsWith('px') || value.endsWith('rem') || value.endsWith('em') ? value : `${value}px`;
        return `.${escapedClassName} { padding: ${padding}; }`;
      
      case 'm':
        const margin = value.endsWith('px') || value.endsWith('rem') || value.endsWith('em') ? value : `${value}px`;
        return `.${escapedClassName} { margin: ${margin}; }`;
      
      case 'mb':
        const marginBottom = value.endsWith('px') || value.endsWith('rem') || value.endsWith('em') ? value : `${value}px`;
        return `.${escapedClassName} { margin-bottom: ${marginBottom}; }`;
      
      case 'mt':
        const marginTop = value.endsWith('px') || value.endsWith('rem') || value.endsWith('em') ? value : `${value}px`;
        return `.${escapedClassName} { margin-top: ${marginTop}; }`;
      
      case 'ml':
        const marginLeft = value.endsWith('px') || value.endsWith('rem') || value.endsWith('em') ? value : `${value}px`;
        return `.${escapedClassName} { margin-left: ${marginLeft}; }`;
      
      case 'mr':
        const marginRight = value.endsWith('px') || value.endsWith('rem') || value.endsWith('em') ? value : `${value}px`;
        return `.${escapedClassName} { margin-right: ${marginRight}; }`;
      
      case 'w':
        const width = value.endsWith('px') || value.endsWith('rem') || value.endsWith('em') || value.endsWith('%') ? value : `${value}px`;
        return `.${escapedClassName} { width: ${width}; }`;
      
      case 'h':
        const height = value.endsWith('px') || value.endsWith('rem') || value.endsWith('em') || value.endsWith('%') ? value : `${value}px`;
        return `.${escapedClassName} { height: ${height}; }`;
    }
    
    return null;
  }

  /**
   * Process only structural directives (layouts, includes, loops) without processing variables
   * Used for engine conversion where we want to preserve {{key, value}} directives
   */
  processStructuralOnly(template: string, emailsPath: string = './emails', componentsPath: string = './components', customData?: { [key: string]: string | string[] | (() => string) }): string {
    // Process in order: layouts, includes, loops BUT NOT print directives
    let processed = this.processLayoutDirectivesPartial(template, componentsPath, customData);
    processed = this.processIncludeDirectivesPartial(processed, componentsPath, customData);
    processed = this.processLoopDirectives(processed);
    
    return processed;
  }

  /**
   * Process layout directives without processing variables in included layouts
   */
  private processLayoutDirectivesPartial(template: string, componentsPath: string, customData?: { [key: string]: string | string[] | (() => string) }): string {
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
        
        // Replace {{content}} with the provided content (without processing variables)
        const contentReplaced = layoutContent.replace(/\{\{content\}\}/g, content);
        console.log(`Layout after content replacement: ${contentReplaced.substring(0, 100)}`);
        
        // Process the layout structurally (recursively but without variables)
        return this.processStructuralOnly(contentReplaced, componentsPath, componentsPath, customData);
      } catch (error) {
        console.warn(`Error processing layout ${layoutName}:`, error);
        return match; // Return original directive if error
      }
    });
    
    console.log(`Layout processing done. Found ${template !== result ? 1 : 0} layouts`);
    return result;
  }

  /**
   * Process include directives without processing variables in included components
   */
  private processIncludeDirectivesPartial(template: string, componentsPath: string, customData?: { [key: string]: string | string[] | (() => string) }): string {
    console.log('Looking for include and component directives...');
    
    // Process {{component "component_name"}} patterns  
    let result = template.replace(/\{\{component\s+['"]([^'"]+)['"]\}\}/g, (match, componentName) => {
      console.log(`Found component directive: ${match}`);
      try {
        const componentPath = join(componentsPath, `${componentName}.html`);
        console.log(`Reading component from: ${componentPath}`);
        
        const componentContent = readFileSync(componentPath, 'utf-8');
        console.log(`Component content preview: ${componentContent.substring(0, 100)}`);
        
        // Process component structurally (without variables)
        return this.processStructuralOnly(componentContent, componentsPath, componentsPath, customData);
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
        
        // Process component structurally (without variables)
        return this.processStructuralOnly(componentContent, componentsPath, componentsPath, customData);
      } catch (error) {
        console.warn(`Error including component ${componentName}:`, error);
        return match; // Return original directive if error
      }
    });
    
    let componentCount = 0;
    let includeCount = 0;
    template.replace(/\{\{component\s+['"]([^'"]+)['"]\}\}/g, () => { componentCount++; return ''; });
    template.replace(/\{\{include\s+['"]([^'"]+)['"]\}\}/g, () => { includeCount++; return ''; });
    
    console.log(`Include processing done. Found ${componentCount} components and ${includeCount} includes`);
    return result;
  }
}