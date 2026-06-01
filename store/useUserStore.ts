import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthUser } from '@/types/user';

interface UserState {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  clearUser: () => void;
  updateRating: (category: keyof AuthUser['rating'], value: number) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,

      setUser: (user) => set({ user, isLoading: false }),

      setLoading: (isLoading) => set({ isLoading }),

      clearUser: () => set({ user: null, isLoading: false }),

      updateRating: (category, value) =>
        set((state) => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              rating: {
                ...state.user.rating,
                [category]: value,
              },
            },
          };
        }),
    }),
    {
      name: 'knightx-user',
      // Only persist non-sensitive fields
      partialize: (state) => ({
        user: state.user
          ? {
              id: state.user.id,
              username: state.user.username,
              email: state.user.email,
              avatar: state.user.avatar,
              rating: state.user.rating,
              stats: state.user.stats,
            }
          : null,
      }),
    }
  )
);
