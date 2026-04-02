/**
 * Normalises a location string for fuzzy cache key comparison.
 *
 * Strips common administrative suffixes (US state names/abbreviations, country
 * names) so that "Austin, TX" and "Austin, Texas, United States" produce the
 * same key. The original location string is always preserved for display.
 */
export const normalizeLocationKey = (location: string): string => {
  return (
    location
      .trim()
      // Remove trailing country names (country before state to handle compound suffixes)
      .replace(/,?\s*United States of America\s*$/i, '')
      .replace(/,?\s*United States\s*$/i, '')
      .replace(/,?\s*\bUSA\b\s*$/i, '')
      .replace(/,?\s*\bUS\b\s*$/i, '')
      .replace(/,?\s*Canada\s*$/i, '')
      // Remove trailing full US state names
      .replace(
        /,?\s*\b(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|District of Columbia)\b\s*$/i,
        '',
      )
      // Remove trailing two-letter US state abbreviations like ", TX" or " CA"
      .replace(/,\s*[A-Z]{2}\s*$/i, '')
      // Remove trailing county/parish/borough designations (e.g. "Davidson County")
      .replace(/,?\s*\b\w[\w\s]*\s+(County|Parish|Borough|Township)\b\s*$/i, '')
      // Clean up any double commas or trailing commas left by the above
      .replace(/,\s*,/g, ',')
      .replace(/,\s*$/g, '')
      .trim()
      .toLowerCase()
  );
};
