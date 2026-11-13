import { createContext, useContext, useMemo, useState } from 'react';

// Estado compartido dentro de un ejercicio con varios videos:
//  - «Repetir» (bucle): una sola barra de controles manda sobre todos. Arranca
//    apagado en cada ejercicio, porque nada debe repetirse solo. «Lento», en
//    cambio, es preferencia del dispositivo (useSlowMotion).
//  - Video activo: solo uno a la vez; al reproducir uno, los demás se detienen.
const SignPlaybackContext = createContext(null);

export function SignPlaybackProvider({ children }) {
  const [loop, setLoop] = useState(false);
  const [active, setActive] = useState(null);
  const value = useMemo(() => ({ loop: [loop, setLoop], active: [active, setActive] }), [loop, active]);
  return <SignPlaybackContext.Provider value={value}>{children}</SignPlaybackContext.Provider>;
}

/**
 * Usa el estado compartido del ejercicio si existe; si no, abre uno propio para
 * que un clip suelto y sus chips compartan estado entre sí.
 */
export function SignPlaybackScope({ children }) {
  const shared = useContext(SignPlaybackContext);
  return shared ? children : <SignPlaybackProvider>{children}</SignPlaybackProvider>;
}

/** [loop, setLoop] del SignPlaybackProvider más cercano (apagado y sin efecto fuera de uno). */
export default function useLoopPreference() {
  const shared = useContext(SignPlaybackContext);
  const fallback = useState(false);
  return shared ? shared.loop : fallback;
}

/** [activeId, setActiveId]: quién reproduce ahora. Quien no es el activo debe detenerse. */
export function useActiveClip() {
  const shared = useContext(SignPlaybackContext);
  const fallback = useState(null);
  return shared ? shared.active : fallback;
}
