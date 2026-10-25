/**
 * Función serverless de Vercel para /api (raíz del API).
 * Toda la lógica vive en src/app.mjs, compartida con Render.
 */
import manejador from '../src/app.mjs';

export default manejador;

export const config = {
  maxDuration: 30,
};
