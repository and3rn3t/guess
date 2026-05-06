import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { useReduceMotion } from "../native/useNativeServices";

export function useScreenEntranceMotion(delayMs = 0): Animated.WithAnimatedObject<{ opacity: number; transform: { translateY: number }[] }> {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reduceMotion ? 0 : 8)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    opacity.setValue(0);
    translateY.setValue(8);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        delay: delayMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        delay: delayMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delayMs, opacity, reduceMotion, translateY]);

  return {
    opacity,
    transform: [{ translateY }],
  };
}
