import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Save, Camera, ArrowLeft, Settings as SettingsIcon, Moon, Sun } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import SettingsStats from "@/components/settings/SettingsStats";

// --- COMPONENTES AUXILIARES ---

const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <Button variant="outline" size="icon" onClick={() => setIsDark(!isDark)}>
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Alternar tema</span>
    </Button>
  );
};

const UserProfile = () => {
  const { profile } = useAuth();
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-9 w-9">
        <AvatarImage src={profile?.avatar_url || undefined} alt="Foto de perfil" />
        <AvatarFallback>{profile?.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium text-foreground hidden sm:inline">{profile?.name || "Usuário"}</span>
    </div>
  );
};

// --- COMPONENTE DE GRÁFICO TOTALMENTE RESPONSIVO ---
const ModelUsageChart = ({ cycleStart, cycleEnd }: { cycleStart: Date, cycleEnd: Date }) => {
  const data = [
      { name: 'synergy-ia', value: 450, color: '#8b5cf6' },
      { name: 'claude-opus', value: 200, color: '#4b5563' },
      { name: 'gpt-4.1-mini', value: 120, color: '#6b7280' },
      { name: 'gemini-2.0-flash', value: 100, color: '#ef4444' },
      { name: 'grok-beta', value: 80, color: '#ffffff' },
      { name: 'grok-4-0709', value: 50, color: '#a1a1aa' },
  ];

  const CustomLegend = ({ payload }: any) => (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm w-full mt-4">
      {payload.map((entry: any, index: number) => (
        <div key={`item-${index}`} className="flex items-center gap-2 truncate">
          <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground truncate" title={entry.value}>{entry.value}</span>
        </div>
      ))}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Uso por modelo (ciclo atual)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center w-full min-h-[280px]">
        {/* Container do Gráfico */}
        <div className="h-40 w-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} innerRadius={50} outerRadius={70} fill="#8884d8" paddingAngle={3} dataKey="value" stroke="none">
                {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Container da Legenda */}
        <CustomLegend payload={data.map(item => ({ value: item.name.replace(/-(\d{4})-(\d{2})-(\d{2})/, ''), color: item.color }))} />
      </CardContent>
    </Card>
  );
};

// --- PÁGINA PRINCIPAL ---
const SettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, updateProfile, refreshProfile, loading } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Configurações | Synergy AI";
  }, []);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setEmail(profile.email || "");
      setPhone(profile.phone || "");
      setAvatarPreview(profile.avatar_url || null);
    }
  }, [profile]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const { cycleStart, cycleEnd, nextReset } = useMemo(() => {
    if (!profile?.created_at) {
      const now = new Date();
      const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return { cycleStart: now, cycleEnd: end, nextReset: end };
    }
    const created = new Date(profile.created_at);
    const now = new Date();
    let start = new Date(created);
    const add30 = (d: Date) => new Date(d.getTime() + 30 * 24 * 60 * 60 * 1000);
    while (now >= add30(start)) {
      start = add30(start);
    }
    const end = add30(start);
    return { cycleStart: start, cycleEnd: end, nextReset: end };
  }, [profile?.created_at]);
  
  const formatDate = (d: Date) => {
    if (!d) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
      await updateProfile({ avatar_url: publicUrl });
      await refreshProfile();
      toast({ title: "Foto atualizada com sucesso!" });
    } catch (err) {
      toast({ title: "Erro ao atualizar foto", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const updates: Partial<typeof profile> = { name, phone };
      if (email && email !== profile.email) {
          const { error: authErr } = await supabase.auth.updateUser({ email: email.trim().toLowerCase() });
          if (authErr) throw authErr;
          updates.email = email.trim().toLowerCase();
          toast({ title: "Email atualizado", description: "Verifique sua caixa de entrada para confirmar." });
      }
      const { error } = await updateProfile(updates);
      if (error) throw error;
      await refreshProfile();
      toast({ title: "Configurações salvas!" });
    } catch (err) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return <div className="flex justify-center items-center min-h-screen">Carregando...</div>;
  }

  const planLabel = profile.subscription_type === "paid" ? "Profissional" : "Gratuito";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
            <div className="h-6 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-3">
              <SettingsIcon className="h-6 w-6 text-primary" />
              <h1 className="text-lg sm:text-xl font-bold text-foreground">Configurações</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <UserProfile />
            
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna do Perfil (ocupa 2 de 3 colunas em telas grandes) */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Perfil</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                  <Avatar className="h-24 w-24 flex-shrink-0">
                    <AvatarImage src={avatarPreview || undefined} alt="Foto de perfil" />
                    <AvatarFallback>{profile.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="w-full space-y-2">
                    <Label htmlFor="avatar-button">Foto</Label>
                    <div className="flex justify-center sm:justify-start">
                      <Input id="avatar-input" type="file" accept="image/*" onChange={handleAvatarChange} ref={avatarInputRef} className="hidden" />
                      <Button id="avatar-button" type="button" variant="outline" onClick={() => avatarInputRef.current?.click()}>
                        <Camera className="h-4 w-4 mr-2" />
                        Escolher arquivo
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nome</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(XX) XXXXX-XXXX"/>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                    <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar alterações"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Coluna de Stats e Gráfico (ocupa 1 de 3 colunas em telas grandes) */}
          <div className="lg:col-span-1 space-y-8">
            <SettingsStats
              planLabel={planLabel}
              tokensRemaining={profile.tokens_remaining}
              cycleStart={cycleStart}
              cycleEnd={cycleEnd}
              nextReset={nextReset}
            />
            <ModelUsageChart cycleStart={cycleStart} cycleEnd={cycleEnd} />
          </div>
        </section>
      </main>
    </div>
  );
};

export default SettingsPage;