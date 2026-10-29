import { withTimeout } from '../../../core/net/withTimeout';
import { fail, ok, toUserMessage } from '../../../core/result';
import { storageKey } from '../../../core/storage/jsonStorage';

const AVATAR_BUCKET = 'avatars';
const ROLES = ['user', 'editor', 'admin'];

/**
 * Repositorio de perfil: rol (tabla `profiles`), datos personales
 * (user_metadata de Supabase Auth) y foto de perfil (bucket `avatars`, ruta
 * `<userId>/avatar.jpg`).
 *
 *   getCachedRole(userId)                                        → rol | null (local, instantáneo)
 *   getRole(userId, { timeoutMs })                               → rol (remoto; respaldo: caché → 'user')
 *   updateProfile(user, { fullName, phone, birthdate, gender })  → Result<user>
 *   uploadAvatar(user, localUri)                                 → Result<user>
 *
 * El rol se guarda en el dispositivo para que el arranque no espere a la red.
 * La caché solo decide qué se muestra mientras llega el rol real: los
 * permisos de verdad los aplica RLS en el servidor.
 */
export function createProfileRepository(supabase, { storage = null } = {}) {
  const roleKey = (userId) => storageKey('role', 'v1', userId);
  // Consultas de rol en curso por usuario: al arrancar, getSession() y el
  // evento INITIAL_SESSION piden el mismo rol casi a la vez.
  const pendingRoles = new Map();

  const updateMetadata = async (user, patch) => {
    const { data, error } = await supabase.auth.updateUser({
      data: { ...(user?.user_metadata || {}), ...patch },
    });
    if (error) return fail(toUserMessage(error, 'No se pudo guardar el perfil.'), error);
    return ok(data?.user ?? null);
  };

  const getCachedRole = async (userId) => {
    if (!userId || !storage) return null;
    const role = await storage.get(roleKey(userId), null);
    return ROLES.includes(role) ? role : null;
  };

  const fetchRole = async (userId, timeoutMs) => {
    try {
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('role').eq('id', userId).maybeSingle(),
        timeoutMs,
      );
      if (error) throw error;
      const role = ROLES.includes(data?.role) ? data.role : 'user';
      if (storage) await storage.set(roleKey(userId), role);
      return role;
    } catch {
      return (await getCachedRole(userId)) ?? 'user';
    }
  };

  return {
    getCachedRole,

    getRole(userId, { timeoutMs } = {}) {
      if (!userId) return Promise.resolve('user');
      if (!pendingRoles.has(userId)) {
        const request = fetchRole(userId, timeoutMs).finally(() => pendingRoles.delete(userId));
        pendingRoles.set(userId, request);
      }
      return pendingRoles.get(userId);
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
        // arrayBuffer() en vez de blob(): el Blob de React Native copia la
        // imagen al almacén nativo y la relee en base64 (lento y con aviso).
        const response = await fetch(localUri);
        const bytes = await response.arrayBuffer();
        const path = `${user.id}/avatar.jpg`;
        const { error: uploadError } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
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
