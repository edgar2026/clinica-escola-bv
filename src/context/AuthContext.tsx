import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';
import { authService } from '../services/authService';
import type { Usuario, ToastMessage, AuthContextValue } from '../types';
import type { User } from '@supabase/supabase-js';

const AuthContext = createContext<AuthContextValue | null>(null);

const clearSupabaseAuth = () => {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('sb-') || key.includes('supabase')) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);
  const initializingRef = useRef(true);

  const showToast = (mensagem: string, tipo: ToastMessage['tipo'] = 'info') => {
    setToastMessage({ mensagem, tipo });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchProfile = async (authUser?: User): Promise<boolean> => {
    try {
      const { profile } = await authService.getMe(authUser);
      if (profile) {
        setUsuario(profile);
        return true;
      }
      setUsuario(null);
      return false;
    } catch {
      setUsuario(null);
      return false;
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (event === 'INITIAL_SESSION') {
          if (session) {
            const ok = await fetchProfile();
            if (!ok) {
              await supabase.auth.signOut({ scope: 'local' });
              clearSupabaseAuth();
              setUsuario(null);
            }
          } else {
            setUsuario(null);
          }
          return;
        }

        if (event === 'SIGNED_IN' && session) {
          await fetchProfile();
        } else if (event === 'SIGNED_OUT') {
          setUsuario(null);
        }
      } catch {
        setUsuario(null);
      } finally {
        if (event === 'INITIAL_SESSION') {
          initializingRef.current = false;
          setLoading(false);
        }
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
    clearSupabaseAuth();
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
