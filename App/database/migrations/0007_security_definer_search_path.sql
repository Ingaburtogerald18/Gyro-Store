-- ============================================================================
-- Gyro Store v2 · 0007 · search_path fijo en funciones SECURITY DEFINER
-- ============================================================================
-- Las 9 funciones de reportería en 0002_functions.sql son `security definer`
-- a propósito (leen tablas con RLS deny-all), pero ninguna fijaba `search_path`.
-- Es el hallazgo #1 que el Advisor de Supabase marca como "Function Search
-- Path Mutable": sin un search_path fijo, una función SECURITY DEFINER
-- resuelve nombres sin schema (tablas, funciones) con el search_path de quien
-- LLAMA, no de quien la creó. Un rol con permiso de crear objetos en algún
-- schema del search_path podría sombrear un nombre y hacer que la función
-- ejecute código ajeno con los privilegios del dueño de la función.
--
-- En bucle y no una `alter function` por firma (mismo criterio que el bloque
-- de RLS/triggers de 0001): recorre TODAS las funciones `security definer` de
-- `public` por sistema, así una función de reportería nueva que se olvide de
-- fijar su search_path queda igual protegida al re-correr este archivo.
-- ============================================================================

do $$
declare
  r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
  loop
    execute format(
      'alter function public.%I(%s) set search_path = public, pg_temp',
      r.proname, r.args
    );
  end loop;
end $$;
