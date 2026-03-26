import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PlannerScreen from './PlannerScreen';
import { fetchTripSuggestions, listSavedTrips, saveGeneratedTrip } from './api-client';

jest.mock('./api-client', () => ({
  fetchTripSuggestions: jest.fn(),
  saveGeneratedTrip: jest.fn(),
  listSavedTrips: jest.fn(),
}));

const mockedFetchTripSuggestions = fetchTripSuggestions as jest.MockedFunction<
  typeof fetchTripSuggestions
>;
const mockedSaveGeneratedTrip = saveGeneratedTrip as jest.MockedFunction<
  typeof saveGeneratedTrip
>;
const mockedListSavedTrips = listSavedTrips as jest.MockedFunction<typeof listSavedTrips>;

describe('PlannerScreen', () => {
  beforeEach(() => {
    mockedFetchTripSuggestions.mockReset();
    mockedSaveGeneratedTrip.mockReset();
    mockedListSavedTrips.mockReset();
    mockedFetchTripSuggestions.mockResolvedValue([
      {
        id: 'suggestion-1',
        placeId: 'place-1',
        title: 'foodie waypoint',
        description: 'prototype placeholder',
        distanceKm: 80,
        lat: 30,
        lng: -97,
      },
    ]);
    mockedSaveGeneratedTrip.mockResolvedValue({
      id: 'trip-1',
      name: 'foodie trip from Portland, OR',
      origin: { lat: 30, lng: -97 },
      stops: [
        {
          id: 'stop-1',
          name: 'Pike Place',
          order: 0,
          lat: 30.1,
          lng: -97.1,
          notes: 'Great food hall',
        },
      ],
    });
    mockedListSavedTrips.mockResolvedValue([]);
  });

  it('updates radius', async () => {
    const { getByDisplayValue } = render(<PlannerScreen />);
    await waitFor(() => {
      expect(mockedListSavedTrips).toHaveBeenCalled();
    });
    const input = getByDisplayValue('200');
    fireEvent.changeText(input, '120');
    expect(getByDisplayValue('120')).toBeTruthy();
  });

  it('updates suggestions using the selected theme', async () => {
    const { getByText, queryByText } = render(<PlannerScreen />);
    await waitFor(() => {
      expect(mockedListSavedTrips).toHaveBeenCalled();
    });

    const foodieChip = getByText('foodie');
    fireEvent.press(foodieChip);
    expect(queryByText(/curated stops/i)).toBeTruthy();

    fireEvent.press(getByText(/generate trip/i));

    await waitFor(() => {
      expect(mockedFetchTripSuggestions).toHaveBeenCalledWith({
        location: 'Portland, OR',
        radiusKm: 200,
        theme: 'foodie',
      });
    });

    expect(queryByText(/foodie waypoint/i)).toBeTruthy();
  });

  it('saves generated trip after suggestions load', async () => {
    const { getByText } = render(<PlannerScreen />);
    await waitFor(() => {
      expect(mockedListSavedTrips).toHaveBeenCalled();
    });

    fireEvent.press(getByText(/generate trip/i));
    await waitFor(() => {
      expect(mockedFetchTripSuggestions).toHaveBeenCalled();
    });

    fireEvent.press(getByText(/save trip/i));

    await waitFor(() => {
      expect(mockedSaveGeneratedTrip).toHaveBeenCalledWith({
        location: 'Portland, OR',
        radiusKm: 200,
        theme: 'adventure',
        name: 'adventure trip from Portland, OR',
      });
    });

    expect(getByText(/Stops:/i)).toBeTruthy();
  });

  it('shows selected saved trip details with ordered stops', async () => {
    mockedListSavedTrips.mockResolvedValue([
      {
        id: 'trip-2',
        name: 'Weekend scenic loop',
        origin: { lat: 45.512, lng: -122.658 },
        stops: [
          {
            id: 'stop-2',
            name: 'Vista House',
            order: 0,
            lat: 45.539,
            lng: -122.244,
            notes: 'Iconic viewpoint',
          },
        ],
      },
    ]);

    const { getByText } = render(<PlannerScreen />);

    await waitFor(() => {
      expect(mockedListSavedTrips).toHaveBeenCalled();
    });

    fireEvent.press(getByText(/Weekend scenic loop/i));

    expect(getByText(/Origin:/i)).toBeTruthy();
    expect(getByText(/1\. Vista House/i)).toBeTruthy();
    expect(getByText(/Iconic viewpoint/i)).toBeTruthy();
  });
});
