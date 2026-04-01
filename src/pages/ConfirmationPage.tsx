import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';

const ConfirmationPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { numeroPedido, pedidoId } = (location.state as { numeroPedido?: number; pedidoId?: string }) || {};

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center max-w-[430px] mx-auto px-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="mb-6"
      >
        <CheckCircle className="w-24 h-24 text-kds-green" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-2xl font-display font-bold text-foreground text-center"
      >
        Pedido enviado para a cozinha!
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-6 bg-card border border-border rounded-xl p-6 w-full text-center"
      >
        <p className="text-muted-foreground font-body text-sm">Número do pedido</p>
        <p className="text-4xl font-display font-bold text-primary mt-1">#{numeroPedido || '—'}</p>
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-muted-foreground font-body text-sm">Tempo estimado</p>
          <p className="text-lg font-body font-bold text-foreground">15 - 20 min</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-8 w-full space-y-3"
      >
        <button
          onClick={() => navigate(`/mesa/${id}/acompanhar`, { state: { pedidoId } })}
          className="w-full bg-primary text-primary-foreground rounded-xl py-4 font-body font-bold"
        >
          Acompanhar Pedido
        </button>
        <button
          onClick={() => navigate(`/mesa/${id}`)}
          className="w-full bg-secondary text-secondary-foreground rounded-xl py-4 font-body font-semibold"
        >
          Retornar ao Menu
        </button>
      </motion.div>
    </div>
  );
};

export default ConfirmationPage;
