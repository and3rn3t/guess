/**
 * Example Usage: Native iOS Services in React Components
 * 
 * This file demonstrates how to integrate native services into game screens
 * following the native product contract requirements.
 */

import React, { useEffect } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import {
  useHaptics,
  useVoiceOver,
  useReduceMotion,
  useLifecycle,
  useOnAppBackground,
  useLifecycleCallbacks,
} from './useNativeServices';

// MARK: - Example 1: Guess Submission with Haptics + VoiceOver

function GuessButton({ onSubmit, isCorrect }: { onSubmit: () => void; isCorrect: boolean }) {
  const haptics = useHaptics();
  const { announce } = useVoiceOver();

  const handlePress = async () => {
    // Trigger haptic feedback
    await haptics.trigger('medium');
    
    // Submit guess
    onSubmit();
    
    // Provide haptic + VoiceOver feedback based on result
    if (isCorrect) {
      await haptics.success();
      await announce('Correct guess!', 'high');
    } else {
      await haptics.error();
      await announce('Incorrect. Try again.', 'default');
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Submit guess"
    >
      <Text>Submit Guess</Text>
    </Pressable>
  );
}

// MARK: - Example 2: Adaptive Animations with Reduce Motion

function GameTransition({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReduceMotion();
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      // Instant appearance for reduced motion
      opacity.setValue(1);
    } else {
      // Smooth fade-in animation
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [reduceMotion, opacity]);

  return (
    <Animated.View style={{ opacity: reduceMotion ? 1 : opacity }}>
      {children}
    </Animated.View>
  );
}

// MARK: - Example 3: Auto-save on Background

function GameScreen({ saveGame }: { saveGame: () => void }) {
  const lifecycleState = useLifecycle();

  // Auto-save when app goes to background
  useOnAppBackground(() => {
    console.log('App backgrounding, saving game state...');
    saveGame();
  });

  // Alternative: Use lifecycle callbacks for more control
  useLifecycleCallbacks({
    onActive: () => {
      console.log('Game resumed');
    },
    onBackground: () => {
      console.log('Game paused, auto-saving...');
      saveGame();
    },
  });

  return (
    <View>
      <Text>Game State: {lifecycleState}</Text>
      {lifecycleState !== 'active' && <Text>Game Paused</Text>}
    </View>
  );
}

// MARK: - Example 4: VoiceOver Screen Navigation

function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  const { announceScreenChange } = useVoiceOver();
  const haptics = useHaptics();

  useEffect(() => {
    // Announce screen change for VoiceOver users
    announceScreenChange('Welcome to Guess Game');
  }, [announceScreenChange]);

  const handleContinue = async () => {
    await haptics.selection();
    onContinue();
  };

  return (
    <View>
      <Text accessibilityRole="header">Welcome!</Text>
      <Pressable
        onPress={handleContinue}
        accessibilityLabel="Continue to game"
        accessibilityHint="Double tap to start playing"
      >
        <Text>Continue</Text>
      </Pressable>
    </View>
  );
}

// MARK: - Example 5: Game Over with Multi-sensory Feedback

function GameOverScreen({ 
  didWin, 
  score, 
  onRestart 
}: { 
  didWin: boolean; 
  score: number; 
  onRestart: () => void;
}) {
  const haptics = useHaptics();
  const { announce, announceScreenChange } = useVoiceOver();

  useEffect(() => {
    // Announce game over
    announceScreenChange('Game Over');
    
    // Provide result feedback
    const message = didWin 
      ? `Congratulations! You won with a score of ${score}` 
      : `Game over. Your score was ${score}`;
    
    announce(message, 'high');

    // Haptic feedback based on outcome
    if (didWin) {
      haptics.success();
    } else {
      haptics.warning();
    }
  }, [didWin, score, announceScreenChange, announce, haptics]);

  const handleRestart = async () => {
    await haptics.trigger('medium');
    onRestart();
  };

  return (
    <View>
      <Text accessibilityRole="header">
        {didWin ? 'You Won!' : 'Game Over'}
      </Text>
      <Text>Score: {score}</Text>
      <Pressable
        onPress={handleRestart}
        accessibilityLabel="Play again"
        accessibilityRole="button"
      >
        <Text>Play Again</Text>
      </Pressable>
    </View>
  );
}

// MARK: - Example 6: Selection List with Haptic Feedback

function SelectionList({ 
  items, 
  onSelect 
}: { 
  items: string[]; 
  onSelect: (item: string) => void;
}) {
  const haptics = useHaptics();

  const handleItemPress = async (item: string) => {
    // Selection haptic for each tap
    await haptics.selection();
    onSelect(item);
  };

  return (
    <View>
      {items.map((item, index) => (
        <Pressable
          key={index}
          onPress={() => handleItemPress(item)}
          accessibilityRole="button"
        >
          <Text>{item}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// MARK: - Example 7: Comprehensive Accessibility-Aware Component

function AccessibleGameCard({ 
  title, 
  description, 
  onPress 
}: { 
  title: string; 
  description: string; 
  onPress: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const { isRunning: isVoiceOverRunning } = useVoiceOver();
  const haptics = useHaptics();
  
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!reduceMotion) {
      Animated.spring(scale, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (!reduceMotion) {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePress = async () => {
    await haptics.trigger('light');
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      // Provide more detailed hint for VoiceOver users
      {...(isVoiceOverRunning && {
        accessibilityHint: `${description}. Double tap to select.`
      })}
    >
      <Animated.View
        style={{
          transform: reduceMotion ? [] : [{ scale }],
        }}
      >
        <Text accessibilityRole="header">{title}</Text>
        <Text>{description}</Text>
      </Animated.View>
    </Pressable>
  );
}

// MARK: - Exports for use in mobile app

export {
  GuessButton,
  GameTransition,
  GameScreen,
  WelcomeScreen,
  GameOverScreen,
  SelectionList,
  AccessibleGameCard,
};
