import { StrictMode } from "react";
import { createRoot } from 'react-dom/client'
import './index.css'
import { ThemeProvider } from "next-themes";
import AuthProvider from "@/contexts/AuthContext";
import App from './App.tsx';

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
