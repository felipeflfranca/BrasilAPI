import axios from 'axios';
import { beforeAll, describe, expect, test } from 'vitest';

import { testCorsForRoute } from './helpers/cors';

// O BCB descontinuou o CSV de participantes do PIX em 2026 — o diretório
// participantes_pix/ responde 401/404 e a lista passou a ser publicada apenas
// em PDF (participantes_pix_pdf/). Enquanto o endpoint não migrar de fonte,
// o upstream indisponível derruba estes testes sem que haja regressão no
// nosso código. Mesmo padrão de skip usado em b3 e cep v3.
const CSV_URL_PREFIX =
  'https://www.bcb.gov.br/content/estabilidadefinanceira/participantes_pix/lista-participantes-instituicoes-em-adesao-pix-';

const formatDate = (date) => date.toISOString().slice(0, 10).replace(/-/g, '');

let shouldSkipTests = false;

try {
  const hoje = new Date();
  const ontem = new Date(hoje.getTime() - 24 * 60 * 60 * 1000);

  const respostas = await Promise.allSettled(
    [hoje, ontem].map((data) =>
      axios.head(`${CSV_URL_PREFIX}${formatDate(data)}.csv`, { timeout: 5000 })
    )
  );

  shouldSkipTests = !respostas.some(
    (resposta) =>
      resposta.status === 'fulfilled' && resposta.value.status === 200
  );
} catch (error) {
  shouldSkipTests = true;
}

// E2E tests - skipped when the BCB source is unavailable
describe.skipIf(shouldSkipTests)('api/pix/v1/participants (E2E)', () => {
  let requestUrl = '';

  beforeAll(async () => {
    requestUrl = `${global.SERVER_URL}/api/pix/v1/participants`;
  });

  test('should return full list', async () => {
    const response = await axios.get(requestUrl);
    const { data, status } = response;

    expect(status).toEqual(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);

    expect.arrayContaining([
      expect.objectContaining({
        ispb: expect.any(String),
        nome: expect.any(String),
        nome_reduzido: expect.any(String),
        modalidade_participacao: expect.any(String),
        inicio_operacao: expect.any(String),
      }),
    ]);
  });
});

// CORS tests - skipped when the BCB source is unavailable
describe.skipIf(shouldSkipTests)('CORS Middleware PIX', () => {
  testCorsForRoute('/api/pix/v1/participants');
});
