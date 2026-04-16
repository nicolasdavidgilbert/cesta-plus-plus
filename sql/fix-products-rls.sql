-- Patch: products/price_history identity + RLS hardening
-- Run with:
--   npx @insforge/cli db query -- "$(cat sql/fix-products-rls.sql)"

CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  WITH claims AS (
    SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb AS jwt_claims
  )
  SELECT COALESCE(
    NULLIF(jwt_claims->>'user_id', ''),
    NULLIF(jwt_claims->>'userId', ''),
    NULLIF(jwt_claims->>'sub', ''),
    NULLIF(jwt_claims->>'uid', '')
  )::text
  FROM claims;
$$;

-- Triggers: force created_by = requesting_user_id() on INSERT so
-- clients cannot spoof ownership.

CREATE OR REPLACE FUNCTION public.set_created_by_on_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.created_by := requesting_user_id();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_created_by_products ON public.products;
CREATE TRIGGER trg_set_created_by_products
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_created_by_on_products();

CREATE OR REPLACE FUNCTION public.set_created_by_on_price_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.created_by := requesting_user_id();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_created_by_price_history ON public.price_history;
CREATE TRIGGER trg_set_created_by_price_history
  BEFORE INSERT ON public.price_history
  FOR EACH ROW
  EXECUTE FUNCTION public.set_created_by_on_price_history();

DROP POLICY IF EXISTS products_select ON public.products;
DROP POLICY IF EXISTS products_insert ON public.products;
DROP POLICY IF EXISTS products_update ON public.products;

CREATE POLICY products_select
ON public.products
FOR SELECT
TO public
USING (
  created_by = requesting_user_id()
);

CREATE POLICY products_insert
ON public.products
FOR INSERT
TO public
WITH CHECK (
  requesting_user_id() IS NOT NULL
  AND NULLIF(trim(created_by), '') IS NOT NULL
  AND created_by = requesting_user_id()
);

CREATE POLICY products_update
ON public.products
FOR UPDATE
TO public
USING (
  created_by = requesting_user_id()
)
WITH CHECK (
  created_by = requesting_user_id()
);

DROP POLICY IF EXISTS price_history_insert ON public.price_history;
CREATE POLICY price_history_insert
ON public.price_history
FOR INSERT
TO public
WITH CHECK (
  requesting_user_id() IS NOT NULL
  AND NULLIF(trim(created_by), '') IS NOT NULL
  AND public.user_can_manage_product(product_id)
  AND created_by = requesting_user_id()
);

ALTER TABLE public.products
  ALTER COLUMN created_by SET DEFAULT requesting_user_id(),
  ALTER COLUMN created_by SET NOT NULL;

ALTER TABLE public.price_history
  ALTER COLUMN created_by SET DEFAULT requesting_user_id(),
  ALTER COLUMN created_by SET NOT NULL;
