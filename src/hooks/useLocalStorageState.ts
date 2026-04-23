import { useEffect, useState } from "react";

export const useLocalStorageState = <T,>(
  key: string,
  createInitialValue: () => T,
) => {
  const [state, setState] = useState<T>(() => {
    const storedValue = window.localStorage.getItem(key);
    if (!storedValue) {
      return createInitialValue();
    }

    try {
      return JSON.parse(storedValue) as T;
    } catch {
      return createInitialValue();
    }
  });

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState] as const;
};
