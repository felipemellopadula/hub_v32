import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// Custom hook to safely use navigate
const useSafeNavigate = () => {
  try {
    return useNavigate();
  } catch {
    return null;
  }
};

interface Profile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  subscription_type: 'free' | 'paid' | 'admin';
  tokens_remaining: number;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string, phone?: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const navigate = useSafeNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper: derive best possible name from OAuth metadata
  const deriveNameFromMetadata = (u?: User | null) => {
    const md: any = u?.user_metadata || {};
    const name = md.name || md.full_name || [md.given_name, md.family_name].filter(Boolean).join(' ');
    return name || 'Usuário';
  };

  // Helper: extract avatar URL from OAuth/Supabase metadata
  const extractAvatarFromUser = (u?: User | null): string | null => {
    if (!u) return null;
    const md: any = u.user_metadata || {};
    const identities: any[] = (u as any).identities || [];
    const facebook = identities.find((i: any) => i.provider === 'facebook');
    const google = identities.find((i: any) => i.provider === 'google');
    const fromIdentity =
      facebook?.identity_data?.avatar_url ||
      facebook?.identity_data?.picture ||
      google?.identity_data?.avatar_url ||
      google?.identity_data?.picture;
    return md.avatar_url || md.picture || fromIdentity || null;
  };

  const fetchProfile = async (userId: string, currentUser?: User) => {
    try {
      // For Google OAuth users, create optimistic profile immediately
      const isGoogleOAuth = currentUser?.app_metadata?.provider === 'google';
      
      if (isGoogleOAuth) {
        // Set temporary profile immediately for fast UI
        const tempProfile = {
          id: userId,
          name: deriveNameFromMetadata(currentUser),
          email: currentUser?.email || '',
          subscription_type: 'paid' as const,
          tokens_remaining: 1000000,
          avatar_url: extractAvatarFromUser(currentUser),
          phone: (currentUser?.user_metadata?.phone as string) || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setProfile(tempProfile);
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      if (!data) {
        // Create profile in background for Google users (already showing temp profile)
        const defaultProfile = {
          id: userId,
          name: deriveNameFromMetadata(currentUser),
          email: currentUser?.email || '',
          subscription_type: 'paid' as const,
          tokens_remaining: 1000000,
          avatar_url: extractAvatarFromUser(currentUser),
          phone: (currentUser?.user_metadata?.phone as string) || null,
        };

        if (isGoogleOAuth) {
          // For Google users, create profile in background
          setTimeout(() => {
            supabase
              .from('profiles')
              .insert(defaultProfile)
              .select()
              .single()
              .then(({ data: inserted, error: insertError }) => {
                if (insertError) {
                  console.error('Error creating profile:', insertError);
                } else if (inserted) {
                  setProfile(inserted);
                }
              });
          }, 0);
        } else {
          // For regular users, create profile synchronously
          const { data: inserted, error: insertError } = await supabase
            .from('profiles')
            .insert(defaultProfile)
            .select()
            .single();

          if (insertError) {
            console.error('Error creating default profile:', insertError);
            return;
          }
          setProfile(inserted);
        }
        return;
      }

      // Update profile with fetched data
      setProfile(data);

      // Check for updates needed and update in background
      const desiredName = deriveNameFromMetadata(currentUser);
      const desiredAvatar = extractAvatarFromUser(currentUser);
      const needsNameUpdate = (!data.name || data.name === 'Usuário') && desiredName && desiredName !== data.name;
      const needsAvatarUpdate = (!data.avatar_url || data.avatar_url.length === 0) && desiredAvatar;

      if (needsNameUpdate || needsAvatarUpdate) {
        // Update in background without blocking
        const updates: Partial<Profile> = {};
        if (needsNameUpdate) updates.name = desiredName;
        if (needsAvatarUpdate) updates.avatar_url = desiredAvatar;
        
        supabase
          .from('profiles')
          .update(updates)
          .eq('id', userId)
          .select('*')
          .single()
          .then(({ data: updated, error: updateError }) => {
            if (updateError) {
              console.error('Error updating profile:', updateError);
            } else if (updated) {
              setProfile(updated);
            }
          });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, user);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        console.log('Auth state change:', event, session?.user?.id);
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (session?.user && event !== 'SIGNED_OUT') {
          fetchProfile(session.user.id, session.user);
          
          // Redirect to dashboard-novo for sign-in events (only from login pages, not /home2)
          if ((event === 'SIGNED_IN' || (event === 'TOKEN_REFRESHED' && window.location.pathname === '/')) && 
              (window.location.pathname === '/' || window.location.pathname === '/auth')) {
            console.log('Redirecting to /dashboard-novo...');
            if (navigate) {
              navigate('/dashboard-novo', { replace: true });
            } else {
              window.location.replace('/dashboard-novo');
            }
          }
        } else {
          setProfile(null);
          // Only redirect if explicitly signed out
          if (event === 'SIGNED_OUT' && window.location.pathname !== '/home2') {
            if (navigate) {
              navigate('/home2', { replace: true });
            } else {
              window.location.replace('/home2');
            }
          }
        }
      }
    );

    // Check for existing session asynchronously
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      console.log('Initial session check:', session?.user?.id);
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        fetchProfile(session.user.id, session.user);
        
        // If user has session and is on homepage or auth, redirect to dashboard-novo
        if (window.location.pathname === '/' || window.location.pathname === '/auth') {
          console.log('Initial redirect to dashboard-novo...');
          if (navigate) {
            navigate('/dashboard-novo', { replace: true });
          } else {
            window.location.replace('/dashboard-novo');
          }
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // Let onAuthStateChange handle the redirect automatically
    return { error };
  };

  const signUp = async (email: string, password: string, name: string, phone?: string) => {
    const redirectUrl = `${window.location.origin}/dashboard-novo`;
    const normalizedEmail = email.trim().toLowerCase();
    
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name,
          phone,
        }
      }
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/dashboard-novo`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      }
    });
    return { error };
  };


  const signOut = async () => {
    try {
      console.log('Starting logout process...');
      
      // Primeiro fazer logout no Supabase para limpar tokens/storage
      await supabase.auth.signOut();
      
      // Limpar qualquer storage local manualmente
      localStorage.removeItem('sb-myqgnnqltemfpzdxwybj-auth-token');
      sessionStorage.clear();
      
      // Aguardar um pouco para garantir que o logout foi processado
      await new Promise(resolve => setTimeout(resolve, 200));
      
      console.log('Logout completed, redirecting to /home2...');
      
      // Redirecionamento para /home2
      if (navigate) {
        setTimeout(() => navigate('/home2', { replace: true }), 300);
      } else {
        setTimeout(() => window.location.replace('/home2'), 300);
      }
    } catch (error) {
      console.error('Error signing out:', error);
      // Forçar limpeza em caso de erro
      localStorage.clear();
      sessionStorage.clear();
      if (navigate) {
        setTimeout(() => navigate('/home2', { replace: true }), 100);
      } else {
        setTimeout(() => window.location.replace('/home2'), 100);
      }
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: 'No user logged in' };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (!error) {
      await refreshProfile();
    }

    return { error };
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    
    signOut,
    updateProfile,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;