// API REST para NORTEEXPRESO - Versión actualizada con MySQL real
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'norteexpreso_secret_key';

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'norteexpreso',
  password: process.env.DB_PASSWORD || 'claveSegura123',
  database: process.env.DB_NAME || 'transporte_db',
  port: process.env.DB_PORT || 3306,
  charset: 'utf8mb4',
  timezone: '+00:00'
};

// Pool de conexiones
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000
});

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Middleware para logging de requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Función para probar la conexión
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexión a MySQL establecida correctamente');
    console.log(`📊 Base de datos: ${dbConfig.database}`);
    console.log(`🏠 Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`👤 Usuario: ${dbConfig.user}`);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Error al conectar con MySQL:', error.message);
    console.error('💡 Verifica que MySQL esté ejecutándose y las credenciales sean correctas');
    return false;
  }
}

// Middleware para verificar JWT
const verificarToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// ==========================================
// RUTAS DE AUTENTICACIÓN
// ==========================================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { usuario, password, type } = req.body;
    console.log(`🔐 Intento de login para usuario: ${usuario}, tipo: ${type}`);
    
    if (type === 'admin') {
      // Login de administrador
      const [usuarios] = await pool.execute(`
        SELECT 
          u.codigo,
          u.usuario,
          u.clave,
          u.estado,
          u.tipo_usuario_codigo,
          tu.descripcion as tipo_usuario,
          CONCAT(p.nombre, ' ', p.apellidos) as nombre_completo,
          e.email
        FROM USUARIOS u
        INNER JOIN TIPO_USUARIO tu ON u.tipo_usuario_codigo = tu.codigo
        INNER JOIN EMPLEADO e ON u.empleado_codigo = e.codigo
        INNER JOIN PERSONA p ON e.codigo = p.codigo
        WHERE u.usuario = ? AND u.estado = 'activo'
      `, [usuario]);
      
      if (usuarios.length === 0) {
        console.log(`❌ Usuario admin no encontrado: ${usuario}`);
        return res.status(401).json({ error: 'Usuario no encontrado' });
      }
      
      const usuarioData = usuarios[0];
      
      // Verificar contraseña
      const passwordValida = await bcrypt.compare(password, usuarioData.clave);
      if (!passwordValida) {
        console.log(`❌ Contraseña incorrecta para usuario admin: ${usuario}`);
        return res.status(401).json({ error: 'Contraseña incorrecta' });
      }
      
      // Generar JWT
      const token = jwt.sign(
        { 
          codigo: usuarioData.codigo,
          usuario: usuarioData.usuario,
          tipo_usuario: usuarioData.tipo_usuario,
          type: 'admin'
        },
        JWT_SECRET,
        { expiresIn: '8h' }
      );
      
      console.log(`✅ Login admin exitoso para usuario: ${usuario}`);
      
      res.json({
        token,
        usuario: {
          codigo: usuarioData.codigo,
          usuario: usuarioData.usuario,
          nombre_completo: usuarioData.nombre_completo,
          email: usuarioData.email,
          tipo_usuario: usuarioData.tipo_usuario
        }
      });
    } else {
      // Login de cliente
      const [clientes] = await pool.execute(`
        SELECT 
          p.codigo,
          p.nombre,
          p.apellidos,
          p.dni,
          c.email,
          c.telefono,
          c.password,
          c.puntos,
          c.nivel,
          c.fecha_registro
        FROM PERSONA p
        INNER JOIN CLIENTE c ON p.codigo = c.codigo
        WHERE c.email = ? AND c.estado = 'activo'
      `, [usuario]);
      
      if (clientes.length === 0) {
        console.log(`❌ Cliente no encontrado: ${usuario}`);
        return res.status(401).json({ error: 'Cliente no encontrado' });
      }
      
      const clienteData = clientes[0];
      
      // Verificar contraseña
      const passwordValida = await bcrypt.compare(password, clienteData.password);
      if (!passwordValida) {
        console.log(`❌ Contraseña incorrecta para cliente: ${usuario}`);
        return res.status(401).json({ error: 'Contraseña incorrecta' });
      }
      
      // Generar JWT
      const token = jwt.sign(
        { 
          codigo: clienteData.codigo,
          email: clienteData.email,
          type: 'customer'
        },
        JWT_SECRET,
        { expiresIn: '8h' }
      );
      
      console.log(`✅ Login cliente exitoso para: ${usuario}`);
      
      res.json({
        token,
        cliente: {
          codigo: clienteData.codigo,
          nombre: clienteData.nombre,
          apellidos: clienteData.apellidos,
          email: clienteData.email,
          dni: clienteData.dni,
          telefono: clienteData.telefono,
          puntos: clienteData.puntos,
          nivel: clienteData.nivel,
          fechaRegistro: clienteData.fecha_registro
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Registro de cliente
app.post('/api/auth/register-cliente', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { nombre, apellidos, dni, telefono, email, password } = req.body;
    console.log(`📝 Registrando nuevo cliente: ${email}`);
    
    await connection.beginTransaction();
    
    // Verificar si ya existe el DNI o email
    const [existingPersona] = await connection.execute(
      'SELECT codigo FROM PERSONA WHERE dni = ?',
      [dni]
    );
    
    const [existingCliente] = await connection.execute(
      'SELECT codigo FROM CLIENTE WHERE email = ?',
      [email]
    );
    
    if (existingPersona.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Ya existe una persona con este DNI' });
    }
    
    if (existingCliente.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Ya existe un cliente con este email' });
    }
    
    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insertar persona
    const [personaResult] = await connection.execute(`
      INSERT INTO PERSONA (nombre, apellidos, dni) 
      VALUES (?, ?, ?)
    `, [nombre, apellidos, dni]);
    
    const personaCodigo = personaResult.insertId;
    
    // Insertar cliente
    await connection.execute(`
      INSERT INTO CLIENTE (codigo, email, telefono, password, puntos, nivel, fecha_registro, estado) 
      VALUES (?, ?, ?, ?, 0, 'Bronce', NOW(), 'activo')
    `, [personaCodigo, email, telefono, hashedPassword]);
    
    await connection.commit();
    
    console.log(`✅ Cliente registrado exitosamente: ${email}`);
    
    res.json({
      success: true,
      message: 'Cliente registrado exitosamente',
      cliente: {
        codigo: personaCodigo,
        nombre,
        apellidos,
        dni,
        email,
        telefono
      }
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error registrando cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    connection.release();
  }
});

// Registro de administrador
app.post('/api/auth/register-admin', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { nombre, apellidos, dni, telefono, email, direccion, usuario, password, cargo_codigo } = req.body;
    console.log(`📝 Registrando nuevo administrador: ${usuario}`);
    
    await connection.beginTransaction();
    
    // Verificar si ya existe el DNI, email o usuario
    const [existingPersona] = await connection.execute(
      'SELECT codigo FROM PERSONA WHERE dni = ?',
      [dni]
    );
    
    const [existingEmail] = await connection.execute(
      'SELECT codigo FROM EMPLEADO WHERE email = ?',
      [email]
    );
    
    const [existingUsuario] = await connection.execute(
      'SELECT codigo FROM USUARIOS WHERE usuario = ?',
      [usuario]
    );
    
    if (existingPersona.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Ya existe una persona con este DNI' });
    }
    
    if (existingEmail.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Ya existe un empleado con este email' });
    }
    
    if (existingUsuario.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Ya existe un usuario con este nombre' });
    }
    
    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insertar persona
    const [personaResult] = await connection.execute(`
      INSERT INTO PERSONA (nombre, apellidos, dni) 
      VALUES (?, ?, ?)
    `, [nombre, apellidos, dni]);
    
    const personaCodigo = personaResult.insertId;
    
    // Crear contrato
    const [contratoResult] = await connection.execute(`
      INSERT INTO CONTRATO (fecha_inicio, sueldo, turno_codigo) 
      VALUES (NOW(), 3000.00, 1)
    `);
    
    const contratoCodigo = contratoResult.insertId;
    
    // Insertar empleado
    await connection.execute(`
      INSERT INTO EMPLEADO (codigo, direccion, telefono, email, contrato_codigo, cargo_codigo) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [personaCodigo, direccion, telefono, email, contratoCodigo, cargo_codigo]);
    
    // Insertar usuario
    await connection.execute(`
      INSERT INTO USUARIOS (usuario, clave, estado, empleado_codigo, tipo_usuario_codigo) 
      VALUES (?, ?, 'activo', ?, 1)
    `, [usuario, hashedPassword, personaCodigo]);
    
    await connection.commit();
    
    console.log(`✅ Administrador registrado exitosamente: ${usuario}`);
    
    res.json({
      success: true,
      message: 'Administrador registrado exitosamente',
      admin: {
        codigo: personaCodigo,
        nombre,
        apellidos,
        dni,
        email,
        usuario
      }
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error registrando administrador:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    connection.release();
  }
});

