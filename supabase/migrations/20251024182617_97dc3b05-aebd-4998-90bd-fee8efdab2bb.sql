-- Atualizar tokens para planos básicos (500.000 tokens)
UPDATE stripe_products 
SET tokens_included = 500000 
WHERE plan_id IN ('basic_monthly', 'basic_annual') 
AND active = true;

-- Atualizar tokens para planos pro (1.000.000 tokens)
UPDATE stripe_products 
SET tokens_included = 1000000 
WHERE plan_id IN ('pro_monthly', 'pro_annual') 
AND active = true;