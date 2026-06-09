'use client';
import { createContext, useContext } from 'react';

export type Lang = 'th' | 'en';
export const LangContext = createContext<Lang>('th');
export const useLang = () => useContext(LangContext);
