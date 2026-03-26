import { render, fireEvent } from '@testing-library/react-native';
import PlannerScreen from './PlannerScreen';

describe('PlannerScreen', () => {
  it('updates radius', () => {
    const { getByDisplayValue } = render(<PlannerScreen />);
    const input = getByDisplayValue('200');
    fireEvent.changeText(input, '120');
    expect(getByDisplayValue('120')).toBeTruthy();
  });

  it('updates suggestions using the selected theme', () => {
    const { getByText, queryByText } = render(<PlannerScreen />);

    const foodieChip = getByText('foodie');
    fireEvent.press(foodieChip);
    expect(queryByText(/curated stops/i)).toBeTruthy();

    fireEvent.press(getByText(/generate trip/i));
    expect(queryByText(/foodie gem/i)).toBeTruthy();
    expect(queryByText(/spotlight/i)).toBeTruthy();
  });
});
