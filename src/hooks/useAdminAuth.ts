import { useState, useEffect } from "react";

const ADMIN_EMAILS = [
  'valdiney.victor@gmail.com',
  'fmello.85@gmail.com',
  'murilo.vicossi@gmail.com',
  'alanvazcardoso@gmail.com'
];

const ADMIN_PASSWORD = 'SynergyAi1234';

export const useAdminAuth = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if user is logged in as admin (using localStorage for simplicity)
    const adminUser = localStorage.getItem('adminUser');
    if (adminUser) {
      const userData = JSON.parse(adminUser);
      setUser(userData);
      setIsAdmin(true);
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    // Simple validation - check if email is in admin list and password matches
    if (!ADMIN_EMAILS.includes(email)) {
      return { error: { message: 'Email não autorizado para acesso administrativo' } };
    }
    
    if (password !== ADMIN_PASSWORD) {
      return { error: { message: 'Senha incorreta' } };
    }
    
    // Create admin user object
    const adminUser = { 
      email, 
      id: email, 
      role: 'admin',
      name: email.split('@')[0] 
    };
    
    // Store in localStorage
    localStorage.setItem('adminUser', JSON.stringify(adminUser));
    
    setUser(adminUser);
    setIsAdmin(true);
    
    return { error: null };
  };

  const signOut = async () => {
    localStorage.removeItem('adminUser');
    setUser(null);
    setIsAdmin(false);
    return { error: null };
  };

  return {
    user,
    isAdmin,
    loading,
    signIn,
    signOut
  };
};