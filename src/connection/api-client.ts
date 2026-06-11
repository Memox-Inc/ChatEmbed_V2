import type { ChatEmbedConfig, VisitorInfo } from '../config/types';
import { getOrCreateDistinctId } from '../utils/distinct-id';
import { collectBrowserMetadata, createAnonymousEmail } from './browser-metadata';

function buildHeaders(config: ChatEmbedConfig): Record<string, string> {
  // Prefer the per-session embed token (EmbedTokenAuthentication on the
  // backend, org-scoped via embed config) over the legacy global
  // ``Token`` (a superuser key publicly returned by /embed/init/ that we
  // are killing in Phase B PR3 of MMX-227). The fallback exists for two
  // cases: (a) an older backend that does not yet ship ``session_token``
  // in the init response, (b) OSS / self-hosted deploys without the
  // embed-init handshake.
  const authHeader = config.sessionToken
    ? `EmbedToken ${config.sessionToken}`
    : `Token ${config.token ?? ''}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: authHeader,
  };
  if (config.isMobileDevice) {
    headers['X-App-Platform'] = 'react-native-webview';
  }
  if (config.ngrok) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }
  return headers;
}

function hasAuthCredentials(config: ChatEmbedConfig): boolean {
  return Boolean(config.sessionToken || config.token);
}

export type SessionValidation = 'valid' | 'closed' | 'orphaned';

export async function validateSession(
  sessionChatID: string,
  config: ChatEmbedConfig,
): Promise<SessionValidation> {
  try {
    const baseUrl = config.baseUrl;
    if (!baseUrl || !hasAuthCredentials(config) || !sessionChatID) return 'valid';

    const response = await fetch(`${baseUrl}sessions/${sessionChatID}/`, {
      method: 'GET',
      headers: buildHeaders(config),
    });

    // 404 = the cached chatID points at a session that no longer exists
    // server-side (DB reset, auto-cleanup, or cleared admin-side).
    // Caller should treat this as an orphaned cache and mint a new id
    // instead of carrying the dead UUID forward and re-404'ing on every
    // reload.
    if (response.status === 404) return 'orphaned';
    if (!response.ok) return 'valid'; // Fail-open on server errors

    const data = await response.json();
    if (data.status === 'close') return 'closed';
    return 'valid';
  } catch (error) {
    console.log('Session validation failed, assuming valid:', error);
    return 'valid';
  }
}

export async function createVisitor(
  name: string | null,
  email: string | null,
  phone: string | null,
  zip: string | null,
  config: ChatEmbedConfig,
  customFields?: Record<string, string>,
): Promise<VisitorInfo> {
  try {
    const baseUrl = config.baseUrl;

    if (!baseUrl || !hasAuthCredentials(config)) {
      throw new Error('Missing required configuration: baseUrl and (sessionToken or token)');
    }

    const browserMetadata = collectBrowserMetadata();

    // MMX-804: "anonymous" means the visitor submitted NO lead data at all —
    // not merely "no email". Previously this keyed off `!email`, so a name-only
    // lead form (email/phone/zip disabled) was treated as anonymous and the
    // submitted name was overwritten with 'Anonymous Visitor' (and the visitor
    // was never personalized). Determine anonymity from the full payload.
    const hasLeadData = !!(
      name ||
      email ||
      phone ||
      zip ||
      (customFields && Object.keys(customFields).length > 0)
    );
    const isAnonymous = !hasLeadData;

    // Email is the backend's required, per-org-unique visitor identity key
    // (visitors.email is non-null with a unique (email, organization)
    // constraint). When the lead form doesn't collect an email, synthesize a
    // deterministic per-browser address so the visitor can still be looked up /
    // deduped — but keep whatever name (and other fields) the visitor actually
    // submitted. Only fall back to the placeholder name when none was given.
    const visitorEmail = email || createAnonymousEmail(browserMetadata);
    const visitorName = name || 'Anonymous Visitor';

    const headers = buildHeaders(config);

    // Lookup existing visitor
    const getResponse = await fetch(`${baseUrl}visitors/?email=${visitorEmail}`, {
      method: 'GET',
      headers,
    });

    const getJson = await getResponse.json();

    if (getJson.detail === 'Not found.' || !getJson.results?.length) {
      // Create new visitor
      const metadata: Record<string, unknown> = { anonymous: isAnonymous };
      if (customFields && Object.keys(customFields).length > 0) {
        Object.assign(metadata, customFields);
      }
      const visitorPayload: Record<string, unknown> = {
        name: visitorName,
        email: visitorEmail,
        phone_number: phone || '',
        zip_code: zip || '',
        organization: config.org_id,
        metadata,
      };

      // MMX-562: carry the visitor's distinct_id so the backend bandit
      // conversion hook (_enqueue_bandit_conversions) can mark the matching
      // ExperimentAssignment converted. Without this, the assignment created at
      // /embed/init never gets converted_at set and Memox Optimize counts every
      // experiment's conversions as zero. Mirror the /embed/init opt-out: when
      // experiments are disabled the visitor was never bucketed, so omit it.
      if (!config.disableExperiments) {
        visitorPayload.distinct_id = getOrCreateDistinctId();
      }

      const postResponse = await fetch(`${baseUrl}visitors/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(visitorPayload),
      });

      if (!postResponse.ok) {
        throw new Error(`Failed to create visitor: ${postResponse.status}`);
      }

      const visitorData = await postResponse.json();
      return { id: visitorData.id, name: visitorData.name };
    } else {
      const existing = getJson.results[0];

      // MMX-804: the synthetic anonymous email is a deterministic per-browser
      // fingerprint, so a returning visitor who previously submitted nothing
      // (or whom we'd mislabeled) resolves to the same record. If we now have a
      // real submitted name but the stored one is still a placeholder, patch it
      // so the name the visitor just gave is persisted. Best-effort: a failed
      // PATCH must not break the chat flow.
      const existingName = String(existing.name ?? '').trim().toLowerCase();
      const isPlaceholderName =
        !existingName ||
        existingName === 'anonymous visitor' ||
        existingName === 'anonymous user';
      if (name && isPlaceholderName) {
        try {
          const patchResponse = await fetch(`${baseUrl}visitors/${existing.id}/`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ name }),
          });
          if (patchResponse.ok) {
            const patched = await patchResponse.json();
            return { id: patched.id, name: patched.name };
          }
        } catch (patchError) {
          console.error('Error updating existing visitor name:', patchError);
        }
      }

      return {
        id: existing.id,
        name: existing.name,
      };
    }
  } catch (error) {
    console.error('Error creating/fetching visitor:', error);
    return { id: `offline_${Date.now()}`, name: name || 'Anonymous' };
  }
}
