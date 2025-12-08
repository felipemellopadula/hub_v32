import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  model?: string;
  reasoning?: string;
  files?: Array<{
    name: string;
    type: string;
    url: string;
  }>;
}

interface ConversationData {
  id: string;
  title: string;
  messages: Message[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export const useConversationPersistence = () => {
  const { user } = useAuth();
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Parse messages JSON and convert to proper format
      const parsedConversations = (data || []).map(conv => ({
        ...conv,
        messages: (conv.messages as any[]).map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }));
      
      setConversations(parsedConversations);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    }
  }, [user]);

  // Create new conversation
  const createConversation = useCallback(async (title: string, messages: Message[]): Promise<string | null> => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: user.id,
          title: title || 'Nova conversa',
          messages: messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp.toISOString()
          })),
          is_favorite: false
        })
        .select()
        .single();

      if (error) throw error;
      
      setCurrentConversationId(data.id);
      await loadConversations();
      return data.id;
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
      return null;
    }
  }, [user, loadConversations]);

  // Save messages with debounce
  const saveMessages = useCallback(async (messages: Message[], conversationId?: string) => {
    if (!user) return;
    
    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Debounce save by 1 second
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      
      try {
        const id = conversationId || currentConversationId;
        
        // Serialize messages including reasoning content
        const serializedMessages = messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          sender: msg.sender,
          timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
          model: msg.model || null,
          reasoning: msg.reasoning || null, // Include reasoning in persistence
          files: msg.files || null
        }));
        
        if (id) {
          // Update existing conversation
          const { error } = await supabase
            .from('chat_conversations')
            .update({
              messages: serializedMessages,
              updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('user_id', user.id);

          if (error) throw error;
          console.log('💾 Conversa atualizada no banco:', id);
        } else if (messages.length >= 2) {
          // Create new conversation when we have at least user + bot messages
          const title = generateTitle(messages);
          const newId = await createConversation(title, messages);
          console.log('💾 Nova conversa criada:', newId);
        }
      } catch (error) {
        console.error('Erro ao salvar conversa:', error);
      } finally {
        setIsSaving(false);
      }
    }, 1000);
  }, [user, currentConversationId, createConversation]);

  // Generate title from first user message
  const generateTitle = (messages: Message[]): string => {
    const firstUserMessage = messages.find(m => m.sender === 'user');
    if (!firstUserMessage) return 'Nova conversa';
    
    const content = firstUserMessage.content;
    return content.length > 50 ? content.substring(0, 50) + '...' : content;
  };

  // Load specific conversation
  const loadConversation = useCallback(async (conversationId: string): Promise<Message[]> => {
    if (!user) return [];
    
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      setCurrentConversationId(conversationId);
      
      // Parse and return messages
      return (data.messages as any[]).map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    } catch (error) {
      console.error('Erro ao carregar conversa:', error);
      return [];
    }
  }, [user]);

  // Delete conversation
  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
      }
      
      await loadConversations();
      toast.success('Conversa excluída');
    } catch (error) {
      console.error('Erro ao excluir conversa:', error);
      toast.error('Erro ao excluir conversa');
    }
  }, [user, currentConversationId, loadConversations]);

  // Toggle favorite
  const toggleFavorite = useCallback(async (conversationId: string) => {
    if (!user) return;
    
    try {
      const conversation = conversations.find(c => c.id === conversationId);
      if (!conversation) return;
      
      const { error } = await supabase
        .from('chat_conversations')
        .update({ is_favorite: !conversation.is_favorite })
        .eq('id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      await loadConversations();
    } catch (error) {
      console.error('Erro ao favoritar conversa:', error);
    }
  }, [user, conversations, loadConversations]);

  // Start new conversation
  const startNewConversation = useCallback(() => {
    setCurrentConversationId(null);
  }, []);

  // Load conversations on mount
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    currentConversationId,
    conversations,
    isSaving,
    saveMessages,
    loadConversation,
    loadConversations,
    deleteConversation,
    toggleFavorite,
    startNewConversation,
    setCurrentConversationId
  };
};