// ==========================================
// RUTAS PÚBLICAS (sin autenticación)
// ==========================================

// Obtener rutas disponibles
app.get('/api/rutas', async (req, res) => {
  try {
    console.log('📍 Obteniendo rutas disponibles...');
    const [rutas] = await pool.execute(`
      SELECT codigo, origen, destino, costo_referencial 
      FROM RUTAS 
      ORDER BY origen, destino
    `);
    console.log(`✅ ${rutas.length} rutas encontradas`);
    res.json(rutas);
  } catch (error) {
    console.error('❌ Error al obtener rutas:', error);
    res.status(500).json({ error: 'Error al obtener rutas' });
  }
});

// Buscar viajes
app.get('/api/viajes/buscar', async (req, res) => {
  try {
    const { origen, destino, fecha } = req.query;
    console.log(`🔍 Buscando viajes: ${origen} → ${destino} el ${fecha}`);
    
    const [viajes] = await pool.execute(`
      SELECT 
        v.codigo,
        v.fecha_hora_salida,
        v.fecha_hora_llegada_estimada,
        v.estado,
        r.origen,
        r.destino,
        r.costo_referencial,
        b.placa,
        b.fabricante,
        b.num_asientos,
        CONCAT(p.nombre, ' ', p.apellidos) as chofer_nombre,
        (b.num_asientos - COALESCE(asientos_ocupados.ocupados, 0)) as asientos_disponibles
      FROM VIAJE v
      INNER JOIN RUTAS r ON v.ruta_codigo = r.codigo
      INNER JOIN BUSES b ON v.bus_codigo = b.codigo
      INNER JOIN CHOFER ch ON v.chofer_codigo = ch.codigo
      INNER JOIN EMPLEADO e ON ch.codigo = e.codigo
      INNER JOIN PERSONA p ON e.codigo = p.codigo
      LEFT JOIN (
        SELECT viaje_codigo, COUNT(*) as ocupados
        FROM PASAJE 
        WHERE estado = 'Vendido'
        GROUP BY viaje_codigo
      ) asientos_ocupados ON v.codigo = asientos_ocupados.viaje_codigo
      WHERE r.origen = ? 
        AND r.destino = ? 
        AND DATE(v.fecha_hora_salida) = ?
        AND v.estado = 'Programado'
      ORDER BY v.fecha_hora_salida
    `, [origen, destino, fecha]);
    
    console.log(`✅ ${viajes.length} viajes encontrados`);
    res.json(viajes);
  } catch (error) {
    console.error('❌ Error al buscar viajes:', error);
    res.status(500).json({ error: 'Error al buscar viajes' });
  }
});

