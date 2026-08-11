/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Função utilitária para fazer upload de atestados médicos ou comprovantes
 * para o bucket "atestados" no Supabase Storage.
 */
export async function uploadAtestado(file: File, path?: string): Promise<{ path: string; publicUrl: string }> {
  const fileName = `${Date.now()}_${path || file.name}`;
  const { data, error } = await supabase.storage
    .from('atestados')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from('atestados')
    .getPublicUrl(fileName);

  return {
    path: data.path,
    publicUrl: publicUrlData.publicUrl,
  };
}
