/**
 * Parse and validate submit payload.
 * Returns a normalized payload object or an early response if invalid.
 *
 * @param {{
 *   req: Request,
 *   parseJsonBody: (req: Request) => Promise<any>,
 *   SubmitSchema: { safeParse: (input: unknown) => { success: true, data: any } | { success: false, error: any } },
 *   markStage: (stage: string, startedAt: number) => void,
 *   logger: { info: (...args: any[]) => void, error: (...args: any[]) => void },
 *   redactForLog: (value: unknown) => unknown,
 *   redactToken: (value: unknown) => string,
 *   errorJson: (code: string, message: string, status?: number, details?: unknown, headers?: Record<string, string>) => Response,
 *   finish: (response: Response, outcome: 'success' | 'rejected' | 'failure', details?: Record<string, unknown>) => Response,
 *   supportedPayloadVersions: Set<number>
 * }} deps
 * @returns {Promise<
 *   | { ok: false, response: Response }
 *   | {
 *       ok: true,
 *       token: string,
 *       rounds: any[],
 *       pseudo: string,
 *       trimmedPseudo: string,
 *       gameType: string,
 *       payloadVersion: number | undefined,
 *       csrfToken: string | null
 *     }
 * >}
 */
export async function parseAndValidatePayload(deps) {
  const {
    req,
    parseJsonBody,
    SubmitSchema,
    markStage,
    logger,
    redactForLog,
    redactToken,
    errorJson,
    finish,
    supportedPayloadVersions,
  } = deps;

  const parseAndValidateStart = Date.now();
  const body = await parseJsonBody(req);
  const parsed = SubmitSchema.safeParse(body);
  const parsedAny = /** @type {any} */ (parsed);
  markStage('parseAndValidateMs', parseAndValidateStart);
  if (!parsed.success) {
    const validationError = parsedAny.error;
    logger.error('[submit] Payload validation failed:', validationError.flatten());
    logger.info(
      '[submit] Invalid payload details:',
      redactForLog({
        fieldErrors: validationError.flatten().fieldErrors,
        formErrors: validationError.flatten().formErrors,
        token: body?.token,
        gameType: body?.gameType,
        roundsCount: body?.rounds?.length,
      })
    );
    return {
      ok: false,
      response: finish(
        errorJson('invalid_payload', 'Invalid payload', 400, validationError.flatten()),
        'rejected'
      ),
    };
  }

  const { token, rounds, pseudo, gameType = 'classic', payloadVersion } = parsedAny.data;
  const effectivePayloadVersion = payloadVersion ?? 1;
  if (!supportedPayloadVersions.has(effectivePayloadVersion)) {
    return {
      ok: false,
      response: finish(
        errorJson(
          'unsupported_payload_version',
          `Unsupported payload version (${effectivePayloadVersion})`,
          400
        ),
        'rejected'
      ),
    };
  }
  const csrfToken = req.headers.get('x-csrf-token');

  logger.info(
    '[submit] Request details - Token:',
    redactToken(token),
    'CSRF from header:',
    redactToken(csrfToken),
    'payloadVersion:',
    payloadVersion ?? null
  );

  const trimmedPseudo = pseudo.trim();
  if (trimmedPseudo.length < 3 || trimmedPseudo.length > 5 || !/^[A-Z]{3,5}$/.test(trimmedPseudo)) {
    return {
      ok: false,
      response: finish(
        errorJson('invalid_pseudo', 'Invalid pseudo (3-5 uppercase letters required)', 400),
        'rejected'
      ),
    };
  }

  return {
    ok: true,
    token,
    rounds,
    pseudo,
    trimmedPseudo,
    gameType,
    payloadVersion,
    csrfToken,
  };
}
