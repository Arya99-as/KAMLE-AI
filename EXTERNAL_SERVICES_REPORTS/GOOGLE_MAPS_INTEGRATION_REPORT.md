# GOOGLE MAPS PLATFORM INTEGRATION REPORT — KAMLE AI

**Date:** 2026-11-03  
**Project:** KAMLE AI Marketplace  
**APIs:** Places API, Geocoding API, Distance Matrix API & MongoDB 2dsphere Engine  

---

## 1. ARCHITECTURAL OVERVIEW

Location accuracy is essential for a hyper-local marketplace. KAMLE AI implements a hybrid geospatial architecture combining:
1. Google Maps Geocoding & Distance Matrix APIs for external precision.
2. In-database MongoDB GeoJSON `Point` coordinate structures with sparse `2dsphere` indexes.
3. Spherical trigonometry (Haversine formula) fallback algorithm when external API keys are unavailable.

---

## 2. KEY IMPLEMENTATION DETAILS

### 2.1 Database Schema & GeoJSON (`server/src/models/WorkerProfile.ts` & `User.ts`)
- Schema definition:
  ```typescript
  const pointSchema = new Schema(
    {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },
    { _id: false },
  );

  // In WorkerProfileSchema & UserSchema
  locationGeo: { type: pointSchema, required: false },
  serviceRadiusKm: { type: Number, default: 15, min: 1, max: 100 },
  ```
- Sparse `2dsphere` indexes:
  ```typescript
  workerProfileSchema.index({ locationGeo: "2dsphere" }, { sparse: true });
  userSchema.index({ locationGeo: "2dsphere" }, { sparse: true });
  ```

### 2.2 Google Maps Service (`server/src/services/googleMapsService.ts`)
- **`geocodeAddress(address)`**:
  Queries `https://maps.googleapis.com/maps/api/geocode/json` to convert address strings into `{ lat, lng, formattedAddress }`.
- **`reverseGeocode(lat, lng)`**:
  Resolves latitude/longitude into human-readable street addresses and localities.
- **`calculateDistance(originLat, originLng, destLat, destLng)`**:
  Queries the Google Distance Matrix API for road driving distance and commute duration.
- **`getDistanceInKm(lat1, lon1, lat2, lon2)`**:
  Implements the mathematical Haversine formula to compute geodesic surface distance in kilometers with zero external network dependency.

### 2.3 Geospatial Search & Proximity Scoring (`server/src/services/matchingService.ts`)
- When `lat` and `lng` query parameters are passed to `/api/workers`:
  - Uses MongoDB's `$near` operator:
    ```typescript
    query.locationGeo = {
      $near: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
        $maxDistance: (radiusKm || 25) * 1000,
      },
    };
    ```
  - Calculates worker distance and applies proximity weighting to search rank.
  - Generates clear user-facing reasons, e.g.: `"Within 3 km of your location"`.
- When coordinates are omitted:
  - Gracefully falls back to case-insensitive regex matching against `serviceAreas` (e.g., "Kolhapur", "Shahupuri", "Rajampura").

---

## 3. TEST & VERIFICATION RESULTS

- Automated verification script: `server/tests/test_external_services.mjs`
- Test cases verified:
  - Kolhapur Coordinate Search (`lat=16.7050`, `lng=74.2433`, `radiusKm=25`):
    - 6 nearby approved workers returned.
    - Proximity reason correctly populated (`"Within X km of your location"`).
  - Pune Radius Constraint (`lat=18.5204`, `lng=73.8567`, `radiusKm=10`):
    - Strictly returned only the 2 workers operating in the Pune metropolitan area.
  - Zero-Crash Fallback: Works seamlessly in offline/mock environment without external API keys.

