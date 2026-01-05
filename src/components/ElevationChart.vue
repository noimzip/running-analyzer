<template>
  <div class="chart-container">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Chart.js に必要なモジュールを登録
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const props = defineProps({
  elevations: {
    type: Array,
    required: true
  }
});

// グラフデータの設定
const chartData = computed(() => {
  return {
    // 横軸のラベル（単純にデータポイントのインデックスを表示）
    labels: props.elevations.map((_, index) => index + 1),
    datasets: [
      {
        label: '標高 (m)',
        backgroundColor: 'rgba(66, 133, 244, 0.2)', // エリアの塗りつぶし色
        borderColor: '#4285F4', //線の色
        borderWidth: 2,
        pointRadius: 0, // ポイントのマーカーを非表示にして滑らかに見せる
        fill: true, // 線の下を塗りつぶす
        data: props.elevations, // 標高データの配列
        tension: 0.1 // 線の滑らかさ
      }
    ]
  };
});

// グラフオプションの設定
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false }, // 凡例を非表示
    tooltip: {
      mode: 'index',
      intersect: false
    }
  },
  scales: {
    x: {
      display: false // 横軸のラベルが多すぎるので非表示にする
    },
    y: {
      title: {
        display: true,
        text: '標高 (m)'
      }
    }
  }
};
</script>

<style scoped>
.chart-container {
  position: relative;
  height: 200px; /* グラフの高さを指定 */
  width: 100%;
}
</style>