// Obtener asientos ocupados de un viaje
app.get('/api/viajes/:viajeId/asientos', async (req, res) => {
  try {
    const { viajeId } = req.params;
    console.log(`🪑 Obteniendo asientos ocupados para viaje ${viajeId}`);
    
    const [asientosOcupados] = await pool.execute(`
      SELECT asiento 
      FROM PASAJE 
      WHERE viaje_codigo = ? AND estado = 'Vendido'
    `, [viajeId]);
    
    const asientos = asientosOcupados.map(a => a.asiento);
    console.log(`✅ ${asientos.length} asientos ocupados: [${asientos.join(', ')}]`);
    res.json(asientos);
  } catch (error) {
    console.error('❌ Error al obtener asientos:', error);
    res.status(500).json({ error: 'Error al obtener asientos' });
  }
});

// ==========================================
// RUTAS PROTEGIDAS (requieren autenticación)
// ==========================================

// Procesar compra completa de pasajes
app.post('/api/pasajes/compra-completa', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    console.log('🛒 Procesando compra completa de pasajes...');
    console.log('📦 Datos recibidos:', JSON.stringify(req.body, null, 2));
    
    const { viaje_codigo, cliente, asientos, metodo_pago, datosAdicionales } = req.body;
    
    // Validar datos requeridos
    if (!viaje_codigo || !cliente || !asientos) {
      return res.status(400).json({ 
        error: 'Datos incompletos: se requiere viaje_codigo, cliente y asientos' 
      });
    }
    
    await connection.beginTransaction();
    
    // 1. Registrar o obtener cliente
    let clienteCodigo;
    const [clienteExistente] = await connection.execute(`
      SELECT codigo FROM PERSONA WHERE dni = ?
    `, [cliente.dni]);
    
    if (clienteExistente.length > 0) {
      clienteCodigo = clienteExistente[0].codigo;
      console.log(`Cliente existente encontrado: ${clienteCodigo}`);
    } else {
      // Insertar nueva persona
      const [personaResult] = await connection.execute(`
        INSERT INTO PERSONA (nombre, apellidos, dni) 
        VALUES (?, ?, ?)
      `, [cliente.nombre, cliente.apellidos, cliente.dni]);
      
      clienteCodigo = personaResult.insertId;
      
      // Insertar como cliente
      await connection.execute(`
        INSERT INTO CLIENTE (codigo, razon_social, ruc) 
        VALUES (?, NULL, NULL)
      `, [clienteCodigo]);
      
      console.log(`Nuevo cliente creado: ${clienteCodigo}`);
    }
    
    // 2. Obtener información del viaje para calcular precio
    const [viajeInfo] = await connection.execute(`
      SELECT r.costo_referencial 
      FROM VIAJE v
      INNER JOIN RUTAS r ON v.ruta_codigo = r.codigo
      WHERE v.codigo = ?
    `, [viaje_codigo]);
    
    if (viajeInfo.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Viaje no encontrado' });
    }
    
    const costoUnitario = viajeInfo[0].costo_referencial;
    const pasajesCreados = [];
    
    // 3. Crear pasajes para cada asiento
    for (const asiento of asientos) {
      console.log(`📝 Creando pasaje para asiento ${asiento}...`);
      
      // Verificar disponibilidad del asiento
      const [asientoOcupado] = await connection.execute(`
        SELECT codigo FROM PASAJE 
        WHERE viaje_codigo = ? AND asiento = ? AND estado = 'Vendido'
      `, [viaje_codigo, asiento]);
      
      if (asientoOcupado.length > 0) {
        await connection.rollback();
        return res.status(400).json({ error: `El asiento ${asiento} ya está ocupado` });
      }
      
      // Calcular precio (incluir costo de mascota si aplica)
      let importeTotal = costoUnitario;
      if (datosAdicionales?.viaja_con_mascota) {
        importeTotal += 15.00; // Costo adicional por mascota
      }
      
      // Insertar pasaje
      const [result] = await connection.execute(`
        INSERT INTO PASAJE (
          viaje_codigo, 
          cliente_codigo, 
          asiento, 
          importe_pagar, 
          usuario_vendedor_codigo, 
          estado
        ) VALUES (?, ?, ?, ?, 1, 'Vendido')
      `, [viaje_codigo, clienteCodigo, asiento, importeTotal]);
      
      pasajesCreados.push(result.insertId);
      console.log(`✅ Pasaje creado: ID ${result.insertId} para asiento ${asiento}`);
    }
    
    await connection.commit();
    
    const totalImporte = pasajesCreados.length * costoUnitario + 
                        (datosAdicionales?.viaja_con_mascota ? 15.00 : 0);
    
    console.log(`🎉 Compra procesada exitosamente:`);
    console.log(`   - Cliente: ${cliente.nombre} ${cliente.apellidos}`);
    console.log(`   - Pasajes creados: ${pasajesCreados.length}`);
    console.log(`   - Total: S/ ${totalImporte.toFixed(2)}`);
    
    res.json({
      success: true,
      message: 'Compra procesada exitosamente',
      data: {
        clienteCodigo,
        pasajes: pasajesCreados,
        totalImporte
      }
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error procesando compra:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Error al procesar la compra' 
    });
  } finally {
    connection.release();
  }
});

