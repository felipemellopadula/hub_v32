import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Model token costs
const MODEL_COSTS = {
  // Synergy model
  'synergy-ia': 5000,
  // Claude 4 models (Anthropic)
  'claude-opus-4-1-20250805': 15000,
  'claude-sonnet-4-5': 10000,
  'claude-haiku-4-5': 2500,
  'grok-4-0709': 15000,
  'grok-3': 10000,
  'grok-3-mini': 3000,
  // OpenAI Models baseado na documentação oficial
  'gpt-5': 25000, // $1.25 entrada + $10 saída (média)
  'gpt-5-mini': 5625, // $0.25 entrada + $2 saída (média)
  'gpt-5-nano': 1125, // $0.05 entrada + $0.4 saída (média)
  'gpt-4.1': 15000, // $3 entrada + $12 saída (ajuste fino)
  'gpt-4.1-mini': 4000, // $0.8 entrada + $3.2 saída (ajuste fino)
  'gpt-4.1-nano': 1000, // $0.2 entrada + $0.8 saída (ajuste fino)
  'o4-mini': 8000, // $4 entrada + $16 saída (ajuste fino)
  'claude-3-haiku-20240307': 12000,
  // Google Gemini Models
  'gemini-2.5-pro-002': 12000,
  'gemini-2.5-flash-002': 12000,
  'gemini-2.5-flash-lite-001': 12000,
  'gemini-pro': 12000,
  // Legacy models
  'gpt-4o-mini': 12000,
  'gpt-4o': 12000,
  // DeepSeek Models
  'deepseek-chat': 8000,
  'deepseek-reasoner': 12000,
  // APILLM Models
  'llama-4-maverick': 8000,
  'llama-4-scout': 6000,
  'deepseek-r1': 5000,
  'llama-3.3-70b-instruct': 3000,
  'llama-3.2-11b-instruct': 2000,
  'llama-3.2-8b-instruct': 1000,
  'llama-3.2-3b-instruct': 800,
  'llama-3.2-1b-instruct': 500,
} as const;

export const useTokens = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);

  const getTokenCost = useCallback((modelName: string): number => {
    // Default cost for unknown models
    return MODEL_COSTS[modelName as keyof typeof MODEL_COSTS] || 5000;
  }, []);

  const checkTokenBalance = useCallback(async (modelName: string): Promise<boolean> => {
    if (!user || !profile) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para usar este recurso.",
        variant: "destructive",
      });
      return false;
    }

    const cost = getTokenCost(modelName);
    
    if (profile.tokens_remaining < cost) {
      toast({
        title: "Tokens insuficientes",
        description: `Você precisa de ${cost.toLocaleString()} tokens, mas possui apenas ${profile.tokens_remaining.toLocaleString()}.`,
        variant: "destructive",
      });
      return false;
    }

    return true;
  }, [user, profile, getTokenCost, toast]);

  const consumeTokens = useCallback(async (modelName: string | undefined, message: string): Promise<boolean> => {
    if (!user || !profile) return false;
    
    // If no model selected, show error
    if (!modelName) {
      toast({
        title: "Modelo não selecionado",
        description: "Por favor, selecione um modelo de IA antes de enviar uma mensagem.",
        variant: "destructive",
      });
      return false;
    }

    setChecking(true);
    
    try {
      const cost = getTokenCost(modelName);
      
      // Check if user has enough tokens
      if (profile.tokens_remaining < cost) {
        toast({
          title: "Tokens insuficientes",
          description: `Você precisa de ${cost.toLocaleString()} tokens, mas possui apenas ${profile.tokens_remaining.toLocaleString()}.`,
          variant: "destructive",
        });
        return false;
      }

      // Deduct tokens from user profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          tokens_remaining: profile.tokens_remaining - cost 
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating tokens:', updateError);
        toast({
          title: "Erro",
          description: "Não foi possível consumir os tokens. Tente novamente.",
          variant: "destructive",
        });
        return false;
      }

      // Log token usage
      await supabase
        .from('token_usage')
        .insert({
          user_id: user.id,
          model_name: modelName,
          tokens_used: cost,
          message_content: message.substring(0, 1000), // Limit message length
        });

      // Refresh profile to update token count
      await refreshProfile();

      return true;
    } catch (error) {
      console.error('Error consuming tokens:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar os tokens.",
        variant: "destructive",
      });
      return false;
    } finally {
      setChecking(false);
    }
  }, [user, profile, getTokenCost, refreshProfile, toast]);

  const getModelDisplayName = useCallback((modelName: string): string => {
    const displayNames: Record<string, string> = {
      // Synergy
      'synergy-ia': 'SynergyIA',
      // OpenAI Models
      'gpt-5': 'GPT-5',
      'gpt-5-mini': 'GPT-5 Mini', 
      'gpt-5-nano': 'GPT-5 Nano',
      'gpt-4.1': 'GPT-4.1',
      'gpt-4.1-mini': 'GPT-4.1 Mini',
      'gpt-4.1-nano': 'GPT-4.1 Nano', 
      'o4-mini': 'o4 Mini',
      'claude-opus-4-1-20250805': 'Claude Opus 4.1',
      'claude-sonnet-4-5': 'Claude Sonnet 4.5',
      'claude-haiku-4-5': 'Claude Haiku 4.5',
      'grok-4-0709': 'Grok 4',
      'grok-3': 'Grok 3', 
      'grok-3-mini': 'Grok 3 Mini',
      'claude-3-haiku-20240307': 'Claude 3 Haiku',
      // Google Gemini Models
      'gemini-2.5-pro-002': 'Gemini 2.5 Pro',
      'gemini-2.5-flash-002': 'Gemini 2.5 Flash',
      'gemini-2.5-flash-lite-001': 'Gemini 2.5 Flash-Lite',
      'gemini-pro': 'Gemini Pro',
      // DeepSeek Models
      'deepseek-chat': 'DeepSeek Chat V3',
      'deepseek-reasoner': 'DeepSeek Reasoner',
      // APILLM Models
      'llama-4-maverick': 'Llama 4 Maverick',
      'llama-4-scout': 'Llama 4 Scout',
      'deepseek-r1': 'DeepSeek R1',
      'llama-3.3-70b-instruct': 'Llama 3.3 70B Instruct',
      'llama-3.2-11b-instruct': 'Llama 3.2 11B Instruct',
      'llama-3.2-8b-instruct': 'Llama 3.2 8B Instruct',
      'llama-3.2-3b-instruct': 'Llama 3.2 3B Instruct',
      'llama-3.2-1b-instruct': 'Llama 3.2 1B Instruct',
    };
    
    return displayNames[modelName] || modelName;
  }, []);

  return {
    tokenBalance: profile?.tokens_remaining || 0,
    getTokenCost,
    checkTokenBalance,
    consumeTokens,
    getModelDisplayName,
    checking,
  };
};