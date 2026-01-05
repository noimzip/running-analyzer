import axios from 'axios';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.location.read';

let tokenClient;
let accessToken = null;

// OAuth 2.0 の初期化
export const initAuth = () => {
  return new Promise((resolve) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse) => {
        if (tokenResponse.error !== undefined) {
          throw (tokenResponse);
        }
        accessToken = tokenResponse.access_token;
        resolve(accessToken);
      },
    });
  });
};

// ログインしてトークンを取得
export const signIn = () => {
  tokenClient.requestAccessToken({ prompt: 'consent' });
};

// 最近のワークアウトセッションを取得
export const getSessions = async () => {
  if (!accessToken) return null;

  const response = await axios.get(
    'https://www.googleapis.com/fitness/v1/users/me/sessions',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        // 直近1ヶ月分などのフィルタリングが必要ならここに追加
      }
    }
  );
  return response.data.session;
};

// 特定のデータセット（GPS座標など）を取得
export const getDataSet = async (startTimeNanos, endTimeNanos) => {
  const dataStreamId = "derived:com.google.location.sample:com.google.android.gms:merge_location_samples";
  const datasetId = `${startTimeNanos}-${endTimeNanos}`;
  
  const response = await axios.get(
    `https://www.googleapis.com/fitness/v1/users/me/dataSources/${dataStreamId}/datasets/${datasetId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );
  return response.data.point;
};
