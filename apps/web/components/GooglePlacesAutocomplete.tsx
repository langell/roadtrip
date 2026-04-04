'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const debounce = <T extends (...args: any[]) => void>(fn: T, delay: number) => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
  onSelectWithPlaceId?: (description: string, placeId: string) => void;
  placeholder?: string;
  placeTypes?: string[];
  locationBias?: {
    lat: number;
    lng: number;
    radiusMeters: number;
  };
}

export default function GooglePlacesAutocomplete({
  value,
  onChange,
  onSelect,
  onSelectWithPlaceId,
  placeholder = 'Search for a city or place...',
  placeTypes = ['(cities)'],
  locationBias,
}: GooglePlacesAutocompleteProps) {
  type PlacePrediction = {
    description: string;
    place_id: string;
    [key: string]: unknown;
  };
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasInteracted = useRef(false);

  // Refs so the debounced callback always reads the latest prop values
  // without needing to be recreated every render.
  const locationBiasRef = useRef(locationBias);
  const placeTypesRef = useRef(placeTypes);
  useEffect(() => {
    locationBiasRef.current = locationBias;
  });
  useEffect(() => {
    placeTypesRef.current = placeTypes;
  });

  useEffect(() => {
    if (!window.google && !document.getElementById('google-maps-script')) return;
    if (window.google?.maps?.places) {
      setScriptLoaded(true);
      return;
    }
    // GoogleMapsScriptLoader in layout owns the script — wait for it
    const existing = document.getElementById('google-maps-script');
    if (existing) {
      const onLoad = () => setScriptLoaded(true);
      existing.addEventListener('load', onLoad);
      return () => existing.removeEventListener('load', onLoad);
    }
  }, []);

  const runQuery = useCallback(
    (inputValue: string) => {
      if (!scriptLoaded || !inputValue) {
        setSuggestions([]);
        setShowSuggestions(false);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      const bias = locationBiasRef.current;
      const types = placeTypesRef.current;
      // Only apply location restriction when we have real coordinates (not 0,0 fallback)
      const validBias = bias && (bias.lat !== 0 || bias.lng !== 0) ? bias : null;

      // Convert circle to LatLngBounds — strictBounds only works reliably with bounds,
      // not with location+radius (Google treats location+radius as a soft bias regardless).
      let boundsParam: typeof window.google.maps.LatLngBounds.prototype | undefined;
      if (validBias) {
        const latDelta = validBias.radiusMeters / 111_000;
        const lngDelta =
          validBias.radiusMeters / (111_000 * Math.cos((validBias.lat * Math.PI) / 180));
        boundsParam = new window.google.maps.LatLngBounds(
          new window.google.maps.LatLng(
            validBias.lat - latDelta,
            validBias.lng - lngDelta,
          ),
          new window.google.maps.LatLng(
            validBias.lat + latDelta,
            validBias.lng + lngDelta,
          ),
        );
      }

      const requestParams = {
        input: inputValue,
        ...(types.length > 0 && { types }),
        ...(boundsParam && { bounds: boundsParam, strictBounds: true }),
      };

      const handleResults = (predictions: PlacePrediction[] | null, status: string) => {
        setLoading(false);
        if (status === 'OK' && predictions) {
          setSuggestions(predictions);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(true);
          if (status !== 'ZERO_RESULTS') setError('No results found.');
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const callService = (svc: any) =>
        svc.getPlacePredictions(requestParams, handleResults);

      if (window.google?.maps?.importLibrary) {
        void window.google.maps.importLibrary('places').then(() => {
          if (window.google?.maps?.places) {
            callService(new window.google.maps.places.AutocompleteService());
          }
        });
      } else if (window.google?.maps?.places) {
        callService(new window.google.maps.places.AutocompleteService());
      }
    },
    [scriptLoaded],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchSuggestions = useCallback(debounce(runQuery, 250), [runQuery]);

  useEffect(() => {
    if (!hasInteracted.current) return;
    fetchSuggestions(value);
    setActiveIndex(-1);
  }, [value, fetchSuggestions]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        const s = suggestions[activeIndex];
        onSelect(s.description);
        onSelectWithPlaceId?.(s.description, s.place_id);
        setShowSuggestions(false);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="group relative" ref={containerRef} aria-haspopup="listbox">
      <svg
        aria-hidden
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-wayfarer-primary/40 transition-colors group-focus-within:text-wayfarer-primary"
      >
        <path
          fillRule="evenodd"
          d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.006 3.699-4.92 3.699-8.327a8 8 0 10-16 0c0 3.407 1.755 6.321 3.7 8.327a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.144.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
          clipRule="evenodd"
        />
      </svg>
      <input
        ref={inputRef}
        className="h-14 w-full rounded-xl border-none bg-wayfarer-surface pl-12 pr-6 text-left font-body text-base font-medium text-wayfarer-text-main placeholder:text-wayfarer-text-muted/60 focus:outline-none focus:ring-2 focus:ring-wayfarer-primary-light"
        placeholder={placeholder}
        value={value}
        onFocus={() => {
          hasInteracted.current = true;
          if (suggestions.length > 0) setShowSuggestions(true);
        }}
        onChange={(e) => {
          hasInteracted.current = true;
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls="autocomplete-listbox"
        aria-activedescendant={
          activeIndex >= 0 ? `autocomplete-item-${activeIndex}` : undefined
        }
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={showSuggestions}
      />
      {loading && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl bg-wayfarer-surface px-4 py-2 text-sm text-wayfarer-text-muted shadow-wayfarer-soft">
          Loading…
        </div>
      )}
      {showSuggestions && (
        <div
          id="autocomplete-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl bg-wayfarer-surface shadow-wayfarer-soft"
        >
          {suggestions.length === 0 && !loading && (
            <div className="px-4 py-3 text-sm text-wayfarer-text-muted">
              {error || 'No results found.'}
            </div>
          )}
          {suggestions.map((suggestion, idx) => (
            <div
              id={`autocomplete-item-${idx}`}
              key={suggestion.place_id}
              role="option"
              aria-selected={activeIndex === idx}
              className={`cursor-pointer px-4 py-3 font-body text-sm text-wayfarer-text-main transition-colors ${
                activeIndex === idx ? 'bg-wayfarer-bg' : 'hover:bg-wayfarer-bg'
              }`}
              onMouseDown={() => {
                onSelect(suggestion.description);
                onSelectWithPlaceId?.(suggestion.description, suggestion.place_id);
                setShowSuggestions(false);
              }}
              onMouseEnter={() => setActiveIndex(idx)}
            >
              {suggestion.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
