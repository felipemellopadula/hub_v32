import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AdminAuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

export const useAdminAuth = () => {
  const [state, setState] = useState<AdminAuthState>({
    user: null,
    isAdmin: false,
    loading: true,
  });

  // Check if user is in admin_users table
  const checkAdminStatus = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }
      
      return !!data;
    } catch (err) {
      console.error('Error checking admin status:', err);
      return false;
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (session?.user) {
          const isAdmin = await checkAdminStatus(session.user.id);
          setState({
            user: session.user,
            isAdmin,
            loading: false,
          });
        } else {
          setState({
            user: null,
            isAdmin: false,
            loading: false,
          });
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setState({
            user: null,
            isAdmin: false,
            loading: false,
          });
        }
      }
    };

    // Set up auth state listener before getting session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        if (event === 'SIGNED_OUT') {
          setState({
            user: null,
            isAdmin: false,
            loading: false,
          });
          return;
        }

        if (session?.user) {
          // Use setTimeout to debounce duplicate SIGNED_IN events
          setTimeout(async () => {
            if (!mounted) return;
            const isAdmin = await checkAdminStatus(session.user.id);
            setState({
              user: session.user,
              isAdmin,
              loading: false,
            });
          }, 100);
        }
      }
    );

    initAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkAdminStatus]);

  // Sign in with email and password using Supabase Auth
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: { message: error.message } };
      }

      if (data.user) {
        // Check if user is admin
        const isAdmin = await checkAdminStatus(data.user.id);
        
        if (!isAdmin) {
          // Sign out if not an admin
          await supabase.auth.signOut();
          return { error: { message: 'Email não autorizado para acesso administrativo' } };
        }

        setState({
          user: data.user,
          isAdmin: true,
          loading: false,
        });

        return { error: null };
      }

      return { error: { message: 'Erro desconhecido ao fazer login' } };
    } catch (err) {
      console.error('Sign in error:', err);
      return { error: { message: 'Erro ao fazer login. Tente novamente.' } };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Sign out error:', error);
        return { error: { message: error.message } };
      }

      setState({
        user: null,
        isAdmin: false,
        loading: false,
      });

      return { error: null };
    } catch (err) {
      console.error('Sign out error:', err);
      return { error: { message: 'Erro ao sair. Tente novamente.' } };
    }
  };

  return {
    user: state.user,
    isAdmin: state.isAdmin,
    loading: state.loading,
    signIn,
    signOut,
  };
};
