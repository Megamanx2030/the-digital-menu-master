import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import Index from "./pages/Index.tsx";
import MenuPage from "./pages/MenuPage.tsx";
import CartPage from "./pages/CartPage.tsx";
import ConfirmationPage from "./pages/ConfirmationPage.tsx";
import TrackingPage from "./pages/TrackingPage.tsx";
import KDSPage from "./pages/KDSPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CartProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/mesa/:id" element={<MenuPage />} />
            <Route path="/mesa/:id/carrinho" element={<CartPage />} />
            <Route path="/mesa/:id/confirmacao" element={<ConfirmationPage />} />
            <Route path="/mesa/:id/acompanhar" element={<TrackingPage />} />
            <Route path="/kds" element={<KDSPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
