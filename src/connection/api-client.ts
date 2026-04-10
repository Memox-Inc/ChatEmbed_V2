import type { ChatEmbedConfig, VisitorInfo } from '../config/types';
import { collectBrowserMetadata, createAnonymousEmail } from './browser-metadata';

function buildHeaders(config: ChatEmbedConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Token ${config.token} `,
  };
  if (config.isMobileDevice) {
    headers['X-App-Platform'] = 'react-native-webview';
  }
  if (config.ngrok) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }
  return headers;
}

export async function validateSession(
  sessionChatID: string,
  config: ChatEmbedConfig,
): Promise<boolean> {
  try {
    const baseUrl = config.baseUrl;
    const token = config.token;
    if (!baseUrl || !token || !sessionChatID) return true;

    const response = await fetch(`${baseUrl}sessions/${sessionChatID}/`, {
      method: 'GET',
      headers: buildHeaders(config),
    });

    if (response.status === 404) return false;
    if (!response.ok) return true; // Fail-open on server errors

    const data = await response.json();
    if (data.status === 'close') return false;
    return true;
  } catch (error) {
    console.log('Session validation failed, assuming valid:', error);
    return true;
  }
}

export async function createVisitor(
  name: string | null,
  email: string | null,
  phone: string | null,
  zip: string | null,
  config: ChatEmbedConfig,
): Promise<VisitorInfo> {
  try {
    const baseUrl = config.baseUrl;
    const token = config.token;

    if (!baseUrl || !token) {
      throw new Error('Missing required configuration: baseUrl and token');
    }

    const isAnonymous = !email;
    const browserMetadata = collectBrowserMetadata();

    let visitorEmail = email;
    let visitorName = name;

    if (isAnonymous) {
      visitorEmail = createAnonymousEmail(browserMetadata);
      visitorName = 'Anonymous Visitor';
    }

    const headers = buildHeaders(config);

    // Lookup existing visitor
    const getResponse = await fetch(`${baseUrl}visitors/?email=${visitorEmail}`, {
      method: 'GET',
      headers,
    });

    const getJson = await getResponse.json();

    if (getJson.detail === 'Not found.' || !getJson.results?.length) {
      // Create new visitor
      const visitorPayload = {
        name: visitorName,
        email: visitorEmail,
        phone_number: phone || '',
        zip_code: zip || '',
        organization: config.org_id,
        metadata: { anonymous: isAnonymous },
      };

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
      return {
        id: getJson.results[0].id,
        name: getJson.results[0].name,
      };
    }
  } catch (error) {
    console.error('Error creating/fetching visitor:', error);
    return { id: `offline_${Date.now()}`, name: name || 'Anonymous' };
  }
}
