'use client';
// Loads the Google Maps JavaScript API with Places library for use with react-places-autocomplete
import { useEffect } from 'react';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function GoogleMapsScriptLoader() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (document.getElementById('google-maps-script')) return;
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('Google Maps API key is missing');
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`;
    script.async = true;
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);
  return null;
}
