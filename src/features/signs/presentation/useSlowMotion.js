import { useEffect, useState } from 'react';
import { jsonStorage, storageKey } from '../../../core/storage/jsonStorage';

// Preferencia «ver las señas en cámara lenta» (0,5×). Es del dispositivo y la
// comparten todos los clips: si alguien la activa en un ejercicio, el
// siguiente clip ya parte lento. Se guarda en el almacenamiento local.
const KEY = storageKey('signClip.slowMotion', 'v1');

let current = false;
let loaded = false;
const listeners = new Set();

function publish(value) {
  current = value;
  listeners.forEach((listener) => listener(value));
}

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  jsonStorage.get(KEY, false).then((stored) => {
    if (typeof stored === 'boolean' && stored !== current) publish(stored);
  });
}

export default function useSlowMotion() {
  const [slow, setSlow] = useState(current);

  useEffect(() => {
    ensureLoaded();
    listeners.add(setSlow);
    setSlow(current);
    return () => {
      listeners.delete(setSlow);
    };
  }, []);

  const update = (value) => {
    publish(value);
    jsonStorage.set(KEY, value);
  };

  return [slow, update];
}

/** Solo para pruebas: vuelve al estado inicial. */
export function resetSlowMotionForTests() {
  current = false;
  loaded = false;
  listeners.clear();
}
