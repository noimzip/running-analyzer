import { Loader } from '@googlemaps/js-api-loader';

const loader = new Loader({
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  version: "weekly",
  libraries: ["places", "elevation", "directions"]
});

export const initMap = async (mapElement) => {
  const google = await loader.load();
  const map = new google.maps.Map(mapElement, {
    center: { lat: 35.6812, lng: 139.7671 }, // 東京駅周辺
    zoom: 15,
  });
  return { google, map };
};
