import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Model token costs
const MODEL_COSTS = {
  // Claude 4 models (Anthropic)
  'claude-opus-4-1-20250805': 15000,
  'claude-sonnet-4-20250514': 10000,
  'grok-beta': 10000,
  'gpt-5': 12000,
  'gpt-5-mini': 3000,
  'gpt-5-nano': 1000,
  'claude-3-haiku-20240307': 2000,
  // DeepSeek Models
  'deepseek-chat': 8000,
  'deepseek-reasoner': 12000,
  // APILLM Models
  'Llama-4-Maverick-17B-128E-Instruct-FP8': 8000,
  'Llama-4-Scout-17B-16E-Instruct-FP8': 6000,
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
      'gpt-5': 'GPT-5',
      'gpt-5-mini': 'GPT-5 Mini',
      'gpt-5-nano': 'GPT-5 Nano',
      'claude-opus-4-1-20250805': 'Claude Opus 4.1',
      'claude-sonnet-4-20250514': 'Claude Sonnet 4',
      'grok-beta': 'Grok',
      'claude-3-haiku-20240307': 'Claude 3 Haiku',
      // DeepSeek Models
      'deepseek-chat': 'DeepSeek Chat V3',
      'deepseek-reasoner': 'DeepSeek Reasoner',
      // APILLM Models
      'Llama-4-Maverick-17B-128E-Instruct-FP8': 'Llama 4 Maverick',
      'Llama-4-Scout-17B-16E-Instruct-FP8': 'Llama 4 Scout',
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