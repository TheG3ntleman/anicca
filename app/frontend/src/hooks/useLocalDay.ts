import { useEffect, useState } from 'react';
import { localDate } from '../domain/tasks/dates';
export function useLocalDay() {
  const [day, setDay] = useState(localDate);
  useEffect(() => {
    const update = () => setDay(localDate());
    const interval = setInterval(update, 30000);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
    };
  }, []);
  return day;
}
