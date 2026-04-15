import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import ActionButton from '../../components/ui/ActionButton';
import GameScreenHeader from '../../components/ui/GameScreenHeader';

export default function Hand3DGameScreen({ onBack }) {
  const rotate = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 7000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [rotate, pulse]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.screen}>
      <GameScreenHeader title="Mano 3D" onBack={onBack} />

      <View style={styles.center}>
        <Animated.View style={[styles.iconWrap, { transform: [{ rotate: spin }, { scale: pulse }] }]}> 
          <Ionicons name="hand-left" size={82} color="#1CB0F6" />
        </Animated.View>
        <Text style={styles.soonTitle}>Proximamente</Text>
        <Text style={styles.description}>Estamos preparando esta experiencia interactiva.</Text>

        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>Incluira:</Text>
          <Text style={styles.featureItem}>• Mano 3D interactiva</Text>
          <Text style={styles.featureItem}>• Movimientos por dedos</Text>
          <Text style={styles.featureItem}>• Retos de precision por niveles</Text>
        </View>

        <ActionButton label="Volver a juegos" onPress={onBack} style={styles.backBtn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  iconWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  soonTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#0F172A',
  },
  description: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 14,
  },
  featureCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
    padding: 14,
    marginBottom: 14,
  },
  featureTitle: {
    fontWeight: '900',
    color: '#0369A1',
    marginBottom: 8,
  },
  featureItem: {
    color: '#0C4A6E',
    marginBottom: 4,
  },
  backBtn: {
    width: '100%',
    backgroundColor: '#1CB0F6',
    borderColor: '#1CB0F6',
  },
});
