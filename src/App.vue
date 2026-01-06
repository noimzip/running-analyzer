<template>
  <div class="app-container">
    <aside class="sidebar">
      <header>
        <h1>Workout Analyzer</h1>
        <p>with Gemini & Performance Metrics</p>
      </header>

      <section class="auth-section" v-if="!isLoggedIn">
        <button @click="handleLogin" class="auth-btn">
          Google Fit と連携を開始
        </button>
      </section>

      <section class="control-section" v-else>
        <button @click="fetchWorkouts" class="primary-btn">
          履歴を読み込む
        </button>
        
        <div v-if="sessions.length > 0" class="selector-group">
          <label>ワークアウトを選択:</label>
          <select v-model="selectedSessionId" @change="loadSpecificSession">
            <option disabled value="">選択してください</option>
            <option v-for="s in sessions" :key="s.id" :value="s.id">
              {{ formatDate(s.startTimeMillis) }} ({{ s.name || 'Running' }})
            </option>
          </select>
        </div>
      </section>

      <hr v-if="hasData" />

      <section class="stats-section" v-if="hasData">
        <h3>ワークアウト統計</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <span class="label">獲得標高</span>
            <span class="value">{{ totalAscent }} m</span>
          </div>
          <div class="stat-card">
            <span class="label">総距離</span>
            <span class="value">{{ totalDistance.toFixed(2) }} km</span>
          </div>
        </div>

        <div class="chart-container">
          <h4>標高プロファイル</h4>
          <ElevationChart :elevations="elevationData" />
        </div>

        <div class="laps-container" v-if="laps.length > 0">
          <h4>ラップ詳細 (1kmごと)</h4>
          <ul class="lap-list">
            <li v-for="lap in laps" :key="lap.lap">
              <span class="lap-num">{{ lap.lap }}km</span>
              <span class="lap-pace">{{ lap.pace }} /km</span>
            </li>
          </ul>
        </div>

        <button 
          @click="runGeminiAnalysis" 
          class="analyze-btn" 
          :disabled="isLoadingAnalysis"
        >
          {{ isLoadingAnalysis ? '分析中...' : 'Gemini にアドバイスを求める' }}
        </button>
      </section>

      <section class="analysis-section" v-if="analysis">
        <h3>AI による分析結果</h3>
        <div class="ai-bubble">
          {{ analysis }}
        </div>
      </section>
    </aside>

    <main class="map-container" id="map"></main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
// 各種サービスのインポート
import { initMap } from './services/maps';
import { getGeminiAnalysis } from './services/gemini';
import { initAuth, signIn, getSessions, getDataSet } from './services/fit';
import { getElevationData } from './services/elevation';
// ユーティリティ
import { calculateDistance, formatPace } from './utils/geo';
// コンポーネント
import ElevationChart from './components/ElevationChart.vue';

// --- リアクティブ変数の定義 ---
const googleInstance = ref(null);
const mapInstance = ref(null);
const isLoggedIn = ref(false);
const sessions = ref([]);
const selectedSessionId = ref('');
const hasData = ref(false);

const elevationData = ref([]);
const totalAscent = ref(0);
const totalDistance = ref(0);
const laps = ref([]);

const analysis = ref('');
const isLoadingAnalysis = ref(false);
const currentGpsPoints = ref([]);

// --- 初期化処理 ---
onMounted(async () => {
  const { google, map } = await initMap(document.getElementById('map'));
  googleInstance.value = google;
  mapInstance.value = map;
  await initAuth();
});

// --- 認証 ---
const handleLogin = async () => {
  try {
    const token = await signIn();
    if (token) isLoggedIn.value = true;
  } catch (error) {
    console.error("Auth error:", error);
  }
};

// --- セッション一覧取得 ---
const fetchWorkouts = async () => {
  const workoutSessions = await getSessions();
  if (workoutSessions) {
    sessions.value = workoutSessions;
  }
};

// --- 特定セッションの読み込み・分析 ---
const loadSpecificSession = async () => {
  const session = sessions.value.find(s => s.id === selectedSessionId.value);
  if (!session) return;

  const startNanos = parseInt(session.startTimeMillis) * 1000000;
  const endNanos = parseInt(session.endTimeMillis) * 1000000;

  // 1. GPSポイントの取得
  const points = await getDataSet(startNanos, endNanos);
  if (!points || points.length === 0) return;
  currentGpsPoints.value = points;

  const path = points.map(p => ({
    lat: p.value[0].fpVal,
    lng: p.value[1].fpVal
  }));

  // 2. 標高データの取得
  try {
    const elevations = await getElevationData(path);
    elevationData.value = elevations;
    
    let ascent = 0;
    for (let i = 1; i < elevations.length; i++) {
      const diff = elevations[i] - elevations[i-1];
      if (diff > 0) ascent += diff;
    }
    totalAscent.value = Math.round(ascent);
  } catch (err) {
    console.warn("Elevation data error:", err);
  }

  // 3. ラップと距離の計算
  processWorkoutStats(points);

  hasData.value = true;
  drawRoute(path);
};

