export const formatDuration = (minutes: number): string => {
  if (minutes <= 0) {
    return "0m";
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}m`;
  }

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
};

export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export const blockEndLabel = (startTime: string, durationMin: number): string => {
  const total = timeToMinutes(startTime) + durationMin;
  const dayMinutes = 24 * 60;
  const clamped = ((total % dayMinutes) + dayMinutes) % dayMinutes;
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};
