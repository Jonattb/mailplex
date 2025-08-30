import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export class EmailPreprocessorService {
  private readonly namesList = ['Ana', 'Carlos', 'María', 'José', 'Laura', 'Miguel', 'Carmen', 'Antonio', 'Isabel', 'Francisco'];
  private readonly lastNamesList = ['García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín'];
  private readonly companiesList = ['TechCorp', 'InnovaSoft', 'DataPro', 'CloudTech', 'DevStudio', 'WebFlow', 'AppLab', 'CodeWorks', 'DigitalHub', 'NetSolutions'];
  private readonly productsList = ['Smartphone Pro', 'Laptop Ultra', 'Tablet Max', 'Monitor 4K', 'Auriculares Pro', 'Cámara Digital', 'Smartwatch', 'Teclado RGB', 'Mouse Gaming', 'Altavoz Bluetooth'];
  private readonly citiesList = ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Murcia', 'Palma', 'Bilbao', 'Alicante'];

  private getRandomFromArray(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private getRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private getRandomPrice(): string {
    return (Math.random() * 999 + 1).toFixed(2);
  }

  private getRandomDate(): string {
    const year = this.getRandomNumber(2024, 2025);
    const month = this.getRandomNumber(1, 12).toString().padStart(2, '0');
    const day = this.getRandomNumber(1, 28).toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private generateValue(param: string, customData?: { [key: string]: string | string[] | (() => string) }): string {
    // First check custom data
    if (customData && param in customData) {
      const customValue = customData[param];
      if (typeof customValue === 'function') {
        return customValue();
      } else if (Array.isArray(customValue)) {
        return this.getRandomFromArray(customValue);
      } else {
        return customValue;
      }
    }
    
    // Fall back to default generation
    switch (param.toLowerCase()) {
      case 'first_name': return this.getRandomFromArray(this.namesList);
      case 'last_name': return this.getRandomFromArray(this.lastNamesList);
      case 'full_name': return `${this.getRandomFromArray(this.namesList)} ${this.getRandomFromArray(this.lastNamesList)}`;
      case 'display_name': return `${this.getRandomFromArray(this.namesList)} ${this.getRandomFromArray(this.lastNamesList)[0]}.`;
      case 'username': return `${this.getRandomFromArray(this.namesList).toLowerCase()}${this.getRandomNumber(10, 99)}`;
      case 'email': return `${this.getRandomFromArray(this.namesList).toLowerCase()}.${this.getRandomFromArray(this.lastNamesList).toLowerCase()}@email.com`;
      
      case 'company': 
      case 'company_name': return this.getRandomFromArray(this.companiesList);
      case 'department': return this.getRandomFromArray(['Ventas', 'Marketing', 'IT', 'RRHH', 'Finanzas']);
      case 'position': return this.getRandomFromArray(['Gerente', 'Analista', 'Coordinador', 'Especialista', 'Director']);
      
      case 'date': return this.getRandomDate();
      case 'year': return this.getRandomNumber(2024, 2025).toString();
      case 'month': return this.getRandomFromArray(['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio']);
      case 'day': return this.getRandomNumber(1, 31).toString();
      case 'time': return `${this.getRandomNumber(9, 18)}:${this.getRandomNumber(0, 59).toString().padStart(2, '0')}`;
      
      case 'age': return this.getRandomNumber(18, 65).toString();
      case 'price': return this.getRandomPrice();
      case 'quantity': return this.getRandomNumber(1, 10).toString();
      case 'total': return (parseFloat(this.getRandomPrice()) * this.getRandomNumber(1, 5)).toFixed(2);
      case 'discount': return this.getRandomNumber(5, 25).toString();
      case 'tax': return this.getRandomFromArray(['21', '10', '4']);
      
      case 'product':
      case 'product_name': return this.getRandomFromArray(this.productsList);
      case 'category': return this.getRandomFromArray(['Electrónicos', 'Ropa', 'Hogar', 'Deportes', 'Libros']);
      case 'brand': return this.getRandomFromArray(['Apple', 'Samsung', 'Sony', 'Nike', 'Adidas']);
      case 'model': return `Pro-${this.getRandomNumber(2020, 2025)}`;
      
      case 'phone': return `+34 ${this.getRandomNumber(600, 699)} ${this.getRandomNumber(100, 999)} ${this.getRandomNumber(100, 999)}`;
      case 'address': return `Calle ${this.getRandomFromArray(['Mayor', 'Principal', 'Central', 'Real'])} ${this.getRandomNumber(1, 200)}`;
      case 'city': return this.getRandomFromArray(this.citiesList);
      case 'country': return 'España';
      case 'postal_code': return `${this.getRandomNumber(10, 50)}${this.getRandomNumber(100, 999)}`;
      
      case 'order_id': return `ORD-${this.getRandomNumber(1000, 9999)}`;
      case 'invoice_id': return `INV-${this.getRandomNumber(1000, 9999)}`;
      case 'customer_id': return `CUST-${this.getRandomNumber(100, 999)}`;
      case 'transaction_id': return `TXN-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      case 'status': return this.getRandomFromArray(['Activo', 'Pendiente', 'Completado', 'En Proceso']);
      case 'priority': return this.getRandomFromArray(['Alta', 'Media', 'Baja']);
      case 'type': return this.getRandomFromArray(['Premium', 'Estándar', 'Básico']);
      case 'version': return `${this.getRandomNumber(1, 3)}.${this.getRandomNumber(0, 9)}.${this.getRandomNumber(0, 9)}`;
      case 'code': return Math.random().toString(36).substr(2, 6).toUpperCase();
      case 'reference': return `REF-${this.getRandomNumber(1000, 9999)}`;
      
      default: return param; // Return the parameter name if not found
    }
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
      const result = this.processPrintDirectives(processed, customData);
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
    console.log('Looking for include directives...');
    
    // Process {{include 'component_name'}} patterns
    const result = template.replace(/\{\{include\s+['"]([^'"]+)['"]\}\}/g, (match, componentName) => {
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
    
    console.log(`Include processing done. Found ${template.match(/\{\{include\s+['"]([^'"]+)['"]\}\}/g)?.length || 0} includes`);
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
}