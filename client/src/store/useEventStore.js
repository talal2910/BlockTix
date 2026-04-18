import { create } from 'zustand';

const useEventStore = create((set, get) => ({
  events: [],
  hasFetched: false,
  loading: false,

  // Used by homepage — fetches once per session (cached)
  fetchEvents: async (userUid) => {
    if (get().hasFetched) return;

    set({ loading: true });
    try {
      const query = userUid ? `?firebase_uid=${userUid}` : '';
      const res = await fetch(`/api/recommendations${query}`, {
        cache: 'no-store',
      });
      const data = await res.json();

      if (data.success) {
        set({ events: data.events, hasFetched: true });
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      set({ loading: false });
    }
  },

  // Used by Discover page — always fetches fresh ranked results
  refreshEvents: async (userUid) => {
    set({ loading: true, hasFetched: false });
    try {
      const query = userUid ? `?firebase_uid=${userUid}` : '';
      const res = await fetch(`/api/recommendations${query}`, {
        cache: 'no-store',
      });
      const data = await res.json();

      if (data.success) {
        set({ events: data.events, hasFetched: true });
      }
    } catch (error) {
      console.error('Failed to refresh events:', error);
    } finally {
      set({ loading: false });
    }
  },
}));

export default useEventStore;
