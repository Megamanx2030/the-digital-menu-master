import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChefHat, UtensilsCrossed } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <UtensilsCrossed className="w-16 h-16 text-primary mx-auto mb-4" />
        <h1 className="text-3xl font-display font-bold text-foreground">The Culinary Curator</h1>
        <p className="text-muted-foreground font-body mt-2">Cardápio Digital</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-10 w-full max-w-xs space-y-3"
      >
        {[1, 2, 3, 4, 5].map(mesa => (
          <button
            key={mesa}
            onClick={() => navigate(`/mesa/${mesa}`)}
            className="w-full bg-card border border-border hover:border-primary rounded-xl py-3.5 font-body font-semibold text-foreground transition-colors"
          >
            Mesa {mesa}
          </button>
        ))}
        <div className="pt-4 border-t border-border">
          <button
            onClick={() => navigate('/kds')}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 font-body font-bold flex items-center justify-center gap-2"
          >
            <ChefHat className="w-5 h-5" />
            Painel da Cozinha (KDS)
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Index;
