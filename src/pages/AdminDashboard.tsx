import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { AdminStatsCards } from "@/components/AdminStatsCards";
import { StorageCleanup } from "@/components/StorageCleanup";
import { OpenAIPricingTable } from "@/components/OpenAIPricingTable";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Shield, AlertTriangle, RefreshCw } from "lucide-react";
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

// OpenAI pricing per million tokens (USD) - Updated from user's table
const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-5': { input: 1.25, output: 10.00 },
  'gpt-5-mini': { input: 0.25, output: 2.00 },
  'gpt-5-nano': { input: 0.05, output: 0.40 },
  'gpt-4.1': { input: 3.00, output: 12.00 },
  'gpt-4.1-mini': { input: 0.80, output: 3.20 },
  'gpt-4.1-nano': { input: 0.20, output: 0.80 },
  'o4-mini': { input: 4.00, output: 16.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'synergyai': { input: 0.15, output: 0.60 }, // Same as gpt-4o-mini
  'gpt-4o': { input: 5.0, output: 15.0 },
  'gpt-4': { input: 30.0, output: 60.0 },
  'gpt-3.5-turbo': { input: 3.0, output: 6.0 }
};

// Gemini pricing per token (USD) - Based on Google AI Studio pricing converted to unit price
const GEMINI_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash-exp': { input: 0.30 / 1_000_000, output: 2.50 / 1_000_000 },
  'gemini-1.5-pro': { input: 1.25 / 1_000_000, output: 10.00 / 1_000_000 },
  'gemini-1.5-flash': { input: 0.30 / 1_000_000, output: 2.50 / 1_000_000 },
  'gemini-1.5-flash-8b': { input: 0.10 / 1_000_000, output: 0.40 / 1_000_000 },
  'gemini-pro': { input: 0.30 / 1_000_000, output: 2.50 / 1_000_000 },
  'gemini-flash': { input: 0.30 / 1_000_000, output: 2.50 / 1_000_000 }
};

