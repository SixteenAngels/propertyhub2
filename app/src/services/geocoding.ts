import Constants from 'expo-constants';

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = (Constants as any)?.expoConfig?.extra?.GOOGLE_MAPS_GEOCODING_API_KEY || (Constants as any)?.manifest?.extra?.GOOGLE_MAPS_GEOCODING_API_KEY;
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  return json.results?.[0]?.formatted_address ?? null;
}
