/**
 * Default custom data variables available in template processing
 * This is the single source of truth for all default template variables
 */
export const DEFAULT_CUSTOM_DATA: { [key: string]: string | string[] | (() => string) } = {
  // Names
  first_name: () => ['Ana', 'Carlos', 'María', 'José', 'Laura', 'Miguel', 'Carmen', 'Antonio', 'Isabel', 'Francisco'][Math.floor(Math.random() * 10)],
  last_name: () => ['García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín'][Math.floor(Math.random() * 10)],
  full_name: () => {
    const names = ['Ana', 'Carlos', 'María', 'José', 'Laura', 'Miguel', 'Carmen', 'Antonio', 'Isabel', 'Francisco'];
    const lastNames = ['García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín'];
    return `${names[Math.floor(Math.random() * names.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
  },
  display_name: () => {
    const names = ['Ana', 'Carlos', 'María', 'José', 'Laura', 'Miguel', 'Carmen', 'Antonio', 'Isabel', 'Francisco'];
    const lastNames = ['García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín'];
    return `${names[Math.floor(Math.random() * names.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)][0]}.`;
  },
  username: () => {
    const names = ['Ana', 'Carlos', 'María', 'José', 'Laura', 'Miguel', 'Carmen', 'Antonio', 'Isabel', 'Francisco'];
    return `${names[Math.floor(Math.random() * names.length)].toLowerCase()}${Math.floor(Math.random() * 90) + 10}`;
  },
  email: () => {
    const names = ['Ana', 'Carlos', 'María', 'José', 'Laura', 'Miguel', 'Carmen', 'Antonio', 'Isabel', 'Francisco'];
    const lastNames = ['García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín'];
    return `${names[Math.floor(Math.random() * names.length)].toLowerCase()}.${lastNames[Math.floor(Math.random() * lastNames.length)].toLowerCase()}@email.com`;
  },

  // Company
  company: () => ['TechCorp', 'InnovaSoft', 'DataPro', 'CloudTech', 'DevStudio', 'WebFlow', 'AppLab', 'CodeWorks', 'DigitalHub', 'NetSolutions'][Math.floor(Math.random() * 10)],
  company_name: () => ['TechCorp', 'InnovaSoft', 'DataPro', 'CloudTech', 'DevStudio', 'WebFlow', 'AppLab', 'CodeWorks', 'DigitalHub', 'NetSolutions'][Math.floor(Math.random() * 10)],
  department: () => ['Ventas', 'Marketing', 'IT', 'RRHH', 'Finanzas'][Math.floor(Math.random() * 5)],
  position: () => ['Gerente', 'Analista', 'Coordinador', 'Especialista', 'Director'][Math.floor(Math.random() * 5)],

  // Dates and time
  date: () => {
    const year = Math.floor(Math.random() * 2) + 2024;
    const month = Math.floor(Math.random() * 12) + 1;
    const day = Math.floor(Math.random() * 28) + 1;
    return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  },
  year: () => (Math.floor(Math.random() * 2) + 2024).toString(),
  month: () => ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'][Math.floor(Math.random() * 6)],
  day: () => (Math.floor(Math.random() * 31) + 1).toString(),
  time: () => `${Math.floor(Math.random() * 10) + 9}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,

  // Numbers
  age: () => (Math.floor(Math.random() * 48) + 18).toString(),
  price: () => (Math.random() * 999 + 1).toFixed(2),
  quantity: () => (Math.floor(Math.random() * 10) + 1).toString(),
  total: () => (Math.random() * 999 * (Math.floor(Math.random() * 5) + 1)).toFixed(2),
  discount: () => (Math.floor(Math.random() * 21) + 5).toString(),
  tax: () => ['21', '10', '4'][Math.floor(Math.random() * 3)],

  // Products
  product: () => ['Smartphone Pro', 'Laptop Ultra', 'Tablet Max', 'Monitor 4K', 'Auriculares Pro', 'Cámara Digital', 'Smartwatch', 'Teclado RGB', 'Mouse Gaming', 'Altavoz Bluetooth'][Math.floor(Math.random() * 10)],
  product_name: () => ['Smartphone Pro', 'Laptop Ultra', 'Tablet Max', 'Monitor 4K', 'Auriculares Pro', 'Cámara Digital', 'Smartwatch', 'Teclado RGB', 'Mouse Gaming', 'Altavoz Bluetooth'][Math.floor(Math.random() * 10)],
  category: () => ['Electrónicos', 'Ropa', 'Hogar', 'Deportes', 'Libros'][Math.floor(Math.random() * 5)],
  brand: () => ['Apple', 'Samsung', 'Sony', 'Nike', 'Adidas'][Math.floor(Math.random() * 5)],
  model: () => `Pro-${Math.floor(Math.random() * 6) + 2020}`,

  // Contact
  phone: () => `+34 ${Math.floor(Math.random() * 100) + 600} ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 900) + 100}`,
  address: () => `Calle ${['Mayor', 'Principal', 'Central', 'Real'][Math.floor(Math.random() * 4)]} ${Math.floor(Math.random() * 200) + 1}`,
  city: () => ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Murcia', 'Palma', 'Bilbao', 'Alicante'][Math.floor(Math.random() * 10)],
  country: 'España',
  postal_code: () => `${Math.floor(Math.random() * 41) + 10}${Math.floor(Math.random() * 900) + 100}`,

  // IDs
  order_id: () => `ORD-${Math.floor(Math.random() * 9000) + 1000}`,
  invoice_id: () => `INV-${Math.floor(Math.random() * 9000) + 1000}`,
  customer_id: () => `CUST-${Math.floor(Math.random() * 900) + 100}`,
  transaction_id: () => `TXN-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,

  // Status
  status: () => ['Activo', 'Pendiente', 'Completado', 'En Proceso'][Math.floor(Math.random() * 4)],
  priority: () => ['Alta', 'Media', 'Baja'][Math.floor(Math.random() * 3)],
  type: () => ['Premium', 'Estándar', 'Básico'][Math.floor(Math.random() * 3)],
  version: () => `${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
  code: () => Math.random().toString(36).substr(2, 6).toUpperCase(),
  reference: () => `REF-${Math.floor(Math.random() * 9000) + 1000}`
};