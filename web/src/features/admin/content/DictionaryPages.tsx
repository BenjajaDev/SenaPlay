import { BookOpen, Type } from 'lucide-react';
import { useRepositories } from '@/data/RepositoriesProvider';
import type { DictionaryEntry, VocabularySign } from '@/data/types';
import { Badge } from '@/ui';
import { CrudPage } from './CrudPage';

const DIFFICULTY_TONE: Record<string, 'success' | 'warning' | 'danger'> = { Fácil: 'success', Medio: 'warning', Difícil: 'danger' };

/** Diccionario de deletreo (letras, números, acciones) → tabla `dictionary`. */
export function DictionaryPage() {
  const { content } = useRepositories();
  return (
    <CrudPage<DictionaryEntry>
      title="Diccionario"
      subtitle="Letras, números y acciones que se muestran en la pestaña Diccionario (modo Deletreo)."
      icon={Type}
      itemName="Entrada"
      load={content.listDictionary}
      save={content.saveDictionaryEntry}
      remove={content.deleteDictionaryEntry}
      empty={{ letter: '', sign: '', description: '', category: 'A-M', difficulty: 'Fácil', sort_order: 0 }}
      searchText={(item) => `${item.letter} ${item.sign} ${item.description || ''} ${item.category}`}
      describe={(item) => `«${item.letter}»`}
      fields={[
        { key: 'letter', label: 'Título visible', required: true, hint: 'Ej: A, 5, Comer' },
        { key: 'sign', label: 'Clave de seña', required: true, hint: 'Minúsculas; debe existir su imagen en la app' },
        { key: 'category', label: 'Categoría', required: true },
        { key: 'difficulty', label: 'Dificultad', type: 'select', options: ['Fácil', 'Medio', 'Difícil'] },
        { key: 'sort_order', label: 'Orden', type: 'number' },
        { key: 'description', label: 'Cómo se hace', type: 'textarea', hint: 'Forma de la mano, orientación y movimiento.' },
      ]}
      columns={[
        { label: 'Seña', render: (item) => <strong>{item.letter}</strong> },
        { label: 'Clave', render: (item) => <code>{item.sign}</code> },
        { label: 'Categoría', render: (item) => <Badge tone="neutral">{item.category}</Badge> },
        { label: 'Dificultad', render: (item) => (item.difficulty ? <Badge tone={DIFFICULTY_TONE[item.difficulty] || 'brand'}>{item.difficulty}</Badge> : '—') },
        { label: 'Descripción', render: (item) => <span className="text-small text-secondary">{item.description}</span> },
      ]}
    />
  );
}

/** Vocabulario léxico (una seña por palabra) → tabla `signs`. */
export function VocabularyPage() {
  const { content } = useRepositories();
  return (
    <CrudPage<VocabularySign>
      title="Vocabulario"
      subtitle="Señas reales por palabra (modo «Señas reales» del diccionario)."
      icon={BookOpen}
      itemName="Seña"
      load={content.listVocabulary}
      save={content.saveVocabulary}
      remove={content.deleteVocabulary}
      empty={{ word: '', type: 'Sustantivo', meaning: '', how_to: '', theme: '', page: null }}
      searchText={(item) => `${item.word} ${item.meaning || ''} ${item.theme || ''}`}
      describe={(item) => `«${item.word}»`}
      fields={[
        { key: 'word', label: 'Palabra', required: true },
        { key: 'type', label: 'Tipo', type: 'select', options: ['Sustantivo', 'Verbo', 'Adjetivo', 'Adverbio', 'Expresión'] },
        { key: 'theme', label: 'Tema', hint: 'Agrupa en los filtros de la app' },
        { key: 'page', label: 'Página del diccionario MINEDUC', type: 'number' },
        { key: 'meaning', label: 'Significado', type: 'textarea' },
        { key: 'how_to', label: 'Cómo se hace', type: 'textarea' },
      ]}
      columns={[
        { label: 'Palabra', render: (item) => <strong>{item.word}</strong> },
        { label: 'Tipo', render: (item) => (item.type ? <Badge>{item.type}</Badge> : '—') },
        { label: 'Tema', render: (item) => item.theme || '—' },
        { label: 'Significado', render: (item) => <span className="text-small text-secondary">{item.meaning}</span> },
      ]}
    />
  );
}
