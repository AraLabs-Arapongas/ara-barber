ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address_number text;
COMMENT ON COLUMN public.tenants.address_number IS
  'Número do endereço, separado da rua pra UX limpa (ViaCEP não retorna número, owner sempre preenche).';
