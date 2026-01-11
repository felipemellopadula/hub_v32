import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Tipos de ação e seus custos em créditos (para novos usuários)
export type CreditActionType = 
  | 'image' 
  | 'video' 
  | 'edit' 
  | 'inpaint' 
  | 'avatar' 
  | 'skin_enhancer'
  | 'upscale';

// Custo fixo por tipo de ação (1 crédito = 1 ação, exceto upscale)
const ACTION_COSTS: Record<Exclude<CreditActionType, 'upscale'>, number> = {
  image: 1,
  video: 1,
  edit: 1,
  inpaint: 1,
  avatar: 1,
  skin_enhancer: 1,
};

/**
 * Calcula o custo do upscale baseado no tamanho da imagem
 * - ≤1K: 0.005 créditos (200 upscales por crédito)
 * - ≤2K: 0.01 créditos (100 upscales por crédito)
 * - ≤4K: 0.02 créditos (50 upscales por crédito)
 * - >4K: retorna -1 (não permitido)
 */
export const getUpscaleCost = (width: number, height: number): number => {
  const maxDimension = Math.max(width, height);
  
  if (maxDimension > 4096) {
    return -1; // Indica que deve bloquear
  }
  if (maxDimension <= 1024) {
    return 0.005; // 1K: 200 upscales por crédito
  }
  if (maxDimension <= 2048) {
    return 0.01; // 2K: 100 upscales por crédito
  }
  return 0.02; // 4K: 50 upscales por crédito
};

/**
 * Calcula o custo de vídeo baseado no modelo
 * Custos arredondados de 0.5 em 0.5:
 * - MiniMax: 0.5 créditos (2 vídeos por crédito)
 * - Seedance: 1.0 crédito
 * - Kling 2.6 Pro: 1.5 créditos
 * - Sora 2: 1.5 créditos
 * - Veo 3.1: 3.0 créditos
 * - Sora 2 Pro: 4.0 créditos
 */
export const getVideoCreditCost = (modelId: string): number => {
  // Sora 2 Pro = 4.0 créditos
  if (modelId === 'openai:3@2') return 4.0;
  
  // Veo 3.1 = 3.0 créditos
  if (modelId.includes('google:3@')) return 3.0;
  
  // LTX-2 Pro = 2.0 créditos
  if (modelId === 'lightricks:2@0') return 2.0;
  
  // Sora 2 = 1.5 créditos
  if (modelId === 'openai:3@1') return 1.5;
  
  // Kling 2.6 Pro = 1.5 créditos
  if (modelId.includes('klingai:')) return 1.5;
  
  // LTX-2 Fast = 1.5 créditos
  if (modelId === 'lightricks:2@1') return 1.5;
  
  // Seedance (ByteDance) = 1.0 crédito
  if (modelId.includes('bytedance:') || modelId.includes('seedance')) return 1.0;
  
  // MiniMax = 0.5 créditos (2 vídeos por crédito)
  return 0.5;
};

export const useCredits = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  // Verifica se é usuário legado (usa sistema de tokens antigo)
  const isLegacyUser = profile?.is_legacy_user ?? false;

  // Saldo de créditos disponíveis
  const creditsRemaining = profile?.tokens_remaining ?? 0;

  /**
   * Obtém o custo de uma ação
   */
  const getActionCost = useCallback((actionType: CreditActionType, dimensions?: { width: number; height: number }): number => {
    if (actionType === 'upscale' && dimensions) {
      return getUpscaleCost(dimensions.width, dimensions.height);
    }
    return ACTION_COSTS[actionType as Exclude<CreditActionType, 'upscale'>] ?? 1;
  }, []);

  /**
   * Verifica se o usuário tem créditos suficientes
   * Para usuários legados, sempre retorna true (sistema antigo valida separadamente)
   */
  const checkCredits = useCallback((actionType: CreditActionType, dimensions?: { width: number; height: number }): boolean => {
    if (!user || !profile) {
      toast.error("Você precisa estar logado para usar este recurso.");
      return false;
    }

    // Usuários legados usam sistema de tokens antigo
    if (isLegacyUser) {
      return true;
    }

    const cost = getActionCost(actionType, dimensions);

    // Custo -1 indica que a ação não é permitida (ex: upscale > 4K)
    if (cost < 0) {
      toast.error("Tamanho não suportado", {
        description: "O tamanho máximo permitido para upscale é 4K (4096px).",
      });
      return false;
    }

    if (creditsRemaining < cost) {
      setShowPurchaseModal(true);
      return false;
    }

    return true;
  }, [user, profile, isLegacyUser, creditsRemaining, getActionCost]);

  /**
   * Consome créditos após uma ação bem-sucedida
   * Para usuários legados, não faz nada (sistema antigo gerencia)
   */
  const consumeCredits = useCallback(async (
    actionType: CreditActionType,
    description?: string,
    dimensions?: { width: number; height: number }
  ): Promise<boolean> => {
    if (!user || !profile) return false;

    // Usuários legados não consomem créditos aqui
    if (isLegacyUser) {
      return true;
    }

    setChecking(true);
    
    try {
      const cost = getActionCost(actionType, dimensions);
      
      if (cost < 0) {
        return false;
      }

      if (creditsRemaining < cost) {
        setShowPurchaseModal(true);
        return false;
      }

      // Deduzir créditos do perfil
      const newBalance = creditsRemaining - cost;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ tokens_remaining: newBalance })
        .eq('id', user.id);

      if (updateError) {
        console.error('Erro ao atualizar créditos:', updateError);
        toast.error("Erro ao consumir créditos. Tente novamente.");
        return false;
      }

      // Registrar uso
      await supabase
        .from('token_usage')
        .insert({
          user_id: user.id,
          model_name: `credit_${actionType}`,
          tokens_used: cost,
          message_content: description?.substring(0, 1000) ?? actionType,
        });

      console.log('✅ Crédito consumido:', {
        actionType,
        cost,
        newBalance,
      });

      // Atualizar perfil
      await refreshProfile();

      return true;
    } catch (error) {
      console.error('Erro ao consumir créditos:', error);
      toast.error("Ocorreu um erro ao processar os créditos.");
      return false;
    } finally {
      setChecking(false);
    }
  }, [user, profile, isLegacyUser, creditsRemaining, getActionCost, refreshProfile]);

  /**
   * Formata o custo para exibição
   */
  const formatCost = useCallback((cost: number): string => {
    if (cost >= 1) {
      return `${cost} crédito${cost !== 1 ? 's' : ''}`;
    }
    // Para frações, mostrar quantas ações por crédito
    const actionsPerCredit = Math.round(1 / cost);
    return `1/${actionsPerCredit} crédito`;
  }, []);

  return {
    // Estado
    isLegacyUser,
    creditsRemaining,
    checking,
    showPurchaseModal,
    setShowPurchaseModal,
    
    // Funções
    checkCredits,
    consumeCredits,
    getActionCost,
    getUpscaleCost,
    formatCost,
    refreshProfile,
  };
};
