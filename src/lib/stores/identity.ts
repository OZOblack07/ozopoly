import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GuestState {
  guestId: string | null;
  guestSecret: string | null;
  guestName: string | null;
  setGuest: (id: string, secret: string, name: string) => void;
}

export const useGuest = create<GuestState>()(
  persist(
    (set) => ({
      guestId: null,
      guestSecret: null,
      guestName: null,
      setGuest: (guestId, guestSecret, guestName) => set({ guestId, guestSecret, guestName }),
    }),
    { name: "ozopoly-guest" },
  ),
);

export function randomGuestName() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `Guest_${n}`;
}
