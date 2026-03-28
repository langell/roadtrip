'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
  placeholder?: string;
}

export default function GooglePlacesAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Search for a city or place...',
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

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;
    if (window.google && window.google.maps && window.google.maps.places) {
      setScriptLoaded(true);
      return;
    }
    if (!document.getElementById('google-maps')) {
      const script = document.createElement('script');
      script.id = 'google-maps';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&v=weekly`;
      script.async = true;
      script.onload = () => setScriptLoaded(true);
      document.body.appendChild(script);
    } else {
      setScriptLoaded(true);
    }
  }, []);

  // Debounce input
  // Use ReturnType<typeof setTimeout> for browser compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debounce = <T extends (...args: any[]) => void>(fn: T, delay: number) => {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  // Fetch suggestions with debounce
  const fetchSuggestions = useCallback(
    debounce((inputValue: string) => {
      if (!scriptLoaded || !inputValue) {
        setSuggestions([]);
        setShowSuggestions(false);
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let service: any = null;
      if (window.google && window.google.maps && window.google.maps.places) {
        if (window.google.maps.importLibrary) {
          window.google.maps.importLibrary('places').then(() => {
            service = new window.google.maps.places.AutocompleteService();
            // Only call if google is defined

            if (
              typeof window !== 'undefined' &&
              window.google &&
              window.google.maps &&
              window.google.maps.places
            ) {
              service.getPlacePredictions(
                { input: inputValue, types: ['(cities)'] },
                (predictions: PlacePrediction[] | null, status: string) => {
                  setLoading(false);
                  if (status === 'OK' && predictions) {
                    setSuggestions(predictions);
                    setShowSuggestions(true);
                  } else {
                    setSuggestions([]);
                    setShowSuggestions(true);
                    if (status !== 'ZERO_RESULTS') setError('No results found.');
                  }
                },
              );
            }
          });
        } else {
          service = new window.google.maps.places.AutocompleteService();
          service.getPlacePredictions(
            { input: inputValue, types: ['(cities)'] },
            (predictions: PlacePrediction[], status: string) => {
              setLoading(false);
              if (status === 'OK' && predictions) {
                setSuggestions(predictions);
                setShowSuggestions(true);
              } else {
                setSuggestions([]);
                setShowSuggestions(true);
                if (status !== 'ZERO_RESULTS') setError('No results found.');
              }
            },
          );
        }
      }
    }, 250),
    [scriptLoaded],
  );

  useEffect(() => {
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
        onSelect(suggestions[activeIndex].description);
        setShowSuggestions(false);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div
      className="relative"
      ref={containerRef}
      aria-haspopup="listbox"
      aria-owns="autocomplete-listbox"
    >
      <input
        ref={inputRef}
        className="h-16 w-full rounded-xl border-none bg-white pl-12 pr-6 font-body font-medium text-wayfarer-text-main placeholder:text-wayfarer-text-muted focus:outline-none focus:ring-2 focus:ring-wayfarer-primary-light"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
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
        <div className="absolute left-0 right-0 top-full z-10 bg-white px-4 py-2 text-wayfarer-text-muted shadow-lg rounded-xl mt-1">
          Loading…
        </div>
      )}
      {showSuggestions && (
        <div
          id="autocomplete-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 bg-white shadow-lg rounded-xl mt-1"
        >
          {suggestions.length === 0 && !loading && (
            <div className="px-4 py-2 text-wayfarer-text-muted">
              {error || 'No results found.'}
            </div>
          )}
          {suggestions.map((suggestion, idx) => (
            <div
              id={`autocomplete-item-${idx}`}
              key={suggestion.place_id}
              role="option"
              aria-selected={activeIndex === idx}
              className={`px-4 py-2 cursor-pointer font-body text-wayfarer-text-main ${
                activeIndex === idx ? 'bg-wayfarer-bg' : 'hover:bg-wayfarer-bg'
              }`}
              onMouseDown={() => {
                onSelect(suggestion.description);
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
