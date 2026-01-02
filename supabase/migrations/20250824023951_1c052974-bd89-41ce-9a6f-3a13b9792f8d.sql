-- Drop the existing public read policy on agent_prompts
DROP POLICY IF EXISTS "Anyone can read agent prompts" ON public.agent_prompts;

-- Create admin-only policies for agent_prompts table
CREATE POLICY "Admins can read agent prompts" 
ON public.agent_prompts 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert agent prompts" 
ON public.agent_prompts 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update agent prompts" 
ON public.agent_prompts 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete agent prompts" 
ON public.agent_prompts 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'));