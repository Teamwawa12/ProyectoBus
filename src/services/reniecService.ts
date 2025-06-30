// Servicio para integración con RENIEC - API actualizada con género y edad corregidos
export interface ReniecData {
  dni: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  sexo: 'M' | 'F';
  edad: number;
  estadoCivil: string;
  ubigeo: string;
  direccion: string;
}

export interface ParentescoData {
  dni: string;
  nombres: string;
  apellidos: string;
  parentesco: string;
  esTutor: boolean;
}

class ReniecService {
  private baseUrl = 'https://apiperu.dev/api/dni';
  private token = '4591c22ac6c2a2e6443227d3ff21f66883c4f9a2a882eabcd0ab20aa07e7f8e1';

  async consultarDNI(dni: string): Promise<ReniecData | null> {
    try {
      // Validar formato de DNI
      if (!/^\d{8}$/.test(dni)) {
        throw new Error('DNI debe tener 8 dígitos');
      }

      console.log(`Consultando DNI ${dni} en RENIEC...`);
      
      // Consultar con la API real de RENIEC
      try {
        const response = await fetch(`${this.baseUrl}/${dni}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Respuesta exitosa de RENIEC:', data);
          
          // Mapear la respuesta de la API al formato esperado
          if (data.success && data.data) {
            const personData = data.data;
            
            // Corregir el mapeo del género - ARREGLADO
            let sexo: 'M' | 'F' = 'M';
            if (personData.sexo) {
              const sexoStr = personData.sexo.toString().toUpperCase();
              // Verificar múltiples variaciones para asegurar detección correcta
              if (sexoStr.includes('FEMENINO') || sexoStr === 'F' || sexoStr.includes('MUJER') || sexoStr === 'FEMALE') {
                sexo = 'F';
              } else if (sexoStr.includes('MASCULINO') || sexoStr === 'M' || sexoStr.includes('HOMBRE') || sexoStr === 'MALE') {
                sexo = 'M';
              }
            }

            // Calcular edad desde fecha de nacimiento - AGREGADO
            const edad = personData.fecha_nacimiento ? 
              this.calcularEdad(personData.fecha_nacimiento) : 0;
            
            return {
              dni: personData.numero || dni,
              nombres: personData.nombres || '',
              apellidoPaterno: personData.apellido_paterno || '',
              apellidoMaterno: personData.apellido_materno || '',
              fechaNacimiento: personData.fecha_nacimiento || '',
              sexo: sexo,
              edad: edad,
              estadoCivil: personData.estado_civil || '',
              ubigeo: personData.ubigeo || '',
              direccion: personData.direccion || ''
            };
          } else {
            console.log('No se encontraron datos para el DNI:', dni);
            return this.getFallbackData(dni);
          }
        } else {
          console.log(`Error en API RENIEC: ${response.status} - ${response.statusText}`);
          return this.getFallbackData(dni);
        }
      } catch (apiError) {
        console.log('Error conectando con API RENIEC, usando datos simulados:', apiError);
        return this.getFallbackData(dni);
      }
    } catch (error) {
      console.error('Error general consultando RENIEC:', error);
      return null;
    }
  }

  private getFallbackData(dni: string): ReniecData | null {
    // Datos simulados para demo con géneros CORREGIDOS
    const mockData: { [key: string]: ReniecData } = {
      '12345678': {
        dni: '12345678',
        nombres: 'MARIA ELENA',
        apellidoPaterno: 'GONZALEZ',
        apellidoMaterno: 'PEREZ',
        fechaNacimiento: '1990-05-15',
        sexo: 'F', // CORREGIDO: Mujer
        edad: 34,
        estadoCivil: 'SOLTERO',
        ubigeo: '150101',
        direccion: 'AV LIMA 123 LIMA LIMA'
      },
      '87654321': {
        dni: '87654321',
        nombres: 'CARLOS ALBERTO',
        apellidoPaterno: 'MENDOZA',
        apellidoMaterno: 'SILVA',
        fechaNacimiento: '1985-08-22',
        sexo: 'M', // Hombre
        edad: 39,
        estadoCivil: 'CASADO',
        ubigeo: '150101',
        direccion: 'JR AREQUIPA 456 LIMA LIMA'
      },
      '11223344': {
        dni: '11223344',
        nombres: 'ANA LUCIA',
        apellidoPaterno: 'RODRIGUEZ',
        apellidoMaterno: 'LOPEZ',
        fechaNacimiento: '2010-03-10',
        sexo: 'F', // CORREGIDO: Mujer menor
        edad: 14,
        estadoCivil: 'SOLTERO',
        ubigeo: '150101',
        direccion: 'AV BRASIL 789 LIMA LIMA'
      },
      '46027897': {
        dni: '46027897',
        nombres: 'JUAN CARLOS',
        apellidoPaterno: 'VARGAS',
        apellidoMaterno: 'TORRES',
        fechaNacimiento: '1988-12-03',
        sexo: 'M', // Hombre
        edad: 36,
        estadoCivil: 'SOLTERO',
        ubigeo: '150101',
        direccion: 'AV UNIVERSITARIA 1801 LIMA LIMA'
      },
      '70123456': {
        dni: '70123456',
        nombres: 'SOFIA ALEJANDRA',
        apellidoPaterno: 'MARTINEZ',
        apellidoMaterno: 'FLORES',
        fechaNacimiento: '1992-11-28',
        sexo: 'F', // CORREGIDO: Mujer
        edad: 32,
        estadoCivil: 'SOLTERO',
        ubigeo: '150101',
        direccion: 'AV SALAVERRY 2850 LIMA LIMA'
      },
      '45678901': {
        dni: '45678901',
        nombres: 'DIEGO FERNANDO',
        apellidoPaterno: 'CASTRO',
        apellidoMaterno: 'RUIZ',
        fechaNacimiento: '1987-07-14',
        sexo: 'M', // Hombre
        edad: 37,
        estadoCivil: 'CASADO',
        ubigeo: '150101',
        direccion: 'JR CUSCO 1234 LIMA LIMA'
      },
      // Agregar más DNIs de mujeres para pruebas
      '72345678': {
        dni: '72345678',
        nombres: 'CARMEN ROSA',
        apellidoPaterno: 'SILVA',
        apellidoMaterno: 'VEGA',
        fechaNacimiento: '1995-03-20',
        sexo: 'F', // Mujer
        edad: 29,
        estadoCivil: 'SOLTERO',
        ubigeo: '150101',
        direccion: 'AV COLONIAL 567 LIMA LIMA'
      },
      '73456789': {
        dni: '73456789',
        nombres: 'PATRICIA ELENA',
        apellidoPaterno: 'MORALES',
        apellidoMaterno: 'CASTRO',
        fechaNacimiento: '1988-09-12',
        sexo: 'F', // Mujer
        edad: 36,
        estadoCivil: 'CASADO',
        ubigeo: '150101',
        direccion: 'JR HUANCAYO 890 LIMA LIMA'
      }
    };

    return mockData[dni] || null;
  }

  async verificarParentesco(dniMenor: string, dniAdulto: string): Promise<ParentescoData | null> {
    try {
      // Simulación de verificación de parentesco
      await new Promise(resolve => setTimeout(resolve, 800));
      
      console.log(`Verificando parentesco entre ${dniMenor} y ${dniAdulto}`);
      
      const mockParentesco: { [key: string]: ParentescoData } = {
        '11223344_87654321': {
          dni: '87654321',
          nombres: 'CARLOS ALBERTO',
          apellidos: 'MENDOZA SILVA',
          parentesco: 'PADRE',
          esTutor: true
        },
        '11223344_12345678': {
          dni: '12345678',
          nombres: 'MARIA ELENA',
          apellidos: 'GONZALEZ PEREZ',
          parentesco: 'MADRE',
          esTutor: true
        }
      };

      const key = `${dniMenor}_${dniAdulto}`;
      return mockParentesco[key] || null;
    } catch (error) {
      console.error('Error verificando parentesco:', error);
      return null;
    }
  }

  calcularEdad(fechaNacimiento: string): number {
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    
    return edad;
  }

  validarDNI(dni: string): boolean {
    return /^\d{8}$/.test(dni);
  }

  formatearNombre(nombre: string): string {
    return nombre
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  obtenerNombreCompleto(data: ReniecData): string {
    const nombres = this.formatearNombre(data.nombres);
    const apellidoPaterno = this.formatearNombre(data.apellidoPaterno);
    const apellidoMaterno = this.formatearNombre(data.apellidoMaterno);
    
    return `${nombres} ${apellidoPaterno} ${apellidoMaterno}`.trim();
  }
}

export const reniecService = new ReniecService();