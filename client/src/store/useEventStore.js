import { create } from 'zustand';

const useEventStore = create((set, get) => ({
  events: [],
  hasFetched: false,
  loading: false,

  fetchEvents: async (userUid) => {
    // Only fetch if we haven't already or if user context changed
    if (get().hasFetched) return;

    set({ loading: true });
    try {
      const query = userUid ? `?firebase_uid=${userUid}` : '';
      const res = await fetch(`/api/recommendations${query}`);
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
}));

export default useEventStore;