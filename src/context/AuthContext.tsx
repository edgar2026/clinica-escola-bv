import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';
import { authService } from '../services/authService';
import type { Usuario, ToastMessage, AuthContextValue } from '../types';
import type { User } from '@supabase/supabase-js';

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);
  const initializingRef = useRef(true);

  const showToast = (mensagem: string, tipo: ToastMessage['tipo'] = 'info') => {
    setToastMessage({ mensagem, tipo });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchProfile = async (authUser?: User) => {
    try {
      const { profile } = await authService.getMe(authUser);
      if (profile) {
        setUsuario(profile);
      } else {
        setUsuario(null);
      }
    } catch {
      setUsuario(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (session) {
          await fetchProfile();
        }
        initializingRef.current = false;
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' && session) {
        await fetchProfile();
      } else if (event === 'SIGNED_OUT') {
        setUsuario(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, senha: string) => {
    const { user } = await authService.login(email, senha);
    await fetchProfile(user);
    showToast('Login realizado com sucesso!', 'sucesso');
  };

  const logout = () => {
    authService.logout();
    setUsuario(null);
    showToast('Sessao encerrada.', 'info');
  };

  return (
    <AuthContext.Provider value={{ usuario, setUsuario, loading, login, logout, showToast, toastMessage }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
