-- ============================================================
-- 20261114000100 · Deletreo sin números
-- ------------------------------------------------------------
-- El modo «Deletreo» traía UNO…DIEZ deletreados («Se deletrea U-N-O») y
-- CINCO. No es así como se dicen los números en LSCh, y los reales (1–99)
-- ya están como señas del Club de Sordos de Talca en «Señas reales».
-- supabase/dictionary.sql tampoco los trae; esto los quita de las bases que
-- ya tenían el seed anterior. Idempotente: sin esas filas no hace nada.
-- ============================================================

delete from public.dictionary where category = 'Números';
