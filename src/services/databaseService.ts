// Servicio para conectar con la base de datos MySQL real
export interface PasajeData {
  viaje_codigo: number;
  cliente: {
    nombre: string;
    apellidos: string;
    dni: string;
    telefono?: string;
    email?: string;
  };
  asientos: number[];
  metodo_pago: string;
  telefono_contacto?: string;
  viaja_con_mascota?: boolean;
  tipo_mascota?: string;
  nombre_mascota?: string;
  peso_mascota?: number;
  tutor_nombre?: string;
  tutor_dni?: string;
  permiso_notarial?: boolean;
}

export interface RegistroClienteData {
  nombre: string;
  apellidos: string;
  dni: string;
  telefono: string;
  email: string;
  password: string;
}

export interface RegistroAdminData {
  nombre: string;
  apellidos: string;
  dni: string;
  telefono: string;
  email: string;
  direccion: string;
  usuario: string;
  password: string;
  cargo_codigo: number;
}

class DatabaseService {
  private baseUrl = 'http://localhost:3001/api';

  // Método para obtener asientos ocupados desde la base de datos real
  async obtenerAsientosOcupados(viajeId: number): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/viajes/${viajeId}/asientos`);
      if (response.ok) {
        const asientos = await response.json();
        return asientos;
      }
      return [];
    } catch (error) {
      console.error('Error obteniendo asientos ocupados:', error);
      return [];
    }
  }

  // Método para guardar pasaje en la base de datos real
  async guardarPasaje(pasajeData: PasajeData): Promise<{ success: boolean; pasajes?: number[]; error?: string }> {
    try {
      console.log('Guardando pasaje en base de datos:', pasajeData);
      
      const response = await fetch(`${this.baseUrl}/pasajes/compra-completa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          viaje_codigo: pasajeData.viaje_codigo,
          cliente: pasajeData.cliente,
          asientos: pasajeData.asientos,
          metodo_pago: pasajeData.metodo_pago,
          datosAdicionales: {
            telefono_contacto: pasajeData.telefono_contacto,
            viaja_con_mascota: pasajeData.viaja_con_mascota,
            tipo_mascota: pasajeData.tipo_mascota,
            nombre_mascota: pasajeData.nombre_mascota,
            peso_mascota: pasajeData.peso_mascota,
            tutor_nombre: pasajeData.tutor_nombre,
            tutor_dni: pasajeData.tutor_dni,
            permiso_notarial: pasajeData.permiso_notarial
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        return {
          success: true,
          pasajes: result.data?.pasajes || []
        };
      } else {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error || 'Error al guardar el pasaje'
        };
      }
    } catch (error) {
      console.error('Error guardando pasaje:', error);
      return {
        success: false,
        error: 'Error de conexión con el servidor'
      };
    }
  }

  // Método para buscar viajes en la base de datos real
  async buscarViajes(origen: string, destino: string, fecha: string) {
    try {
      const response = await fetch(`${this.baseUrl}/viajes/buscar?origen=${encodeURIComponent(origen)}&destino=${encodeURIComponent(destino)}&fecha=${fecha}`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (error) {
      console.error('Error buscando viajes:', error);
      return [];
    }
  }

  // Método para registrar cliente
  async registrarCliente(clienteData: RegistroClienteData): Promise<{ success: boolean; error?: string; cliente?: any }> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/register-cliente`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clienteData)
      });

      const result = await response.json();
      
      if (response.ok) {
        return {
          success: true,
          cliente: result.cliente
        };
      } else {
        return {
          success: false,
          error: result.error || 'Error al registrar cliente'
        };
      }
    } catch (error) {
      console.error('Error registrando cliente:', error);
      return {
        success: false,
        error: 'Error de conexión con el servidor'
      };
    }
  }

  // Método para registrar administrador
  async registrarAdmin(adminData: RegistroAdminData): Promise<{ success: boolean; error?: string; admin?: any }> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/register-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(adminData)
      });

      const result = await response.json();
      
      if (response.ok) {
        return {
          success: true,
          admin: result.admin
        };
      } else {
        return {
          success: false,
          error: result.error || 'Error al registrar administrador'
        };
      }
    } catch (error) {
      console.error('Error registrando administrador:', error);
      return {
        success: false,
        error: 'Error de conexión con el servidor'
      };
    }
  }

  // Método para obtener estadísticas reales
  async obtenerEstadisticas() {
    try {
      const response = await fetch(`${this.baseUrl}/dashboard/estadisticas`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return null;
    }
  }

  // Método para obtener rutas reales
  async obtenerRutas() {
    try {
      const response = await fetch(`${this.baseUrl}/rutas`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (error) {
      console.error('Error obteniendo rutas:', error);
      return [];
    }
  }
}

export const databaseService = new DatabaseService();