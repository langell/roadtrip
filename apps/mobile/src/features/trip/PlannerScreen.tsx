import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import type { TripFilters } from '@roadtrip/types';
import { TripThemeSchema } from '@roadtrip/types';
import { colors } from '../../theme/colors';

type Suggestion = {
  id: string;
  label: string;
};

const PlannerScreen = () => {
  const [location, setLocation] = useState('Portland, OR');
  const [filters, setFilters] = useState<TripFilters>({ radiusKm: 200, theme: 'adventure', maxStops: 5 });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const handleGenerate = () => {
    // Placeholder logic until API integration lands.
    setSuggestions([
      { id: '1', label: `${filters.theme} gem near ${location}` },
      { id: '2', label: 'Partner spotlight: Electric canyon tour' }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Origin</Text>
        <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="City or coordinates" placeholderTextColor="#94a3b8" />

        <Text style={styles.label}>Radius (km)</Text>
        <TextInput
          keyboardType="numeric"
          style={styles.input}
          value={String(filters.radiusKm)}
          onChangeText={(text) => setFilters((prev) => ({ ...prev, radiusKm: Number(text) }))}
        />

        <Text style={styles.label}>Theme</Text>
        <View style={styles.chipGroup}>
          {TripThemeSchema.options.map((theme) => (
            <TouchableOpacity
              key={theme}
              onPress={() => setFilters((prev) => ({ ...prev, theme }))}
              style={[styles.chip, filters.theme === theme && styles.chipActive]}
            >
              <Text style={[styles.chipText, filters.theme === theme && styles.chipTextActive]}>{theme}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.button} onPress={handleGenerate}>
          <Text style={styles.buttonText}>Generate trip</Text>
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
        ListEmptyComponent={<Text style={styles.placeholder}>Generate a trip to preview curated stops.</Text>}
        contentContainerStyle={{ gap: 12 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    gap: 16
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    gap: 12
  },
  label: {
    color: '#94a3b8',
    fontSize: 12,
    textTransform: 'uppercase'
  },
  input: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 14,
    color: colors.text
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1f2937'
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: '#064e3b'
  },
  chipText: {
    color: '#94a3b8'
  },
  chipTextActive: {
    color: colors.accent
  },
  button: {
    marginTop: 8,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center'
  },
  buttonText: {
    textTransform: 'uppercase',
    fontWeight: '600'
  },
  suggestion: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#111827'
  },
  suggestionText: {
    color: colors.text
  },
  placeholder: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 24
  }
});

export default PlannerScreen;