// Claude pricing per million tokens (USD) - Based on Anthropic pricing from user's table
const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4.1': { input: 15.0, output: 75.0 },
  'claude-opus-4': { input: 15.0, output: 75.0 },
  'claude-sonnet-4': { input: 3.0, output: 15.0 },
  'claude-haiku-3.5': { input: 0.80, output: 4.0 },
  'claude-3-5-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-opus': { input: 15.0, output: 75.0 },
  'claude-3-haiku': { input: 0.25, output: 1.25 }
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
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'gemini' | 'claude' | 'todos'>('todos');

  const charsToTokens = (chars: number): number => Math.ceil(chars / 4);

  const getCostPerToken = (model: string, type: 'input' | 'output', provider: 'openai' | 'gemini' | 'claude' | 'todos' = selectedProvider): number => {
    let modelKey = model.toLowerCase();
    
    // Handle SynergyAI mapping
    if (modelKey === 'synergyai') {
      modelKey = 'gpt-4o-mini';
      provider = 'openai';
    }
    
    if (provider === 'gemini') {
      // Check if it's a Gemini model
      const isGeminiModel = modelKey.includes('gemini') || Object.keys(GEMINI_PRICING).some(key => 
        modelKey.includes(key.toLowerCase()) || key.toLowerCase().includes(modelKey)
      );
      
      if (isGeminiModel) {
        const matchedKey = Object.keys(GEMINI_PRICING).find(key => 
          modelKey.includes(key.toLowerCase()) || key.toLowerCase().includes(modelKey)
        ) || 'gemini-1.5-flash';
        
        return GEMINI_PRICING[matchedKey][type]; // Already converted to unit price
      }
    }
    
    if (provider === 'claude') {
      // Check if it's a Claude model
      const isClaudeModel = modelKey.includes('claude') || Object.keys(CLAUDE_PRICING).some(key => 
        modelKey.includes(key.toLowerCase()) || key.toLowerCase().includes(modelKey)
      );
      
      if (isClaudeModel) {
        const matchedKey = Object.keys(CLAUDE_PRICING).find(key => 
          modelKey.includes(key.toLowerCase()) || key.toLowerCase().includes(modelKey)
        ) || 'claude-haiku-3.5';
        
        // Convert from per million tokens to per individual token: $X per 1M tokens = $X / 1,000,000 per token
        return CLAUDE_PRICING[matchedKey][type] / 1_000_000;
      }
    }
    
    // Default to OpenAI pricing (convert from per million to unit price)
    const matchedKey = Object.keys(OPENAI_PRICING).find(key => 
      modelKey.includes(key.toLowerCase()) || key.toLowerCase().includes(modelKey)
    ) || 'gpt-4o-mini';
    
    return OPENAI_PRICING[matchedKey][type] / 1_000_000;
  };

  const calculateAdminStats = (data: TokenUsage[], providerFilter: 'openai' | 'gemini' | 'claude' | 'todos' = 'todos'): AdminStats => {
    let filteredData = data;
    
    // Filter data based on selected provider
    if (providerFilter !== 'todos') {
      filteredData = data.filter((usage) => {
        const isGeminiModel = usage.model_name.toLowerCase().includes('gemini');
        const isClaudeModel = usage.model_name.toLowerCase().includes('claude');
        
        if (providerFilter === 'gemini') return isGeminiModel;
        if (providerFilter === 'claude') return isClaudeModel;
        return !isGeminiModel && !isClaudeModel; // OpenAI models
      });
    }
    
    let totalCost = 0;
    let totalRevenue = 0;
    let totalTokens = 0;
    const uniqueUsers = new Set<string>();

    filteredData.forEach((usage) => {
      // Input: convert message content characters to tokens (4 chars = 1 token)
      const inputCharacters = usage.message_content?.length || 0;
      const inputTokens = charsToTokens(inputCharacters);
      
      // Output: estimate IA response tokens (typically 2-3x input size)
      // Since we don't have the actual IA response, we estimate based on input
      const outputTokens = Math.floor(inputTokens * 2.5); // Conservative estimate
      
      // Detect provider based on model name
      const isGeminiModel = usage.model_name.toLowerCase().includes('gemini');
      const isClaudeModel = usage.model_name.toLowerCase().includes('claude');
      let provider: 'openai' | 'gemini' | 'claude' = 'openai';
      
      if (isGeminiModel) provider = 'gemini';
      else if (isClaudeModel) provider = 'claude';
      
      // Calculate costs using correct pricing per token type
      const inputCost = inputTokens * getCostPerToken(usage.model_name, 'input', provider);
      const outputCost = outputTokens * getCostPerToken(usage.model_name, 'output', provider);
      const totalCostForTransaction = inputCost + outputCost;
      
      // Total tokens used (input + estimated output)
      const totalTokensForTransaction = inputTokens + outputTokens;
      
      // Revenue calculation: cost + 200% profit margin = 3x cost
      const revenue = totalCostForTransaction * 3;
      
      totalCost += totalCostForTransaction;
      totalRevenue += revenue;
      totalTokens += totalTokensForTransaction;
      
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
      try {
        console.log('Fetching admin data via edge function...');
        
        // Call the admin-data edge function that bypasses RLS
        const { data: response, error } = await supabase.functions.invoke('admin-data');

        if (error) {
          console.error('Function error:', error);
          throw error;
        }

        if (!response.success) {
          throw new Error(response.error);
        }

        const allUsage = response.data;
        console.log('Token usage data fetched:', allUsage?.length, 'records');

        if (allUsage) {
          setAdminStats(calculateAdminStats(allUsage, selectedProvider));
          setRecentUsage(allUsage.slice(0, 15)); // Show last 15 transactions
        }
      } catch (error) {
        console.error('Error fetching admin data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && isAdmin) {
      fetchAdminData();
      
      // Auto-refresh every 30 seconds (reduced from 5s to improve performance)
      const interval = setInterval(fetchAdminData, 30000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, authLoading, user, selectedProvider]);

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
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <ThemeToggle />
          </div>
        </div>

        <Alert className="mb-6">
          <Shield className="h-4 w-4" />
            <AlertDescription>
              Dashboard administrativo com visão completa de todos os custos e receitas do hub.
              <br />
              <span className="text-xs text-muted-foreground">
                • Conversão: 4 caracteres = 1 token • Margem de lucro: 200% (3x custo) • Cálculo automático para OpenAI e Gemini
              </span>
            </AlertDescription>
        </Alert>

        {/* Stats Cards */}
        <AdminStatsCards {...adminStats} selectedProvider={selectedProvider} />

        {/* Storage Cleanup */}
        <div className="mb-8">
          <StorageCleanup />
        </div>

        {/* Provider Selection and Pricing Table */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Preços dos Modelos de IA</CardTitle>
                <Select value={selectedProvider} onValueChange={(value: 'openai' | 'gemini' | 'claude' | 'todos') => setSelectedProvider(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Selecionar provedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="claude">Anthropic Claude</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {(selectedProvider === 'openai' || selectedProvider === 'todos') && <OpenAIPricingTable />}
              {(selectedProvider === 'gemini' || selectedProvider === 'todos') && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Modelo</th>
                        <th className="text-right p-3 font-medium">Entrada (USD/1M tokens)</th>
                        <th className="text-right p-3 font-medium">Saída (USD/1M tokens)</th>
                        <th className="text-right p-3 font-medium">Custo por Token (Entrada)</th>
                        <th className="text-right p-3 font-medium">Custo por Token (Saída)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(GEMINI_PRICING).map(([model, pricing]) => (
                        <tr key={model} className="border-b">
                          <td className="p-3 font-medium">{model}</td>
                          <td className="text-right p-3 text-blue-400">${(pricing.input * 1_000_000).toFixed(2)}</td>
                          <td className="text-right p-3 text-blue-400">${(pricing.output * 1_000_000).toFixed(2)}</td>
                          <td className="text-right p-3 text-blue-400">${pricing.input.toFixed(10)}</td>
                          <td className="text-right p-3 text-blue-400">${pricing.output.toFixed(10)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {(selectedProvider === 'claude' || selectedProvider === 'todos') && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Modelo</th>
                        <th className="text-right p-3 font-medium">Entrada (USD/1M tokens)</th>
                        <th className="text-right p-3 font-medium">Saída (USD/1M tokens)</th>
                        <th className="text-right p-3 font-medium">Custo por Token (Entrada)</th>
                        <th className="text-right p-3 font-medium">Custo por Token (Saída)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(CLAUDE_PRICING).map(([model, pricing]) => (
                        <tr key={model} className="border-b">
                          <td className="p-3 font-medium">{model}</td>
                          <td className="text-right p-3 text-purple-400">${pricing.input.toFixed(2)}</td>
                          <td className="text-right p-3 text-purple-400">${pricing.output.toFixed(2)}</td>
                          <td className="text-right p-3 text-purple-400">${(pricing.input / 1_000_000).toFixed(10)}</td>
                          <td className="text-right p-3 text-purple-400">${(pricing.output / 1_000_000).toFixed(10)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Usage */}
        <Card>
          <CardHeader>
            <CardTitle>
              Transações Recentes 
              {selectedProvider !== 'todos' && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({selectedProvider === 'openai' ? 'OpenAI' : selectedProvider === 'gemini' ? 'Google Gemini' : 'Anthropic Claude'})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              // Filter recent usage based on selected provider
              let filteredUsage = recentUsage;
              if (selectedProvider !== 'todos') {
                filteredUsage = recentUsage.filter((usage) => {
                  const isGeminiModel = usage.model_name.toLowerCase().includes('gemini');
                  const isClaudeModel = usage.model_name.toLowerCase().includes('claude');
                  
                  if (selectedProvider === 'gemini') return isGeminiModel;
                  if (selectedProvider === 'claude') return isClaudeModel;
                  return !isGeminiModel && !isClaudeModel; // OpenAI models
                });
              }
              
              return filteredUsage.length > 0 ? (
                <div className="space-y-4">
                  {filteredUsage.map((usage) => {
                  // Input: convert message content characters to tokens (4 chars = 1 token)
                  const inputCharacters = usage.message_content?.length || 0;
                  const inputTokens = charsToTokens(inputCharacters);
                  
                  // Output: estimate IA response tokens (typically 2-3x input size)
                  const outputTokens = Math.floor(inputTokens * 2.5);
                  
                  // Detect provider based on model name
                  const isGeminiModel = usage.model_name.toLowerCase().includes('gemini');
                  const isClaudeModel = usage.model_name.toLowerCase().includes('claude');
                  let provider: 'openai' | 'gemini' | 'claude' = 'openai';
                  
                  if (isGeminiModel) provider = 'gemini';
                  else if (isClaudeModel) provider = 'claude';
                  
                  // Calculate costs using correct pricing per token type
                  const inputCost = inputTokens * getCostPerToken(usage.model_name, 'input', provider);
                  const outputCost = outputTokens * getCostPerToken(usage.model_name, 'output', provider);
                  const totalCost = inputCost + outputCost;
                  
                  // Total tokens used (input + estimated output)
                  const totalTokens = inputTokens + outputTokens;
                  
                  // Revenue calculation: cost + 200% profit margin = 3x cost
                  const revenue = totalCost * 3;
                  const profit = revenue - totalCost;

                  return (
                    <div key={usage.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <span className="font-medium text-sm">{usage.model_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {totalTokens.toLocaleString()} tokens
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {inputCharacters.toLocaleString()} caracteres
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-primary">
                          +${profit.toFixed(4)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Custo: ${totalCost.toFixed(4)} → Receita: ${revenue.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  );
                 })}
                 </div>
               ) : (
                  <p className="text-center text-muted-foreground py-8">
                    {selectedProvider !== 'todos' 
                      ? `Nenhuma transação encontrada para ${selectedProvider === 'openai' ? 'OpenAI' : selectedProvider === 'gemini' ? 'Google Gemini' : 'Anthropic Claude'}`
                      : 'Nenhuma transação encontrada'
                    }
                  </p>
               );
             })()}
           </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;