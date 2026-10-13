export interface Clock {
  /** Today's date as YYYY-MM-DD in UTC. */
  today(): string;
}

export const systemClock: Clock = {
  today: () => new Date().toISOString().slice(0, 10),
};
