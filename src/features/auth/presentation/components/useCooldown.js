import { useEffect, useState } from 'react';

/** Cuenta regresiva en segundos (reenvío de correos con límite de frecuencia). */
export default function useCooldown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!seconds) return undefined;
    const timer = setInterval(() => setSeconds((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [seconds]);
  return [seconds, setSeconds];
}
