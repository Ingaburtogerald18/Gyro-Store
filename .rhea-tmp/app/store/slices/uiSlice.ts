// Estado efímero de UI compartido entre componentes (doc 09 ítem 40).
// El tema se refleja acá; aplicarlo a <html data-theme> y persistirlo en
// localStorage es trabajo del hook useTheme (ítem 41).
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type Theme = 'dark' | 'light';

// La apertura del carrito NO vive acá: es estado del propio carrito (cartSlice),
// igual que en la v1, para que haya una sola fuente de verdad.
interface UiState {
  theme: Theme;
  mobileNavOpen: boolean;
}

const initialState: UiState = {
  theme: 'dark', // Editorial Dark por defecto (doc 05 §7)
  mobileNavOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    themeSet(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
    },
    mobileNavSet(state, action: PayloadAction<boolean>) {
      state.mobileNavOpen = action.payload;
    },
  },
  selectors: {
    selectTheme: (state) => state.theme,
    selectMobileNavOpen: (state) => state.mobileNavOpen,
  },
});

export const { themeSet, mobileNavSet } = uiSlice.actions;
export const { selectTheme, selectMobileNavOpen } = uiSlice.selectors;
export const uiReducer = uiSlice.reducer;
