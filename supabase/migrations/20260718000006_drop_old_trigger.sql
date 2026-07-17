-- Removemos o trigger obsoleto, já que agora a validação e inserção na tabela 'people'
-- ocorrerá através do Supabase Auth Hook (via Edge Function)

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
