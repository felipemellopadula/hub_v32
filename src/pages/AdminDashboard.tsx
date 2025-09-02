import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { AdminStatsCards } from "@/components/AdminStatsCards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TokenUsage {
  id: string;
  user_id: string;
  tokens_used: number;
  model_name: string;
  message_content: string | null;
  created_at: string;
}

interface AdminStats {
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  totalUsers: number;
  totalTokens: number;
}

// OpenAI pricing (per million tokens)
const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-5': { input: 30.0, output: 120.0 },
  'gpt-4.1': { input: 30.0, output: 120.0 },
  'o4': { input: 30.0, output: 120.0 },
  'gpt-4o': { input: 5.0, output: 15.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 }, // SynergyAi uses gpt-4o-mini
  'synergyai': { input: 0.15, output: 0.6 }, // Map SynergyAi to gpt-4o-mini pricing
  'gpt-4': { input: 30.0, output: 60.0 },
  'gpt-3.5-turbo': { input: 3.0, output: 6.0 }
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAdminAuth();
  const [adminStats, setAdminStats] = useState<AdminStats>({
    totalCost: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalUsers: 0,
    totalTokens: 0
  });
  const [recentUsage, setRecentUsage] = useState<TokenUsage[]>([]);
  const [loading, setLoading] = useState(true);

  const charsToTokens = (chars: number): number => Math.ceil(chars / 4);

  const getCostPerToken = (model: string, type: 'input' | 'output'): number => {
    const modelKey = Object.keys(OPENAI_PRICING).find(key => 
      model.toLowerCase().includes(key.toLowerCase()) || 
      (model.toLowerCase() === 'synergyai' && key === 'synergyai')
    ) || 'gpt-4o-mini';
    
    return OPENAI_PRICING[modelKey][type] / 1_000_000;
  };

  const calculateAdminStats = (data: TokenUsage[]): AdminStats => {
    let totalCost = 0;
    let totalRevenue = 0;
    let totalTokens = 0;
    const uniqueUsers = new Set<string>();

    data.forEach((usage) => {
      const messageLength = usage.message_content?.length || 0;
      const tokens = Math.max(usage.tokens_used, charsToTokens(messageLength));
      
      // Assume 70% input, 30% output for cost calculation
      const inputTokens = Math.floor(tokens * 0.7);
      const outputTokens = Math.floor(tokens * 0.3);
      
      const inputCost = inputTokens * getCostPerToken(usage.model_name, 'input');
      const outputCost = outputTokens * getCostPerToken(usage.model_name, 'output');
      const cost = inputCost + outputCost;
      
      // Revenue with 200% markup (3x the cost)
      const revenue = cost * 3;
      
      totalCost += cost;
      totalRevenue += revenue;
      totalTokens += tokens;
      
      if (usage.user_id) {
        uniqueUsers.add(usage.user_id);
      }
    });

    return {
      totalCost,
      totalRevenue,
      totalProfit: totalRevenue - totalCost,
      totalUsers: uniqueUsers.size,
      totalTokens
    };
  };

  useEffect(() => {
    const fetchAdminData = async () => {
      if (!isAdmin && user !== null) return;

      try {
        // Fetch all token usage data
        const { data: allUsage, error } = await supabase
          .from('token_usage')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (allUsage) {
          setAdminStats(calculateAdminStats(allUsage));
          setRecentUsage(allUsage.slice(0, 10)); // Show last 10 transactions
        }
      } catch (error) {
        console.error('Error fetching admin data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchAdminData();
    }
  }, [isAdmin, authLoading, user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin && user !== null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Acesso Negado</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Você não tem permissões de administrador para acessar esta área.
            </p>
            <Button onClick={() => navigate('/')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">
                Dashboard Administrativo
              </h1>
            </div>
          </div>
        </div>

        <Alert className="mb-6">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Dashboard administrativo com visão completa de todos os custos e receitas do hub.
          </AlertDescription>
        </Alert>

        {/* Stats Cards */}
        <AdminStatsCards {...adminStats} />

        {/* Recent Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Transações Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentUsage.length > 0 ? (
              <div className="space-y-4">
                {recentUsage.map((usage) => {
                  const messageLength = usage.message_content?.length || 0;
                  const tokens = Math.max(usage.tokens_used, charsToTokens(messageLength));
                  const inputTokens = Math.floor(tokens * 0.7);
                  const outputTokens = Math.floor(tokens * 0.3);
                  const inputCost = inputTokens * getCostPerToken(usage.model_name, 'input');
                  const outputCost = outputTokens * getCostPerToken(usage.model_name, 'output');
                  const cost = inputCost + outputCost;
                  const revenue = cost * 3;
                  const profit = revenue - cost;

                  return (
                    <div key={usage.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{usage.model_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {tokens.toLocaleString()} tokens
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate max-w-md">
                          {usage.message_content || 'Sem conteúdo'}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-primary">
                          +${profit.toFixed(4)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ${cost.toFixed(4)} → ${revenue.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma transação encontrada
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;