/**
 * 座標の配列から標高データを取得する
 * @param {Array} path - [{lat: number, lng: number}, ...]
 * @returns {Promise<Array>} - 標高データを含む配列
 */
export const getElevationData = (path) => {
  return new Promise((resolve, reject) => {
    const elevator = new google.maps.ElevationService();

    // Elevation API にパスを渡す
    // path 内の全ポイントの標高を取得（サンプル数が多い場合は間引くなどの処理が必要）
    elevator.getElevationForLocations({
      locations: path
    }, (results, status) => {
      if (status === "OK" && results) {
        // 標高（results[i].elevation）の配列を返す
        resolve(results.map(r => r.elevation));
      } else {
        reject("Elevation service failed due to: " + status);
      }
    });
  });
};
