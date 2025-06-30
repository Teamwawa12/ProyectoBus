import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Usuario } from '../types';
import { databaseService } from '../services/databaseService';

interface AuthContextType {
  user: Usuario | null;
  customerUser: any | null;
  login: (usuario: string, password: string, type?: 'admin' | 'customer') => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isCustomerAuthenticated: boolean;
  isLoading: boolean;
  userType: 'admin' | 'customer' | null;
  registerCustomer: (data: any) => Promise<{ success: boolean; error?: string }>;
  registerAdmin: (data: any) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [customerUser, setCustomerUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userType, setUserType] = useState<'admin' | 'customer' | null>(null);

  useEffect(() => {
    // Verificar si hay un usuario guardado en localStorage
    const savedUser = localStorage.getItem('norteexpreso_user');
    const savedCustomer = localStorage.getItem('norteexpreso_customer');
    const savedUserType = localStorage.getItem('norteexpreso_user_type');
    
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setUserType('admin');
    } else if (savedCustomer) {
      setCustomerUser(JSON.parse(savedCustomer));
      setUserType('customer');
    }
    
    setIsLoading(false);
  }, []);

  const login = async (usuario: string, password: string, type: 'admin' | 'customer' = 'admin'): Promise<boolean> => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ usuario, password, type })
      });

      if (response.ok) {
        const data = await response.json();
        
        if (type === 'admin' && data.usuario) {
          const mockUser: Usuario = {
            codigo: data.usuario.codigo,
            usuario: data.usuario.usuario,
            estado: 'activo',
            personal: {
              codigo: data.usuario.codigo,
              nombre: data.usuario.nombre_completo.split(' ')[0],
              apellidos: data.usuario.nombre_completo.split(' ').slice(1).join(' '),
              dni: '12345678',
              direccion: 'Lima, Perú',
              telefono: '999999999',
              email: data.usuario.email,
              cargo: data.usuario.tipo_usuario,
              area: 'Sistemas'
            },
            tipo_usuario: data.usuario.tipo_usuario
          };

          setUser(mockUser);
          setUserType('admin');
          localStorage.setItem('norteexpreso_user', JSON.stringify(mockUser));
          localStorage.setItem('norteexpreso_user_type', 'admin');
          localStorage.setItem('norteexpreso_token', data.token);
          return true;
        } else if (type === 'customer' && data.cliente) {
          setCustomerUser(data.cliente);
          setUserType('customer');
          localStorage.setItem('norteexpreso_customer', JSON.stringify(data.cliente));
          localStorage.setItem('norteexpreso_user_type', 'customer');
          localStorage.setItem('norteexpreso_token', data.token);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error en login:', error);
      return false;
    }
  };

  const registerCustomer = async (data: any): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await databaseService.registrarCliente(data);
      return result;
    } catch (error) {
      console.error('Error registrando cliente:', error);
      return { success: false, error: 'Error de conexión' };
    }
  };

  const registerAdmin = async (data: any): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await databaseService.registrarAdmin(data);
      return result;
    } catch (error) {
      console.error('Error registrando admin:', error);
      return { success: false, error: 'Error de conexión' };
    }
  };

  const logout = () => {
    setUser(null);
    setCustomerUser(null);
    setUserType(null);
    localStorage.removeItem('norteexpreso_user');
    localStorage.removeItem('norteexpreso_customer');
    localStorage.removeItem('norteexpreso_user_type');
    localStorage.removeItem('norteexpreso_token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        customerUser,
        login,
        logout,
        isAuthenticated: !!user,
        isCustomerAuthenticated: !!customerUser,
        isLoading,
        userType,
        registerCustomer,
        registerAdmin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}