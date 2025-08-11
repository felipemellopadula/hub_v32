import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Model token costs
const MODEL_COSTS = {
  'claude-3-5-sonnet-20241022': 10000,
  'claude-3-opus-20240229': 10000,
  'grok-beta': 10000,
  'gpt-4o': 10000,
  'gpt-4o-mini': 2000,
  'gpt-4-turbo': 10000,
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

  const consumeTokens = useCallback(async (modelName: string, message: string): Promise<boolean> => {
    if (!user || !profile) return false;

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
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
      'claude-3-opus-20240229': 'Claude 3 Opus',
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