import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import PlannerScreen from './src/features/trip/PlannerScreen';

const Stack = createNativeStackNavigator();

const App = () => (
  <NavigationContainer>
    <StatusBar style="light" />
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#050914' },
        headerTintColor: '#ecfdf5',
        contentStyle: { backgroundColor: '#050914' }
      }}
    >
      <Stack.Screen name="Planner" component={PlannerScreen} options={{ title: 'RoadTrip' }} />
    </Stack.Navigator>
  </NavigationContainer>
);

export default App;
