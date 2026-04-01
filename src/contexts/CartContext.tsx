import React, { createContext, useContext, useState, useCallback } from 'react';

export interface CartItem {
  produto_id: string;
  nome: string;
  preco: number;
  quantidade: number;
  observacoes: string;
  imagem_url?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantidade' | 'observacoes'>) => void;
  removeItem: (produto_id: string) => void;
  updateQuantity: (produto_id: string, quantidade: number) => void;
  updateObservacoes: (produto_id: string, observacoes: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((item: Omit<CartItem, 'quantidade' | 'observacoes'>) => {
    setItems(prev => {
      const existing = prev.find(i => i.produto_id === item.produto_id);
      if (existing) {
        return prev.map(i => i.produto_id === item.produto_id ? { ...i, quantidade: i.quantidade + 1 } : i);
      }
      return [...prev, { ...item, quantidade: 1, observacoes: '' }];
    });
  }, []);

  const removeItem = useCallback((produto_id: string) => {
    setItems(prev => prev.filter(i => i.produto_id !== produto_id));
  }, []);

  const updateQuantity = useCallback((produto_id: string, quantidade: number) => {
    if (quantidade <= 0) {
      setItems(prev => prev.filter(i => i.produto_id !== produto_id));
    } else {
      setItems(prev => prev.map(i => i.produto_id === produto_id ? { ...i, quantidade } : i));
    }
  }, []);

  const updateObservacoes = useCallback((produto_id: string, observacoes: string) => {
    setItems(prev => prev.map(i => i.produto_id === produto_id ? { ...i, observacoes } : i));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantidade, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.preco * i.quantidade, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, updateObservacoes, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
