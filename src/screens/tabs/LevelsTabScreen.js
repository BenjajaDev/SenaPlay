import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import SectionHeader from '../../components/ui/SectionHeader';
import { useCatalog } from '../../data/CatalogContext';
import { useAppTheme } from '../../theme/ThemeProvider';

function LevelBubble({ item, onPress, theme, styles }) {
  const tone = getLevelTone(theme, item);
  let icon = null;
  let bubbleStyle = styles.bubbleLocked;
  let labelStyle = styles.bubbleLabelLocked;

  if (item.completed) {
    icon = <Ionicons name="checkmark" size={26} color={theme.colors.primaryContrast} />;
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
    <Pressable style={[styles.levelItem, tone.card]} onPress={() => onPress(item)}>
      <View style={[styles.bubble, bubbleStyle]}>{icon}</View>
      <Text style={[styles.levelTitle, labelStyle]}>{item.title}</Text>
      {item.completed ? <Text style={styles.levelScore}>Puntaje: {item.score}</Text> : null}
    </Pressable>
  );
}

function getLevelTone(theme, item) {
  if (item.completed) {
    return {
      card: {
        backgroundColor: theme.mode === 'dark' ? '#1E3220' : '#EFFCE7',
        borderColor: theme.mode === 'dark' ? '#3E6B34' : '#B9E79A',
      },
    };
  }

  if (item.unlocked) {
    return {
      card: {
        backgroundColor: theme.mode === 'dark' ? '#251E3B' : '#F3ECFF',
        borderColor: theme.mode === 'dark' ? '#4B3B73' : '#CFBAF6',
      },
    };
  }

  return {
    card: {
      backgroundColor: theme.mode === 'dark' ? '#221F31' : '#F3F4F6',
      borderColor: theme.mode === 'dark' ? '#454054' : '#D3D7DD',
    },
  };
}

export default function LevelsTabScreen({ levelProgress, onOpenLevel }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { levels: catalogLevels } = useCatalog();

  const levels = catalogLevels.map((level) => {
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

  const rows = [];
  for (let i = 0; i < levels.length; i += 2) {
    rows.push(levels.slice(i, i + 2));
  }

  return (
    <View style={styles.container}>
      <SectionHeader
        title="Ruta de niveles"
        subtitle="Niveles interactivos con desbloqueo progresivo"
      />

      {rows.map((row, rowIdx) => (
        <View key={`row-${rowIdx}`} style={styles.pathRow}>
          <LevelBubble item={row[0]} onPress={handleOpenLevel} theme={theme} styles={styles} />
          {row[1] ? (
            <>
              <View style={styles.pathLine} />
              <LevelBubble item={row[1]} onPress={handleOpenLevel} theme={theme} styles={styles} />
            </>
          ) : (
            <View style={styles.levelItemPlaceholder} />
          )}
        </View>
      ))}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
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
      paddingVertical: 10,
      borderRadius: 16,
      borderWidth: 1,
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
      backgroundColor: theme.colors.success,
    },
    bubbleUnlocked: {
      backgroundColor: theme.colors.primary,
    },
    bubbleLocked: {
      backgroundColor: theme.colors.navInactive,
    },
    bubbleNumber: {
      color: theme.colors.primaryContrast,
      fontWeight: '900',
      fontSize: 26,
    },
    levelTitle: {
      fontSize: 13,
      textAlign: 'center',
    },
    bubbleLabel: {
      color: theme.colors.textPrimary,
      fontWeight: '700',
    },
    bubbleLabelLocked: {
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    levelScore: {
      marginTop: 4,
      fontSize: 11,
      color: theme.colors.success,
      fontWeight: '700',
    },
    pathLine: {
      marginTop: 38,
      height: 4,
      width: 24,
      borderRadius: 2,
      backgroundColor: theme.colors.border,
    },
    levelItemPlaceholder: {
      width: '44%',
    },
  });
}
