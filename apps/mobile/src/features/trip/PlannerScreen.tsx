import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import type { TripFilters } from '@roadtrip/types';
import { TripThemeSchema } from '@roadtrip/types';
import { colors } from '../../theme/colors';
import {
  fetchTripSuggestions,
  listSavedTrips,
  saveGeneratedTrip,
  type SavedTrip,
} from './api-client';

type Suggestion = {
  id: string;
  label: string;
};

const PlannerScreen = () => {
  const [location, setLocation] = useState('Portland, OR');
  const [filters, setFilters] = useState<TripFilters>({
    radiusKm: 200,
    theme: 'adventure',
    maxStops: 5,
  });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedTrip = savedTrips.find((trip) => trip.id === selectedTripId) ?? null;

  useEffect(() => {
    const loadSavedTrips = async () => {
      const trips = await listSavedTrips();
      setSavedTrips(trips);
    };

    void loadSavedTrips();
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await fetchTripSuggestions({
        location,
        radiusKm: filters.radiusKm,
        theme: filters.theme,
      });
      setSuggestions(
        data.map((item) => ({
          id: item.id,
          label: `${item.title} · ${item.distanceKm}km`,
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTrip = async () => {
    setSaving(true);
    try {
      const savedTrip = await saveGeneratedTrip({
        location,
        radiusKm: filters.radiusKm,
        theme: filters.theme,
        name: `${filters.theme} trip from ${location}`,
      });
      if (savedTrip) {
        setSavedTrips((prev) => [
          savedTrip,
          ...prev.filter((trip) => trip.id !== savedTrip.id),
        ]);
        setSelectedTripId(savedTrip.id);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Origin</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="City or coordinates"
          placeholderTextColor="#94a3b8"
        />

        <Text style={styles.label}>Radius (km)</Text>
        <TextInput
          keyboardType="numeric"
          style={styles.input}
          value={String(filters.radiusKm)}
          onChangeText={(text) =>
            setFilters((prev) => ({ ...prev, radiusKm: Number(text) }))
          }
        />

        <Text style={styles.label}>Theme</Text>
        <View style={styles.chipGroup}>
          {TripThemeSchema.options.map((theme) => (
            <TouchableOpacity
              key={theme}
              onPress={() => setFilters((prev) => ({ ...prev, theme }))}
              style={[styles.chip, filters.theme === theme && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  filters.theme === theme && styles.chipTextActive,
                ]}
              >
                {theme}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => {
            void handleGenerate();
          }}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Loading...' : 'Generate trip'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.buttonSecondary,
            (saving || !suggestions.length) && styles.buttonDisabled,
          ]}
          onPress={() => {
            void handleSaveTrip();
          }}
          disabled={saving || !suggestions.length}
        >
          <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save trip'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={suggestions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.suggestion}>
            <Text style={styles.suggestionText}>{item.label}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.placeholder}>
            Generate a trip to preview curated stops.
          </Text>
        }
        contentContainerStyle={{ gap: 12 }}
      />

      <View style={styles.savedSection}>
        <Text style={styles.label}>Saved trips</Text>
        {savedTrips.length ? (
          savedTrips.map((trip) => (
            <TouchableOpacity
              key={trip.id}
              style={[
                styles.suggestion,
                selectedTripId === trip.id && styles.suggestionSelected,
              ]}
              onPress={() => setSelectedTripId(trip.id)}
            >
              <Text style={styles.suggestionText}>{trip.name}</Text>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.placeholder}>No saved trips yet.</Text>
        )}
      </View>

      {selectedTrip && (
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>{selectedTrip.name}</Text>
          <Text style={styles.detailsMeta}>
            Origin: {selectedTrip.origin.lat.toFixed(3)},{' '}
            {selectedTrip.origin.lng.toFixed(3)}
          </Text>
          <Text style={styles.detailsMeta}>Stops: {selectedTrip.stops.length}</Text>

          <View style={styles.detailsStops}>
            {selectedTrip.stops.map((stop, index) => (
              <View key={stop.id} style={styles.detailsStopItem}>
                <Text style={styles.detailsStopTitle}>
                  {index + 1}. {stop.name}
                </Text>
                <Text style={styles.detailsStopText}>
                  {stop.lat.toFixed(3)}, {stop.lng.toFixed(3)}
                </Text>
                {!!stop.notes && <Text style={styles.detailsStopText}>{stop.notes}</Text>}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    gap: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  label: {
    color: '#94a3b8',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 14,
    color: colors.text,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: '#064e3b',
  },
  chipText: {
    color: '#94a3b8',
  },
  chipTextActive: {
    color: colors.accent,
  },
  button: {
    marginTop: 8,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  buttonSecondary: {
    marginTop: 4,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  suggestion: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#111827',
  },
  suggestionText: {
    color: colors.text,
  },
  suggestionSelected: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  placeholder: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 24,
  },
  savedSection: {
    gap: 10,
    marginBottom: 12,
  },
  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    gap: 8,
    marginBottom: 24,
  },
  detailsTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  detailsMeta: {
    color: '#94a3b8',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  detailsStops: {
    gap: 8,
    marginTop: 6,
  },
  detailsStopItem: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  detailsStopTitle: {
    color: colors.text,
    fontWeight: '600',
  },
  detailsStopText: {
    color: '#94a3b8',
    fontSize: 12,
  },
});

export default PlannerScreen;
