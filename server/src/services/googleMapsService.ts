import env from "../config/env.js";
import logger from "../utils/logger.js";

interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

interface DistanceResult {
  distance: number; // in meters
  distanceText: string;
  duration: number; // in seconds
  durationText: string;
}

export function isGoogleMapsConfigured(): boolean {
  return Boolean(env.googleMaps.serverApiKey || env.googleMaps.apiKey);
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (!isGoogleMapsConfigured()) {
    logger.debug("Google Maps not configured");
    return null;
  }

  try {
    const key = env.googleMaps.serverApiKey || env.googleMaps.apiKey;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
    const response = await fetch(url);
    const data = (await response.json()) as any;

    if (data.status === "OK" && data.results?.[0]) {
      const result = data.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
      };
    }
    logger.warn(`Geocoding failed: ${data.status}`);
    return null;
  } catch (error) {
    logger.error(`Geocoding error: ${error}`);
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!isGoogleMapsConfigured()) return null;

  try {
    const key = env.googleMaps.serverApiKey || env.googleMaps.apiKey;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
    const response = await fetch(url);
    const data = (await response.json()) as any;

    if (data.status === "OK" && data.results?.[0]) {
      return data.results[0].formatted_address;
    }
    return null;
  } catch (error) {
    logger.error(`Reverse geocoding error: ${error}`);
    return null;
  }
}

export async function calculateDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<DistanceResult | null> {
  if (!isGoogleMapsConfigured()) return null;

  try {
    const key = env.googleMaps.serverApiKey || env.googleMaps.apiKey;
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&key=${key}`;
    const response = await fetch(url);
    const data = (await response.json()) as any;

    if (data.status === "OK" && data.rows?.[0]?.elements?.[0]?.status === "OK") {
      const element = data.rows[0].elements[0];
      return {
        distance: element.distance.value,
        distanceText: element.distance.text,
        duration: element.duration.value,
        durationText: element.duration.text,
      };
    }
    return null;
  } catch (error) {
    logger.error(`Distance calculation error: ${error}`);
    return null;
  }
}

export function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
