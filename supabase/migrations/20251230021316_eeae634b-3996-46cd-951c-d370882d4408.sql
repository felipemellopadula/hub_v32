-- Adicionar novos valores ao enum subscription_type
ALTER TYPE subscription_type ADD VALUE IF NOT EXISTS 'basic';
ALTER TYPE subscription_type ADD VALUE IF NOT EXISTS 'plus';
ALTER TYPE subscription_type ADD VALUE IF NOT EXISTS 'pro';

-- Corrigir o usuário cursofmp13@gmail.com
UPDATE profiles 
SET subscription_type = 'paid', 
    tokens_remaining = 1000000,
    updated_at = NOW()
WHERE email = 'cursofmp13@gmail.com';