// --- 距離・ラップ計算ロジック ---
const processWorkoutStats = (points) => {
  let dist = 0;
  let lastLapDist = 0;
  let startTime = parseInt(points[0].startTimeNanos) / 1000000;
  let lastLapTime = startTime;
  const lapData = [];

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i-1].value;
    const p2 = points[i].value;
    const d = calculateDistance(p1[0].fpVal, p1[1].fpVal, p2[0].fpVal, p2[1].fpVal);
    dist += d;

    // 1kmごとにラップを刻む
    if (dist - lastLapDist >= 1000) {
      const currentTime = parseInt(points[i].startTimeNanos) / 1000000;
      const lapDuration = currentTime - lastLapTime;
      lapData.push({
        lap: lapData.length + 1,
        pace: formatPace(lapDuration)
      });
      lastLapDist = dist;
      lastLapTime = currentTime;
    }
  }
  totalDistance.value = dist / 1000; // km換算
  laps.value = lapData;
};

// --- 地図描画 ---
const drawRoute = (path) => {
  const polyline = new googleInstance.value.maps.Polyline({
    path: path,
    geodesic: true,
    strokeColor: "#4285F4",
    strokeOpacity: 1.0,
    strokeWeight: 4,
  });
  polyline.setMap(mapInstance.value);
  const bounds = new googleInstance.value.maps.LatLngBounds();
  path.forEach(p => bounds.extend(p));
  mapInstance.value.fitBounds(bounds);
};

// --- Gemini 分析実行 ---
const runGeminiAnalysis = async () => {
  isLoadingAnalysis.value = true;
  const lapSummary = laps.value.map(l => `Lap${l.lap}: ${l.pace}`).join(', ');

  const prompt = `
    プロのランニングコーチとして以下のデータを多角的に分析し、具体的なアドバイスをください。
    
    【統計】
    - 総距離: ${totalDistance.value.toFixed(2)}km
    - 獲得標高: ${totalAscent.value}m
    - ラップタイム: ${lapSummary}
    
    【依頼】
    ペースと高低差の関係性を踏まえ、フォームの改善点や次回のメニューを150文字程度で提案してください。
  `;

  analysis.value = await getGeminiAnalysis(prompt);
  isLoadingAnalysis.value = false;
};

const formatDate = (ms) => new Date(parseInt(ms)).toLocaleString('ja-JP');
</script>

<style scoped>
/* レイアウト基本構造 */
.app-container { display: flex; height: 100vh; width: 100vw; overflow: hidden; }
.sidebar { width: 400px; background: #fff; border-right: 1px solid #ddd; padding: 20px; overflow-y: auto; z-index: 10; }
.map-container { flex: 1; }

/* ボタン類 */
.auth-btn, .primary-btn, .analyze-btn { width: 100%; padding: 12px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer; margin-bottom: 15px; }
.auth-btn { background: #fbbc05; color: #fff; }
.primary-btn { background: #4285f4; color: #fff; }
.analyze-btn { background: #34a853; color: #fff; margin-top: 10px; }
.analyze-btn:disabled { background: #ccc; }

/* 統計カード */
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
.stat-card { background: #f8f9fa; padding: 10px; border-radius: 8px; text-align: center; }
.stat-card .label { display: block; font-size: 0.75rem; color: #666; }
.stat-card .value { font-size: 1.2rem; font-weight: bold; }

/* ラップリスト */
.laps-container { margin-top: 20px; }
.lap-list { list-style: none; padding: 0; }
.lap-list li { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 0.9rem; }
.lap-pace { font-family: monospace; }

/* AI回答 */
.ai-bubble { background: #e8f0fe; padding: 15px; border-radius: 12px; font-size: 0.9rem; line-height: 1.6; white-space: pre-wrap; }

header h1 { font-size: 1.4rem; color: #333; }
header p { font-size: 0.8rem; color: #888; margin-bottom: 20px; }
</style>
