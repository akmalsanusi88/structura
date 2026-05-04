
ALTER TABLE public.material_purchase_orders
ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