// Obtener estadísticas del dashboard
app.get('/api/dashboard/estadisticas', verificarToken, async (req, res) => {
  try {
    console.log('📊 Obteniendo estadísticas del dashboard...');
    const hoy = new Date().toISOString().split('T')[0];
    
    // Ventas del día
    const [ventasHoy] = await pool.execute(`
      SELECT 
        COUNT(*) as total_pasajes,
        COALESCE(SUM(importe_pagar), 0) as total_ingresos
      FROM PASAJE 
      WHERE DATE(fecha_emision) = ? AND estado = 'Vendido'
    `, [hoy]);
    
    // Buses operativos
    const [busesOperativos] = await pool.execute(`
      SELECT COUNT(*) as total FROM BUSES WHERE estado = 'Operativo'
    `);
    
    // Viajes programados hoy
    const [viajesHoy] = await pool.execute(`
      SELECT COUNT(*) as total FROM VIAJE 
      WHERE DATE(fecha_hora_salida) = ? AND estado = 'Programado'
    `, [hoy]);
    
    // Rutas más populares
    const [rutasPopulares] = await pool.execute(`
      SELECT 
        r.origen,
        r.destino,
        COUNT(pa.codigo) as total_pasajes,
        SUM(pa.importe_pagar) as total_ingresos
      FROM RUTAS r
      INNER JOIN VIAJE v ON r.codigo = v.ruta_codigo
      INNER JOIN PASAJE pa ON v.codigo = pa.viaje_codigo
      WHERE pa.estado = 'Vendido'
      GROUP BY r.codigo, r.origen, r.destino
      ORDER BY total_pasajes DESC
      LIMIT 5
    `);
    
    const estadisticas = {
      ventas_hoy: {
        pasajeros: ventasHoy[0].total_pasajes,
        ingresos: ventasHoy[0].total_ingresos
      },
      buses_operativos: busesOperativos[0].total,
      viajes_programados: viajesHoy[0].total,
      rutas_populares: rutasPopulares
    };
    
    console.log('✅ Estadísticas obtenidas:', estadisticas);
    res.json(estadisticas);
    
  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Obtener todos los viajes (admin)
app.get('/api/admin/viajes', verificarToken, async (req, res) => {
  try {
    const { fecha, estado } = req.query;
    console.log(`📅 Obteniendo viajes admin - Fecha: ${fecha}, Estado: ${estado}`);
    
    let query = `
      SELECT 
        v.codigo,
        v.fecha_hora_salida,
        v.fecha_hora_llegada_estimada,
        v.estado,
        r.origen,
        r.destino,
        r.costo_referencial,
        b.placa,
        b.fabricante,
        b.num_asientos,
        CONCAT(p.nombre, ' ', p.apellidos) as chofer_nombre,
        (b.num_asientos - COALESCE(asientos_ocupados.ocupados, 0)) as asientos_disponibles
      FROM VIAJE v
      INNER JOIN RUTAS r ON v.ruta_codigo = r.codigo
      INNER JOIN BUSES b ON v.bus_codigo = b.codigo
      INNER JOIN CHOFER ch ON v.chofer_codigo = ch.codigo
      INNER JOIN EMPLEADO e ON ch.codigo = e.codigo
      INNER JOIN PERSONA p ON e.codigo = p.codigo
      LEFT JOIN (
        SELECT viaje_codigo, COUNT(*) as ocupados
        FROM PASAJE 
        WHERE estado = 'Vendido'
        GROUP BY viaje_codigo
      ) asientos_ocupados ON v.codigo = asientos_ocupados.viaje_codigo
    `;
    
    const params = [];
    const conditions = [];
    
    if (fecha) {
      conditions.push('DATE(v.fecha_hora_salida) = ?');
      params.push(fecha);
    }
    
    if (estado) {
      conditions.push('v.estado = ?');
      params.push(estado);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY v.fecha_hora_salida';
    
    const [viajes] = await pool.execute(query, params);
    res.json(viajes);
  } catch (error) {
    console.error('❌ Error al obtener viajes:', error);
    res.status(500).json({ error: 'Error al obtener viajes' });
  }
});

// Obtener buses
app.get('/api/admin/buses', verificarToken, async (req, res) => {
  try {
    console.log('🚌 Obteniendo lista de buses...');
    const [buses] = await pool.execute(`
      SELECT codigo, placa, fabricante, num_asientos, estado 
      FROM BUSES 
      ORDER BY placa
    `);
    console.log(`✅ ${buses.length} buses encontrados`);
    res.json(buses);
  } catch (error) {
    console.error('❌ Error al obtener buses:', error);
    res.status(500).json({ error: 'Error al obtener buses' });
  }
});

// ==========================================
// MANEJO DE ERRORES Y SERVIDOR
// ==========================================

// Middleware de manejo de errores
app.use((error, req, res, next) => {
  console.error('❌ Error no manejado:', error);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Ruta 404
app.use('*', (req, res) => {
  console.log(`❓ Endpoint no encontrado: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Iniciar servidor
async function iniciarServidor() {
  try {
    console.log('🚀 Iniciando servidor NORTEEXPRESO...');
    
    // Probar conexión a la base de datos
    const conexionExitosa = await testConnection();
    
    if (!conexionExitosa) {
      console.error('❌ No se pudo conectar a la base de datos');
      console.error('💡 Verifica que MySQL esté ejecutándose y las credenciales sean correctas');
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log(`🎉 Servidor API ejecutándose en puerto ${PORT}`);
      console.log(`📡 Endpoints disponibles:`);
      console.log(`   POST /api/auth/login`);
      console.log(`   POST /api/auth/register-cliente`);
      console.log(`   POST /api/auth/register-admin`);
      console.log(`   GET  /api/rutas`);
      console.log(`   GET  /api/viajes/buscar`);
      console.log(`   GET  /api/viajes/:id/asientos`);
      console.log(`   POST /api/pasajes/compra-completa`);
      console.log(`   GET  /api/dashboard/estadisticas`);
      console.log(`   GET  /api/admin/viajes`);
      console.log(`   GET  /api/admin/buses`);
      console.log(`🔗 Frontend URL: http://localhost:5173`);
    });
    
  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error);
    process.exit(1);
  }
}

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando servidor...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Cerrando servidor...');
  await pool.end();
  process.exit(0);
});

// Iniciar servidor si este archivo se ejecuta directamente
if (require.main === module) {
  iniciarServidor();
}

module.exports = app;