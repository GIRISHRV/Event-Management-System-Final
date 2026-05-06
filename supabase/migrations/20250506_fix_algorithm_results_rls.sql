-- Fix algorithm_results RLS to be more robust
-- The previous policy had subqueries that could fail if profiles lookup failed

-- First, drop the old policies
DROP POLICY IF EXISTS "algorithm_results_select" ON public.algorithm_results;
DROP POLICY IF EXISTS "algorithm_results_insert" ON public.algorithm_results;
DROP POLICY IF EXISTS "algorithm_results_update" ON public.algorithm_results;
DROP POLICY IF EXISTS "algorithm_results_delete" ON public.algorithm_results;

-- Ensure RLS is enabled
ALTER TABLE public.algorithm_results ENABLE ROW LEVEL SECURITY;

-- New SELECT policy: users see their own results, admins see all
CREATE POLICY "algorithm_results_select"
  ON public.algorithm_results FOR SELECT
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- INSERT: only admins or service role can insert
CREATE POLICY "algorithm_results_insert"
  ON public.algorithm_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- UPDATE: only admins or service role can update
CREATE POLICY "algorithm_results_update"
  ON public.algorithm_results FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- DELETE: only admins or service role can delete
CREATE POLICY "algorithm_results_delete"
  ON public.algorithm_results FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- Fix chat_history RLS policies to be more robust
-- ============================================================

DROP POLICY IF EXISTS "chat_history_select" ON public.chat_history;
DROP POLICY IF EXISTS "chat_history_insert" ON public.chat_history;
DROP POLICY IF EXISTS "chat_history_update" ON public.chat_history;

ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- SELECT: users can read their own chat history
CREATE POLICY "chat_history_select"
  ON public.chat_history FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: users can create their own chat history
CREATE POLICY "chat_history_insert"
  ON public.chat_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: users can update their own chat history
CREATE POLICY "chat_history_update"
  ON public.chat_history FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETE: users can delete their own chat history
CREATE POLICY "chat_history_delete"
  ON public.chat_history FOR DELETE
  USING (auth.uid() = user_id);

