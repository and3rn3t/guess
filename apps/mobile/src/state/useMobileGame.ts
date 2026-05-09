import { useContext } from 'react';
import { MobileGameContext } from './mobileGameContext';

export function useMobileGame() {
  const value = useContext(MobileGameContext);
  if (!value) {
    throw new Error('useMobileGame must be used inside MobileGameProvider');
  }
  return value;
}
