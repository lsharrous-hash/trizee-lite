import { createContext, useContext, useState } from 'react';

const DateContext = createContext(null);

export function DateProvider({ children }) {
  // Date par défaut = demain
  const getTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState(getTomorrow());

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const isToday = () => {
    const today = new Date().toISOString().split('T')[0];
    return selectedDate === today;
  };

  const isTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return selectedDate === tomorrow.toISOString().split('T')[0];
  };

  const setToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const setTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow.toISOString().split('T')[0]);
  };

  return (
    <DateContext.Provider value={{
      selectedDate,
      setSelectedDate,
      formatDate,
      isToday,
      isTomorrow,
      setToday,
      setTomorrow,
    }}>
      {children}
    </DateContext.Provider>
  );
}

export function useDate() {
  const context = useContext(DateContext);
  if (!context) {
    throw new Error('useDate must be used within a DateProvider');
  }
  return context;
}