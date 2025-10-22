-- Corrigir dados do usuário alanvazcardoso@gmail.com que pagou mas não foi creditado

-- 1. Buscar o product correto baseado no price_id
DO $$
DECLARE
  v_user_id uuid;
  v_product_id uuid;
  v_tokens_included integer;
  v_plan_id text;
  v_subscription_type text;
BEGIN
  -- Buscar user_id
  SELECT id INTO v_user_id 
  FROM profiles 
  WHERE email = 'alanvazcardoso@gmail.com';

  -- Buscar dados do produto
  SELECT id, tokens_included, plan_id INTO v_product_id, v_tokens_included, v_plan_id
  FROM stripe_products 
  WHERE stripe_price_id = 'price_1SIZnP3llBehq08NuUYbb66l'
  LIMIT 1;

  -- Determinar subscription_type baseado no plan_id
  IF v_plan_id ILIKE '%plus%' OR v_plan_id ILIKE '%premium%' THEN
    v_subscription_type := 'plus';
  ELSIF v_plan_id ILIKE '%basic%' OR v_plan_id ILIKE '%standard%' THEN
    v_subscription_type := 'basic';
  ELSE
    v_subscription_type := 'free';
  END IF;

  -- 2. Atualizar stripe_customer_id no perfil
  UPDATE profiles 
  SET stripe_customer_id = 'cus_TH3QB7fN7Riven',
      updated_at = NOW()
  WHERE id = v_user_id;

  -- 3. Inserir registro da assinatura ativa
  INSERT INTO stripe_subscriptions (
    user_id,
    stripe_subscription_id,
    stripe_customer_id,
    status,
    price_id,
    plan_id,
    tokens_per_period,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    'sub_1SKVM03llBehq08NOHUNoVcC',
    'cus_TH3QB7fN7Riven',
    'active',
    'price_1SIZnP3llBehq08NuUYbb66l',
    v_plan_id,
    v_tokens_included,
    to_timestamp(1761013869),
    to_timestamp(1792549869),
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (stripe_subscription_id) DO UPDATE
  SET status = 'active',
      current_period_end = to_timestamp(1792549869),
      updated_at = NOW();

  -- 4. Atualizar tokens, subscription_type e current_subscription_id do usuário
  UPDATE profiles p
  SET 
    tokens_remaining = v_tokens_included,
    subscription_type = v_subscription_type::subscription_type,
    current_subscription_id = (
      SELECT id FROM stripe_subscriptions 
      WHERE stripe_subscription_id = 'sub_1SKVM03llBehq08NOHUNoVcC'
    ),
    updated_at = NOW()
  WHERE id = v_user_id;

  RAISE NOTICE 'Usuário % atualizado com sucesso: % tokens, tipo: %', 
    v_user_id, v_tokens_included, v_subscription_type;
END $$;