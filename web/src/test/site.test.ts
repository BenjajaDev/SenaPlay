import { describe, expect, test } from 'vitest';
import type { FeatureItem } from '@/data/types';
import { initialsOf, oneInEvery, policyBlocks, splitFeatures } from '@/lib/site';

const feature = (title: string, highlight: boolean): FeatureItem => ({ icon: 'sparkles', title, text: '', highlight });

describe('helpers de la landing', () => {
  test('«1 de cada N» usa los dígitos de la cifra chilena', () => {
    expect(oneInEvery('488.511', 17910000)).toBe(37);
    expect(oneInEvery('488511', 17910000)).toBe(37);
    expect(oneInEvery('24/7', 17910000)).toBeNull();
    expect(oneInEvery('488.511', null)).toBeNull();
    expect(oneInEvery('sin cifra', 100)).toBeNull();
    expect(oneInEvery('80', 100)).toBeNull();
    expect(oneInEvery('200', 100)).toBeNull();
  });

  test('las destacadas se respetan; sin ninguna marcada se destacan las primeras', () => {
    const items = [feature('A', false), feature('B', true), feature('C', false), feature('D', true)];
    expect(splitFeatures(items, 3).featured.map((item) => item.title)).toEqual(['B', 'D']);
    expect(splitFeatures(items, 3).extras.map((item) => item.title)).toEqual(['A', 'C']);
    const legacy = [feature('A', false), feature('B', false), feature('C', false), feature('D', false)];
    expect(splitFeatures(legacy, 3).featured.map((item) => item.title)).toEqual(['A', 'B', 'C']);
    expect(splitFeatures(legacy, 3).extras.map((item) => item.title)).toEqual(['D']);
  });

  test('la política se divide en subtítulos y párrafos por líneas en blanco', () => {
    expect(policyBlocks('## Datos\n\nCorreo y nombre.\n\n\n  Otro párrafo  \n')).toEqual([
      { kind: 'heading', text: 'Datos' },
      { kind: 'paragraph', text: 'Correo y nombre.' },
      { kind: 'paragraph', text: 'Otro párrafo' },
    ]);
  });

  test('iniciales de una institución: sigla entre paréntesis o primeras letras', () => {
    expect(initialsOf('Agencia Nacional de Investigación y Desarrollo (ANID)')).toBe('ANID');
    expect(initialsOf('Centro de Innovación Social y Políticas Públicas', 5)).toBe('CISPP');
  });
});
