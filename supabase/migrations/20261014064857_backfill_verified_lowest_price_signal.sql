-- is_bottom_price remains the <= ¥300 seven-day rental flag.
-- Backfill the separate historical-low signal only when the current display
-- price equals the stored minimum, the price has been observed more than once,
-- and the recorded history independently contains that same minimum.
WITH observed_history AS (
  SELECT
    product_id,
    MIN(CASE
      WHEN price_kind = 'sale' AND sale_price > 0 THEN sale_price
      WHEN normal_price > 0 THEN normal_price
      ELSE NULL
    END) AS observed_low,
    COUNT(*) FILTER (
      WHERE (price_kind = 'sale' AND sale_price > 0) OR normal_price > 0
    ) AS observations
  FROM public.price_history
  GROUP BY product_id
)
UPDATE public.works AS work
SET is_lowest_price = (
  COALESCE(NULLIF(work.sale_price, 0), work.price) > 0
  AND work.lowest_price > 0
  AND COALESCE(NULLIF(work.sale_price, 0), work.price) = work.lowest_price
  AND observed_history.observations >= 2
  AND observed_history.observed_low = work.lowest_price
)
FROM observed_history
WHERE observed_history.product_id = work.product_id;

UPDATE public.works AS work
SET is_lowest_price = false
WHERE is_lowest_price IS DISTINCT FROM false
  AND NOT EXISTS (
    SELECT 1
    FROM public.price_history AS history
    WHERE history.product_id = work.product_id
  );
