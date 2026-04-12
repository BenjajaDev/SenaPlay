import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import SectionHeader from '../../components/ui/SectionHeader';
import { LEVELS_CATALOG } from '../../data/levelsConfig';

function LevelBubble({ item, onPress }) {
  let icon = null;
  let bubbleStyle = styles.bubbleLocked;
  let labelStyle = styles.bubbleLabelLocked;

  if (item.completed) {
    icon = <Ionicons name="checkmark" size={26} color="#FFFFFF" />;
    bubbleStyle = styles.bubbleDone;
    labelStyle = styles.bubbleLabel;
  } else if (item.unlocked) {
    icon = <Text style={styles.bubbleNumber}>{item.id}</Text>;
    bubbleStyle = styles.bubbleUnlocked;
    labelStyle = styles.bubbleLabel;
  } else {
    icon = <Ionicons name="lock-closed" size={20} color="#FFFFFF" />;
  }

  return (
    <Pressable style={styles.levelItem} onPress={() => onPress(item)}>
      <View style={[styles.bubble, bubbleStyle]}>{icon}</View>
      <Text style={[styles.levelTitle, labelStyle]}>{item.title}</Text>
      {item.completed ? <Text style={styles.levelScore}>Puntaje: {item.score}</Text> : null}
    </Pressable>
  );
}

export default function LevelsTabScreen({ levelProgress, onOpenLevel }) {
  const levels = LEVELS_CATALOG.map((level) => {
    const completion = levelProgress?.completed?.[level.id];
    const unlocked = (levelProgress?.unlocked || [1]).includes(level.id);

    return {
      id: level.id,
      title: level.title,
      available: level.available,
      unlocked,
      completed: Boolean(completion),
      score: completion?.score || 0,
    };
  });

  const handleOpenLevel = (item) => {
    if (!item.unlocked || !item.available) {
      return;
    }

    if (onOpenLevel) {
      onOpenLevel(item.id);
    }
  };

  return (
    <View style={styles.container}>
      <SectionHeader
        title="Ruta de niveles"
        subtitle="Niveles interactivos con desbloqueo progresivo"
      />

      <View style={styles.pathRow}>
        <LevelBubble item={levels[0]} onPress={handleOpenLevel} />
        <View style={styles.pathLine} />
        <LevelBubble item={levels[1]} onPress={handleOpenLevel} />
      </View>

      <View style={styles.pathRow}>
        <LevelBubble item={levels[2]} onPress={handleOpenLevel} />
        <View style={styles.pathLine} />
        <LevelBubble item={levels[3]} onPress={handleOpenLevel} />
      </View>

      <View style={styles.pathRow}>
        <LevelBubble item={levels[4]} onPress={handleOpenLevel} />
        <View style={styles.pathLine} />
        <LevelBubble item={levels[5]} onPress={handleOpenLevel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  levelItem: {
    width: '44%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  bubble: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  bubbleDone: {
    backgroundColor: '#58CC02',
  },
  bubbleUnlocked: {
    backgroundColor: '#7E57C2',
  },
  bubbleLocked: {
    backgroundColor: '#9CA3AF',
  },
  bubbleNumber: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 26,
  },
  levelTitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  bubbleLabel: {
    color: '#334155',
    fontWeight: '700',
  },
  bubbleLabelLocked: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  levelScore: {
    marginTop: 4,
    fontSize: 11,
    color: '#16A34A',
    fontWeight: '700',
  },
  pathLine: {
    marginTop: 38,
    height: 4,
    width: 24,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
});
