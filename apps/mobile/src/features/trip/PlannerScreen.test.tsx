import { render, fireEvent } from '@testing-library/react-native';
import PlannerScreen from './PlannerScreen';

describe('PlannerScreen', () => {
  it('updates radius', () => {
    const { getByDisplayValue } = render(<PlannerScreen />);
    const input = getByDisplayValue('200');
    fireEvent.changeText(input, '120');
    expect(getByDisplayValue('120')).toBeTruthy();
  });
});
