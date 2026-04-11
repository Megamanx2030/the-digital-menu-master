import coxinha from '@/assets/coxinha.jpg';
import bolinhoBacalhau from '@/assets/bolinho-bacalhau.jpg';
import dadinhosTapioca from '@/assets/dadinhos-tapioca.jpg';
import picanha from '@/assets/picanha.jpg';
import moqueca from '@/assets/moqueca.jpg';
import feijoada from '@/assets/feijoada.jpg';
import caipirinha from '@/assets/caipirinha.jpg';
import sucoMaracuja from '@/assets/suco-maracuja.jpg';
import guarana from '@/assets/guarana.jpg';
import pudim from '@/assets/pudim.jpg';
import brigadeiro from '@/assets/brigadeiro.jpg';
import acai from '@/assets/acai.jpg';
import redbullOriginal from '@/assets/redbull-original.jpg';
import redbullTropical from '@/assets/redbull-tropical.jpg';
import redbullAcai from '@/assets/redbull-acai.jpg';

const imageMap: Record<string, string> = {
  'Coxinha de Frango': coxinha,
  'Bolinho de Bacalhau': bolinhoBacalhau,
  'Dadinhos de Tapioca': dadinhosTapioca,
  'Picanha na Brasa': picanha,
  'Moqueca Baiana': moqueca,
  'Feijoada Completa': feijoada,
  'Caipirinha Clássica': caipirinha,
  'Suco de Maracujá': sucoMaracuja,
  'Guaraná Antarctica': guarana,
  'Pudim de Leite': pudim,
  'Brigadeiro Gourmet': brigadeiro,
  'Açaí na Tigela': acai,
  'Red Bull Energy Drink': redbullOriginal,
};

export const getProductImage = (nome: string): string => {
  return imageMap[nome] || '';
};

// Carousel images for products with multiple flavors
export const carouselImages: Record<string, { src: string; label: string }[]> = {
  'Red Bull Energy Drink': [
    { src: redbullOriginal, label: 'Original' },
    { src: redbullTropical, label: 'Tropical' },
    { src: redbullAcai, label: 'Coco & Açaí' },
  ],
};
