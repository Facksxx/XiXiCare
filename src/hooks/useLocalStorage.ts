import { useEffect, useState } from 'react';
import { CLOUD_ARCHIVE_APPLIED_EVENT, recordArchiveMutation } from '../utils/cloudArchive';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    const refreshFromArchive = (event: Event) => {
      const keys = (event as CustomEvent<{ keys?: string[] }>).detail?.keys;
      if (keys && !keys.includes(key)) return;
      try {
        const item = window.localStorage.getItem(key);
        if (item !== null) setStoredValue(JSON.parse(item) as T);
      } catch (error) {
        console.error(`Error refreshing localStorage key "${key}":`, error);
      }
    };
    window.addEventListener(CLOUD_ARCHIVE_APPLIED_EVENT, refreshFromArchive);
    return () => window.removeEventListener(CLOUD_ARCHIVE_APPLIED_EVENT, refreshFromArchive);
  }, [key]);

  // Return a wrapped version of useState's setter function that persists the new value to localStorage.
  const setValue = (value: T | ((val: T) => T)) => {
    setStoredValue(current => {
      try {
        const valueToStore = value instanceof Function ? value(current) : value;
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        recordArchiveMutation(key, current, valueToStore);
        return valueToStore;
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
        return current;
      }
    });
  };

  return [storedValue, setValue];
}
