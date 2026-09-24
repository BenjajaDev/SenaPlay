import { fail, ok, toUserMessage } from '../../../core/result';

const AVATAR_BUCKET = 'avatars';

/**
 * Repositorio de perfil: datos personales (user_metadata de Supabase Auth) y
 * foto de perfil (bucket `avatars`, ruta `<userId>/avatar.jpg`).
 *
 *   updateProfile(user, { fullName, phone, birthdate, gender }) → Result<user>
 *   uploadAvatar(user, localUri)                                 → Result<user>
 */
export function createProfileRepository(supabase) {
  const updateMetadata = async (user, patch) => {
    const { data, error } = await supabase.auth.updateUser({
      data: { ...(user?.user_metadata || {}), ...patch },
    });
    if (error) return fail(toUserMessage(error, 'No se pudo guardar el perfil.'), error);
    return ok(data?.user ?? null);
  };

  return {
    /** Rol del usuario (tabla `profiles`): 'user' | 'editor' | 'admin'. */
    async getRole(userId) {
      if (!userId) return 'user';
      try {
        const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
        return error ? 'user' : data?.role || 'user';
      } catch {
        return 'user';
      }
    },

    async updateProfile(user, { fullName, phone, birthdate, gender }) {
      if (!fullName?.trim()) return fail('El nombre no puede estar vacío.');
      try {
        return await updateMetadata(user, {
          full_name: fullName.trim(),
          phone: phone?.trim() || null,
          birthdate: birthdate?.trim() || null,
          gender: gender || null,
        });
      } catch (error) {
        return fail(toUserMessage(error, 'No se pudo guardar el perfil.'), error);
      }
    },

    async uploadAvatar(user, localUri) {
      if (!user?.id) return fail('Inicia sesión para cambiar tu foto.');
      try {
        const response = await fetch(localUri);
        const blob = await response.blob();
        const path = `${user.id}/avatar.jpg`;
        const { error: uploadError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
        if (uploadError) return fail(toUserMessage(uploadError, 'No se pudo subir la foto.'), uploadError);

        const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
        // El sufijo ?t= evita que la imagen anterior quede en caché.
        return await updateMetadata(user, { avatar_url: `${urlData.publicUrl}?t=${Date.now()}` });
      } catch (error) {
        return fail(toUserMessage(error, 'No se pudo subir la foto.'), error);
      }
    },
  };
}
