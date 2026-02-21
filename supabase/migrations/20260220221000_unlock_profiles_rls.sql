-- Allow all authenticated users to view profiles (so lawyers can see doctors)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');

-- Allow all authenticated users to view roles
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Authenticated users can view roles" ON public.user_roles FOR SELECT USING (auth.role() = 'authenticated');
